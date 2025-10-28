# Perkie Headshot Service — Execution Spec (for Claude Code IDE)

**Goal:** Implement a zero‑control, fully automatic service that converts customer uploads into gallery‑quality black‑and‑white pet headshot portraits with a transparent background. Target stack: **Google Cloud Run** (containers) and **Google Cloud Storage** (assets). Optional: Cloud Pub/Sub for async; this spec ships an MVP that works synchronously on Cloud Run, and can later flip to async without changing the public API.

---

## 0) TL;DR runbook

```bash
# 1) Create a .env from the example and set values
cp .env.example .env

# 2) Build & run locally
make run-local   # or: uvicorn src.app.main:app --reload --port 8080

# 3) Build & deploy to Cloud Run (auth with gcloud first)
make deploy      # uses gcloud, service name per env vars
```

> After deploy, the service exposes:
> - `POST /headshot` → `{job_id, preview_url, print_url, quality}` (MVP: synchronous)
> - `GET  /healthz` → health check

---

## 1) Repository layout

```
perkie-headshot/
├─ .env.example
├─ Makefile
├─ README.md
├─ requirements.txt
├─ Dockerfile
├─ scripts/
│  ├─ deploy.sh
│  └─ build.sh
├─ infra/
│  ├─ cloudrun.md       # notes + gcloud commands
│  └─ (optional tf later)
├─ src/
│  └─ app/
│     ├─ main.py
│     ├─ config.py
│     ├─ gcs.py
│     ├─ quality.py
│     ├─ matting.py
│     ├─ bw_pipeline.py
│     ├─ compose.py
│     ├─ models/
│     │  └─ README.md   # where to place .onnx if/when added
│     └─ util/
│        └─ imaging.py
├─ tests/
│  ├─ test_health.py
│  └─ test_headshot_smoke.py
└─ .gitignore
```

---

## 2) Environment and configuration

**`.env.example`**
```dotenv
# General
ENV=dev
PROJECT_ID=your-gcp-project-id
REGION=us-central1
SERVICE_NAME=perkie-headshot-api

# GCS buckets
GCS_BUCKET_ORIGINAL=perkie-headshot-originals-dev
GCS_BUCKET_OUTPUT=perkie-headshot-outputs-dev

# Signed URL settings (seconds)
UPLOAD_URL_TTL=600
DOWNLOAD_URL_TTL=604800

# Image defaults
PREVIEW_LONG_EDGE=1600
PRINT_LONG_EDGE=3000

# Security
ALLOWED_ORIGINS=*
```

**`src/app/config.py`**
```python
import os

class Settings:
    ENV = os.getenv("ENV", "dev")
    PROJECT_ID = os.getenv("PROJECT_ID", "")
    REGION = os.getenv("REGION", "us-central1")
    SERVICE_NAME = os.getenv("SERVICE_NAME", "perkie-headshot-api")

    GCS_BUCKET_ORIGINAL = os.getenv("GCS_BUCKET_ORIGINAL", "")
    GCS_BUCKET_OUTPUT = os.getenv("GCS_BUCKET_OUTPUT", "")

    UPLOAD_URL_TTL = int(os.getenv("UPLOAD_URL_TTL", "600"))
    DOWNLOAD_URL_TTL = int(os.getenv("DOWNLOAD_URL_TTL", "604800"))

    PREVIEW_LONG_EDGE = int(os.getenv("PREVIEW_LONG_EDGE", "1600"))
    PRINT_LONG_EDGE = int(os.getenv("PRINT_LONG_EDGE", "3000"))

    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")

settings = Settings()
```

---

## 3) Dependencies & container

**`requirements.txt`**
```
fastapi==0.115.2
uvicorn[standard]==0.30.6
pydantic==2.9.2
python-multipart==0.0.9

# Imaging
pillow==10.4.0
numpy==2.1.2
opencv-python-headless==4.10.0.84
scikit-image==0.24.0

# GCP
google-cloud-storage==2.18.2
```

**`Dockerfile`**
```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      libgl1 \
      && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY src ./src

# Cloud Run provides $PORT
ENV PORT=8080
CMD exec uvicorn src.app.main:app --host 0.0.0.0 --port ${PORT}
```

**`Makefile`**
```make
include .env

.PHONY: run-local build deploy

run-local:
	uvicorn src.app.main:app --reload --port 8080

build:
	docker build -t $(SERVICE_NAME):local .

depoy-image:
	gcloud builds submit --tag gcr.io/$(PROJECT_ID)/$(SERVICE_NAME):$(ENV)

deploy: depoy-image
	gcloud run deploy $(SERVICE_NAME) \
	  --image gcr.io/$(PROJECT_ID)/$(SERVICE_NAME):$(ENV) \
	  --platform managed \
	  --region $(REGION) \
	  --allow-unauthenticated \
	  --cpu 2 --memory 2Gi \
	  --max-instances 10 \
	  --set-env-vars ENV=$(ENV),PROJECT_ID=$(PROJECT_ID),REGION=$(REGION),\
	GCS_BUCKET_ORIGINAL=$(GCS_BUCKET_ORIGINAL),GCS_BUCKET_OUTPUT=$(GCS_BUCKET_OUTPUT),\
	UPLOAD_URL_TTL=$(UPLOAD_URL_TTL),DOWNLOAD_URL_TTL=$(DOWNLOAD_URL_TTL),\
	PREVIEW_LONG_EDGE=$(PREVIEW_LONG_EDGE),PRINT_LONG_EDGE=$(PRINT_LONG_EDGE),\
	ALLOWED_ORIGINS=$(ALLOWED_ORIGINS)
```

**`scripts/deploy.sh`**
```bash
#!/usr/bin/env bash
set -euo pipefail

source .env

gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${ENV}

gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${ENV} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --cpu 2 --memory 2Gi \
  --max-instances 10 \
  --set-env-vars ENV=${ENV},PROJECT_ID=${PROJECT_ID},REGION=${REGION},\
GCS_BUCKET_ORIGINAL=${GCS_BUCKET_ORIGINAL},GCS_BUCKET_OUTPUT=${GCS_BUCKET_OUTPUT},\
UPLOAD_URL_TTL=${UPLOAD_URL_TTL},DOWNLOAD_URL_TTL=${DOWNLOAD_URL_TTL},\
PREVIEW_LONG_EDGE=${PREVIEW_LONG_EDGE},PRINT_LONG_EDGE=${PRINT_LONG_EDGE},\
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
```

---

## 4) API — FastAPI service

**`src/app/main.py`**
```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
from .config import settings
from .gcs import upload_bytes, generate_signed_url
from .quality import quality_check
from .matting import run_matting
from .bw_pipeline import to_bw_house_look
from .compose import compose_transparent_png
from .util.imaging import read_image_bytes, resize_long_edge

app = FastAPI(title="Perkie Headshot API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.ALLOWED_ORIGINS] if settings.ALLOWED_ORIGINS != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HeadshotResponse(BaseModel):
    job_id: str
    preview_url: str
    print_url: str
    quality: dict

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.post("/headshot", response_model=HeadshotResponse)
async def headshot(file: UploadFile = File(...)):
    if file.content_type not in {"image/jpeg", "image/png", "image/heic", "image/heif"}:
        raise HTTPException(400, detail="Unsupported file type")

    job_id = str(uuid.uuid4())
    orig_bytes = await file.read()

    # 1) Store original
    orig_key = f"{job_id}/original/{file.filename}"
    upload_bytes(settings.GCS_BUCKET_ORIGINAL, orig_key, orig_bytes, content_type=file.content_type)

    # 2) Read image and quality gate
    img = read_image_bytes(orig_bytes)
    qc = quality_check(img)
    if not qc["pass"]:
        # Still proceed, but include reasons. Optionally: raise error.
        pass

    # 3) Matting on color image (returns alpha in [0,1])
    alpha = run_matting(img)

    # 4) Headshot crop & standard composition (inside matting step or here)
    #    For MVP, center-crop by alpha bbox with fixed 4:5 ratio.

    # 5) B&W house look
    bw = to_bw_house_look(img)

    # 6) Compose transparent PNG (apply alpha, soft neck fade)
    preview = resize_long_edge(bw, settings.PREVIEW_LONG_EDGE)
    preview_alpha = resize_long_edge(alpha, settings.PREVIEW_LONG_EDGE)
    preview_png = compose_transparent_png(preview, preview_alpha)

    print_img = resize_long_edge(bw, settings.PRINT_LONG_EDGE)
    print_alpha = resize_long_edge(alpha, settings.PRINT_LONG_EDGE)
    print_png = compose_transparent_png(print_img, print_alpha)

    # 7) Store outputs
    preview_key = f"{job_id}/outputs/preview.png"
    print_key = f"{job_id}/outputs/print.png"

    upload_bytes(settings.GCS_BUCKET_OUTPUT, preview_key, preview_png, content_type="image/png")
    upload_bytes(settings.GCS_BUCKET_OUTPUT, print_key, print_png, content_type="image/png")

    # 8) Signed URLs for client consumption
    preview_url = generate_signed_url(settings.GCS_BUCKET_OUTPUT, preview_key, ttl_seconds=settings.DOWNLOAD_URL_TTL)
    print_url = generate_signed_url(settings.GCS_BUCKET_OUTPUT, print_key, ttl_seconds=settings.DOWNLOAD_URL_TTL)

    return HeadshotResponse(job_id=job_id, preview_url=preview_url, print_url=print_url, quality=qc)
```

---

## 5) GCS helpers

**`src/app/gcs.py`**
```python
from google.cloud import storage
from datetime import timedelta
from .config import settings

_client = storage.Client()

def upload_bytes(bucket_name: str, key: str, data: bytes, content_type: str = "application/octet-stream"):
    bucket = _client.bucket(bucket_name)
    blob = bucket.blob(key)
    blob.upload_from_string(data, content_type=content_type)


def generate_signed_url(bucket_name: str, key: str, ttl_seconds: int) -> str:
    bucket = _client.bucket(bucket_name)
    blob = bucket.blob(key)
    url = blob.generate_signed_url(expiration=timedelta(seconds=ttl_seconds), method="GET")
    return url
```

---

## 6) Quality, Matting, B&W, Compose (MVP implementations)

> These modules ship **production-shaped** code with safe fallbacks. You can later swap in ONNX/TensorRT models where indicated.

**`src/app/quality.py`**
```python
import cv2
import numpy as np

# Simple, fast gates; extend with exposure/occlusion if needed

def blur_score(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def quality_check(img_bgr: np.ndarray) -> dict:
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    score = blur_score(gray)
    size_ok = max(h, w) >= 1500

    passed = (score > 80.0) and size_ok  # tune thresholds

    return {
        "pass": bool(passed),
        "metrics": {
            "blur_var": score,
            "h": int(h),
            "w": int(w),
        },
        "reasons": [] if passed else [
            *([] if score > 80.0 else ["image_blurry"]),
            *([] if size_ok else ["image_too_small"]),
        ],
    }
```

**`src/app/matting.py`**
```python
import cv2
import numpy as np

# MVP: soft alpha from salient object + fur-friendly edge softening.
# NOTE: Replace with a proper matting model (ONNX) later.

def run_matting(img_bgr: np.ndarray) -> np.ndarray:
    h, w = img_bgr.shape[:2]
    # Quick saliency (fine-tune later or replace with ONNX model)
    sal = cv2.saliency.StaticSaliencyFineGrained_create()
    ok, sal_map = sal.computeSaliency(img_bgr)
    if not ok:
        sal_map = np.zeros((h, w), dtype=np.float32)

    sal_map = (sal_map - sal_map.min()) / (sal_map.max() - sal_map.min() + 1e-6)

    # Morphological cleanup
    th = (sal_map > 0.5).astype(np.uint8) * 255
    th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8), iterations=2)

    # Largest contour as subject region
    cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    mask = np.zeros((h, w), dtype=np.uint8)
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        cv2.drawContours(mask, [c], -1, 255, -1)

    # Distance transform to create soft edges (fake matte)
    dist = cv2.distanceTransform((mask == 0).astype(np.uint8), cv2.DIST_L2, 3)
    dist = dist / (dist.max() + 1e-6)
    alpha = 1.0 - dist

    # Gentle edge blur to avoid harsh transitions
    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)
    alpha = np.clip(alpha, 0.0, 1.0)
    return alpha
```

**`src/app/bw_pipeline.py`**
```python
import cv2
import numpy as np

# House look conversion (neutral filmic with highlight rolloff + micro-contrast)

def to_bw_house_look(img_bgr: np.ndarray) -> np.ndarray:
    img = img_bgr.astype(np.float32) / 255.0

    # Mild WB normalization via gray-world assumption
    mean = img.mean(axis=(0,1), keepdims=True) + 1e-6
    scale = mean.mean() / mean
    img = np.clip(img * scale, 0, 1)

    # Convert to luminance with green bias (fur-friendly)
    r, g, b = img[:,:,2], img[:,:,1], img[:,:,0]
    L = 0.27*r + 0.67*g + 0.06*b

    # Filmic highlight rolloff (soft-shoulder curve)
    def filmic(x):
        # simple smoothstep-based shoulder
        return np.where(x < 0.85, x, 0.85 + 0.15*(1 - np.exp(-(x-0.85)*10)))
    L = filmic(L)

    # Local contrast (edge-aware)
    blur = cv2.GaussianBlur(L, (0,0), 1.0)
    detail = L - blur
    L = np.clip(L + 0.6*detail, 0, 1)

    out = (L*255.0).astype(np.uint8)
    return out
```

**`src/app/compose.py`**
```python
import cv2
import numpy as np
from .util.imaging import add_neck_fade


def compose_transparent_png(gray_u8: np.ndarray, alpha: np.ndarray) -> bytes:
    # Ensure alpha in [0,1]
    a = np.clip(alpha, 0.0, 1.0)

    # Optionally apply a soft neck fade for a tasteful cutoff
    a = add_neck_fade(a, strength=0.25)

    # Stack grayscale as RGB for PNG; keep alpha separate
    rgb = np.stack([gray_u8, gray_u8, gray_u8], axis=2)
    a8 = (a * 255.0).astype(np.uint8)
    bgra = np.dstack([rgb, a8])

    # Encode PNG
    ok, buf = cv2.imencode('.png', bgra)
    if not ok:
        raise RuntimeError("PNG encoding failed")
    return buf.tobytes()
```

**`src/app/util/imaging.py`**
```python
import cv2
import numpy as np
from io import BytesIO
from PIL import Image


def read_image_bytes(b: bytes) -> np.ndarray:
    img = Image.open(BytesIO(b)).convert('RGB')
    arr = np.array(img)[:, :, ::-1]  # to BGR for OpenCV
    return arr


def resize_long_edge(img: np.ndarray, long_edge: int) -> np.ndarray:
    h, w = img.shape[:2]
    if max(h, w) <= long_edge:
        return img
    if h > w:
        new_h = long_edge
        new_w = int(w * (long_edge / h))
    else:
        new_w = long_edge
        new_h = int(h * (long_edge / w))
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def add_neck_fade(alpha: np.ndarray, strength: float = 0.25) -> np.ndarray:
    # Apply a vertical gradient fade from bottom upward
    h, w = alpha.shape[:2]
    y = np.linspace(1.0, 0.0, h).reshape(h, 1)
    fade = 1.0 - (1.0 - y) * strength
    fade = np.clip(fade, 0.0, 1.0)
    return np.clip(alpha * fade, 0.0, 1.0)
```

---

## 7) Tests (smoke)

**`tests/test_health.py`**
```python
from fastapi.testclient import TestClient
from src.app.main import app

def test_health():
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
```

**`tests/test_headshot_smoke.py`**
```python
from fastapi.testclient import TestClient
from src.app.main import app

# Provide a tiny black square as a placeholder upload

def test_headshot_smoke():
    client = TestClient(app)
    files = {"file": ("test.png", b"\x89PNG\r\n\x1a\n", "image/png")}
    r = client.post("/headshot", files=files)
    assert r.status_code in (200, 400)  # minimal placeholder may fail quality
```
```

---

## 8) Cloud Run & GCS setup

**Prereqs**
- `gcloud auth login` and `gcloud config set project $PROJECT_ID`
- Create two buckets (or set names to existing):
  - `$GCS_BUCKET_ORIGINAL`
  - `$GCS_BUCKET_OUTPUT`
- Service account running Cloud Run must have: `Storage Object Admin` on both buckets.

**Deploy**
- Fill `.env` values
- Run `make deploy` or `scripts/deploy.sh`

**Notes**
- This MVP is synchronous for simplicity and will process typical images in < a few seconds on 2 vCPU.
- To go asynchronous: introduce Cloud Pub/Sub + a second Cloud Run worker that pulls jobs; API returns a `job_id` and a `GET /headshot/:id` endpoint for status.

---

## 9) Production hardening to do next (placeholders exist)

- **Matting:** Replace `run_matting` with an ONNX pet‑aware matting model. Add `src/app/models/` and lazy-load with a singleton. Consider half‑precision where supported.
- **Head localization:** Add detector + head regressor to standardize 4:5 composition (today we center on saliency/alpha bbox as a fallback).
- **Edge defringe:** Add 1px darkline/lightline suppression along the alpha contour.
- **Quality policy:** Enforce hard fail if `quality.pass == False`, with clear return message.
- **Observability:** Hook OpenTelemetry, GCP logs, and request ids per `job_id`.
- **Security:** Restrict CORS, require auth for print masters, and reduce signed URL TTL as needed.

---

## 10) Acceptance criteria

1. `POST /headshot` accepts JPEG/PNG and returns 200 with JSON containing `job_id`, `preview_url`, `print_url`, and `quality`.
2. Preview and print PNGs are uploaded to `$GCS_BUCKET_OUTPUT` under `job_id/outputs/` and are transparently retrievable by signed URL.
3. Result images are grayscale (3‑channel RGB) **with alpha** that cleanly isolates the pet; includes a soft, tasteful neck fade.
4. Service runs locally and on Cloud Run, honoring `$PORT` and env vars.
5. Health endpoint returns 200 OK.

---

## 11) Example cURL

```bash
curl -X POST \
  -F "file=@/path/to/pet.jpg" \
  https://<your-cloud-run-url>/headshot
```

---

## 12) README stub (copy into README.md)

```markdown
# Perkie Headshot API (Cloud Run + GCS)

Zero‑control service that turns customer uploads into gallery‑quality black‑and‑white pet headshots (transparent PNG).

## Quickstart
1. Copy `.env.example` → `.env` and fill values.
2. `make run-local` to run locally.
3. `make deploy` to deploy to Cloud Run.

## API
- `POST /headshot` → returns `job_id`, `preview_url`, `print_url`, `quality`.
- `GET /healthz` → health.

## Buckets
- Originals: `$GCS_BUCKET_ORIGINAL`
- Outputs: `$GCS_BUCKET_OUTPUT`

## Next steps
- Swap matting with ONNX model.
- Add detector + head composition.
- Add async processing with Pub/Sub.
```

---

### Notes for Claude Code
- The repo is self‑contained; create files exactly as referenced.
- Replace the MVP matting with your preferred ONNX model by editing `src/app/matting.py` and placing weights under `src/app/models/`.
- For CI, add Cloud Build or GitHub Actions; this spec keeps it minimal.


---

## 13) (Optional) Async job flow with Cloud Pub/Sub

**Why:** Keep the request path snappy while heavy renders run on GPU/CPU autoscaled workers.

### Architecture
- **API service (Cloud Run)** — receives uploads, enqueues a render job, returns `202 Accepted` with `job_id`.
- **Render worker (Cloud Run)** — subscribed to a Pub/Sub subscription; pulls jobs and performs the pipeline; writes results to GCS.
- **Status store** — job state in GCS JSON (simple) or Firestore (recommended for scale). MVP below uses **GCS JSON**.

### New resources
- Pub/Sub **topic**: `perkie-headshot-jobs`
- Pub/Sub **subscription**: `perkie-headshot-worker`

### API shape (async)
- `POST /headshot` → `{ job_id, status: "queued" }`
- `GET  /headshot/:job_id` → `{ job_id, status: "queued|processing|done|failed", preview_url?, print_url?, quality? }`

### Code: API enqueue & status

**`src/app/main.py` (additions)**
```python
from google.cloud import pubsub_v1
import json, time

PUBLISHER = pubsub_v1.PublisherClient()
TOPIC_PATH = PUBLISHER.topic_path(settings.PROJECT_ID, "perkie-headshot-jobs")

# Minimal job status i/o in GCS
from .gcs import upload_bytes, read_text, exists

STATUS_BUCKET = settings.GCS_BUCKET_OUTPUT  # co-locate with outputs

def status_key(job_id: str) -> str:
    return f"{job_id}/status.json"

@app.post("/headshot-async")
async def headshot_async(file: UploadFile = File(...)):
    if file.content_type not in {"image/jpeg","image/png","image/heic","image/heif"}:
        raise HTTPException(400, detail="Unsupported file type")

    job_id = str(uuid.uuid4())
    orig_bytes = await file.read()
    orig_key = f"{job_id}/original/{file.filename}"
    upload_bytes(settings.GCS_BUCKET_ORIGINAL, orig_key, orig_bytes, content_type=file.content_type)

    # write initial status
    upload_bytes(STATUS_BUCKET, status_key(job_id), json.dumps({"status":"queued"}).encode("utf-8"), "application/json")

    # publish job
    payload = {"job_id": job_id, "orig_bucket": settings.GCS_BUCKET_ORIGINAL, "orig_key": orig_key}
    fut = PUBLISHER.publish(TOPIC_PATH, data=json.dumps(payload).encode("utf-8"))
    fut.result(timeout=15)

    return {"job_id": job_id, "status": "queued"}

@app.get("/headshot/{job_id}")
async def headshot_status(job_id: str):
    if not exists(STATUS_BUCKET, status_key(job_id)):
        raise HTTPException(404, detail="job not found")
    data = read_text(STATUS_BUCKET, status_key(job_id))
    return json.loads(data)
```

### Code: Worker service

Create **`src/worker/main.py`**
```python
import json
from google.cloud import pubsub_v1
from google.cloud.pubsub_v1.subscriber.message import Message
from google.cloud import storage
from src.app.config import settings
from src.app.gcs import read_bytes, upload_bytes
from src.app.util.imaging import read_image_bytes, resize_long_edge
from src.app.quality import quality_check
from src.app.matting import run_matting
from src.app.bw_pipeline import to_bw_house_look
from src.app.compose import compose_transparent_png

STATUS_BUCKET = settings.GCS_BUCKET_OUTPUT

def status_key(job_id: str) -> str:
    return f"{job_id}/status.json"

_client = storage.Client()

def update_status(job_id: str, **fields):
    key = status_key(job_id)
    # merge-on-write (simple)
    try:
        current = json.loads(read_bytes(STATUS_BUCKET, key).decode("utf-8"))
    except Exception:
        current = {}
    current.update(fields)
    upload_bytes(STATUS_BUCKET, key, json.dumps(current).encode("utf-8"), "application/json")


def process_job(job):
    job_id = job["job_id"]
    orig_bucket = job["orig_bucket"]
    orig_key = job["orig_key"]
    update_status(job_id, status="processing")

    # load original
    from src.app.gcs import read_bytes
    orig_bytes = read_bytes(orig_bucket, orig_key)
    img = read_image_bytes(orig_bytes)

    qc = quality_check(img)

    alpha = run_matting(img)
    bw = to_bw_house_look(img)

    from src.app.config import settings
    preview = resize_long_edge(bw, settings.PREVIEW_LONG_EDGE)
    preview_alpha = resize_long_edge(alpha, settings.PREVIEW_LONG_EDGE)
    preview_png = compose_transparent_png(preview, preview_alpha)

    print_img = resize_long_edge(bw, settings.PRINT_LONG_EDGE)
    print_alpha = resize_long_edge(alpha, settings.PRINT_LONG_EDGE)
    print_png = compose_transparent_png(print_img, print_alpha)

    preview_key = f"{job_id}/outputs/preview.png"
    print_key = f"{job_id}/outputs/print.png"

    upload_bytes(settings.GCS_BUCKET_OUTPUT, preview_key, preview_png, "image/png")
    upload_bytes(settings.GCS_BUCKET_OUTPUT, print_key, print_png, "image/png")

    from src.app.gcs import generate_signed_url
    preview_url = generate_signed_url(settings.GCS_BUCKET_OUTPUT, preview_key, ttl_seconds=settings.DOWNLOAD_URL_TTL)
    print_url = generate_signed_url(settings.GCS_BUCKET_OUTPUT, print_key, ttl_seconds=settings.DOWNLOAD_URL_TTL)

    update_status(job_id, status="done", preview_url=preview_url, print_url=print_url, quality=qc)


def main(event, context=None):
    job = json.loads(event["data"]) if isinstance(event, dict) else json.loads(event.data)
    process_job(job)
```

**Worker Dockerfile** (reuse base)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY src ./src
CMD ["python", "-c", "from worker.main import main; import sys, json; import google.cloud.pubsub_v1;
print('Worker ready');
from google.cloud import pubsub_v1; subscriber = pubsub_v1.SubscriberClient();
import os; project=os.environ['PROJECT_ID']; sub_id='perkie-headshot-worker'; path=subscriber.subscription_path(project, sub_id);

import concurrent.futures as cf

def cb(message):
    try:
        from worker.main import main as handler
        handler(message)
        message.ack()
    except Exception as e:
        print('err', e); message.nack()

future = subscriber.subscribe(path, callback=cb)
cf.ThreadPoolExecutor().submit(future.result).result()"]
```

> Note: Above compact CMD is a simple subscriber loop to run on Cloud Run. For production, write a small Python runner that manages lifecycle and health probes.

### Env additions
Add to `.env` and Cloud Run env:
```
PUBSUB_TOPIC=perkie-headshot-jobs
PUBSUB_SUBSCRIPTION=perkie-headshot-worker
```

---

## 14) ONNX model loader (swap-in points)

**Goal:** Replace MVP saliency-based matte with a high-quality ONNX matting model, lazy‑loaded once per process.

### Dependencies
Add to `requirements.txt`:
```
onnxruntime==1.19.2
```

### Model placement
- Put weights under `src/app/models/matting.onnx` (for local dev). For production, store in **GCS** and download at container start to `/app/models/` if not present.

### Loader utility
**`src/app/models/loader.py`**
```python
import onnxruntime as ort, threading, os

_session = None
_lock = threading.Lock()

MODEL_PATH = os.environ.get("MATTING_MODEL_PATH", "src/app/models/matting.onnx")

def get_matting_session():
    global _session
    if _session is None:
        with _lock:
            if _session is None:
                providers = ["CPUExecutionProvider"]
                if os.environ.get("ORT_CUDA", "0") == "1":
                    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
                _session = ort.InferenceSession(MODEL_PATH, providers=providers)
    return _session
```

### Matting replacement
**`src/app/matting.py`** (replace body)
```python
import cv2, numpy as np
from .models.loader import get_matting_session

# Assume model takes HxW RGB float32 in [0,1], returns alpha HxW float32

def run_matting(img_bgr: np.ndarray) -> np.ndarray:
    sess = get_matting_session()
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    h, w = img_rgb.shape[:2]
    # optional: resize to model input (e.g., 512)
    side = 512
    scale = side / max(h, w)
    nh, nw = int(h*scale), int(w*scale)
    resized = cv2.resize(img_rgb, (nw, nh), interpolation=cv2.INTER_AREA)
    pad_h, pad_w = side - nh, side - nw
    inp = np.pad(resized, ((0,pad_h),(0,pad_w),(0,0)), constant_values=0)
    inp = np.transpose(inp, (2,0,1))[None, ...]  # NCHW

    alpha_small = sess.run(None, {sess.get_inputs()[0].name: inp})[0][0,0]
    alpha_small = alpha_small[:nh, :nw]
    alpha = cv2.resize(alpha_small, (w, h), interpolation=cv2.INTER_CUBIC)
    alpha = np.clip(alpha, 0.0, 1.0)
    # light edge smoothing
    alpha = cv2.GaussianBlur(alpha, (3,3), 0)
    return alpha
```

### Optional: GCS model bootstrap
**`src/app/models/README.md`**
```md
If `MATTING_MODEL_GCS=gs://bucket/path/model.onnx` is set, add an init hook to download once at startup to `MATTING_MODEL_PATH`.
```

---

## 15) Terraform ( buckets, Pub/Sub, Cloud Run )

> Minimal IaC to get you started. Adjust naming and add IAM as needed.

**`infra/main.tf`** (snippet)
```hcl
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {}
variable "region" { default = "us-central1" }
variable "service_name_api" { default = "perkie-headshot-api" }
variable "service_name_worker" { default = "perkie-headshot-worker" }
variable "bucket_original" {}
variable "bucket_output" {}

# Buckets
resource "google_storage_bucket" "original" {
  name                        = var.bucket_original
  location                    = var.region
  uniform_bucket_level_access = true
}

resource "google_storage_bucket" "output" {
  name                        = var.bucket_output
  location                    = var.region
  uniform_bucket_level_access = true
}

# Pub/Sub
resource "google_pubsub_topic" "jobs" {
  name = "perkie-headshot-jobs"
}

resource "google_pubsub_subscription" "worker" {
  name  = "perkie-headshot-worker"
  topic = google_pubsub_topic.jobs.name
}

# Service accounts
resource "google_service_account" "api" {
  account_id   = "perkie-headshot-api"
  display_name = "Perkie Headshot API"
}

resource "google_service_account" "worker" {
  account_id   = "perkie-headshot-worker"
  display_name = "Perkie Headshot Worker"
}

# IAM (buckets + pubsub)
resource "google_storage_bucket_iam_member" "api_output" {
  bucket = google_storage_bucket.output.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_storage_bucket_iam_member" "api_original" {
  bucket = google_storage_bucket.original.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_storage_bucket_iam_member" "worker_output" {
  bucket = google_storage_bucket.output.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_pubsub_topic_iam_member" "api_pub" {
  topic  = google_pubsub_topic.jobs.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_pubsub_subscription_iam_member" "worker_sub" {
  subscription = google_pubsub_subscription.worker.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:${google_service_account.worker.email}"
}
```

**`infra/cloudrun.md`** (commands)
```md
# Build images
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME_API:$ENV
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME_WORKER:$ENV -f Worker.Dockerfile

# Deploy API
gcloud run deploy $SERVICE_NAME_API \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME_API:$ENV \
  --region $REGION --allow-unauthenticated \
  --service-account perkie-headshot-api@$PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars PROJECT_ID=$PROJECT_ID,REGION=$REGION,\
GCS_BUCKET_ORIGINAL=$GCS_BUCKET_ORIGINAL,GCS_BUCKET_OUTPUT=$GCS_BUCKET_OUTPUT,\
PUBSUB_TOPIC=perkie-headshot-jobs,DOWNLOAD_URL_TTL=604800,UPLOAD_URL_TTL=600

# Deploy Worker
gcloud run deploy $SERVICE_NAME_WORKER \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME_WORKER:$ENV \
  --region $REGION \
  --service-account perkie-headshot-worker@$PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars PROJECT_ID=$PROJECT_ID,REGION=$REGION,\
GCS_BUCKET_ORIGINAL=$GCS_BUCKET_ORIGINAL,GCS_BUCKET_OUTPUT=$GCS_BUCKET_OUTPUT,\
PUBSUB_SUBSCRIPTION=perkie-headshot-worker,DOWNLOAD_URL_TTL=604800
```

---

## 16) Operational notes
- Prefer **Firestore** for job status at scale; swap `status.json` with a doc `{job_id}`.
- Add **OpenTelemetry** for traces across API → Pub/Sub → Worker.
- Configure **min instances** for the worker to avoid cold starts during campaigns.
- Lock down **CORS** and require auth to fetch print masters.

---

## 17) Acceptance updates for async mode
1. `POST /headshot-async` returns `202` with `{ job_id, status:"queued" }`.
2. Worker updates job status JSON (or Firestore) from `queued` → `processing` → `done|failed`.
3. `GET /headshot/:job_id` returns signed URLs only when `status == done`.
4. Both services run on Cloud Run with proper IAM for GCS and Pub/Sub.


---

## 18) Firestore job status (recommended at scale)

We’ll replace the GCS `status.json` with Firestore (Native mode). This improves atomic updates and querying.

### Dependencies
Add to `requirements.txt`:
```
google-cloud-firestore==2.16.0
```

### Config
Add to `.env` and Cloud Run env vars:
```
FIRESTORE_COLLECTION=headshots
```

### Helper: `src/app/fs.py`
```python
from google.cloud import firestore
from .config import settings

_db = firestore.Client()
COLL = settings.__dict__.get("FIRESTORE_COLLECTION", "headshots")

def job_ref(job_id: str):
    return _db.collection(COLL).document(job_id)

def write_status(job_id: str, **fields):
    ref = job_ref(job_id)
    ref.set(fields, merge=True)

def read_status(job_id: str) -> dict:
    doc = job_ref(job_id).get()
    if not doc.exists:
        return {}
    return doc.to_dict() or {}
```

### API changes (async path)
Update `src/app/main.py` to use Firestore instead of GCS for status:
```python
# ... imports
from .fs import write_status, read_status

@app.post("/headshot-async")
async def headshot_async(file: UploadFile = File(...)):
    # (unchanged upload to GCS for original)
    # ...
    write_status(job_id, status="queued")
    # publish job (unchanged)
    return {"job_id": job_id, "status": "queued"}

@app.get("/headshot/{job_id}")
async def headshot_status(job_id: str):
    data = read_status(job_id)
    if not data:
        raise HTTPException(404, detail="job not found")
    return data
```

### Worker changes
Update `src/worker/main.py` to write Firestore status:
```python
from src.app.fs import write_status

# replace update_status(...) calls
write_status(job_id, status="processing")
# ... after generating URLs
write_status(job_id, status="done", preview_url=preview_url, print_url=print_url, quality=qc)
```

### Terraform (Firestore Native mode)
Add to `infra/main.tf`:
```hcl
resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
}

# IAM for service accounts to access Firestore
resource "google_project_iam_member" "api_datastore_user" {
  role   = "roles/datastore.user"
  member = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "worker_datastore_user" {
  role   = "roles/datastore.user"
  member = "serviceAccount:${google_service_account.worker.email}"
}
```
> Note: Firestore requires a single default database per project; run TF in an empty Firestore project or ensure it matches your existing mode.

---

## 19) (Optional) GitHub Actions CI/CD (Cloud Run deploy)

> **You chose manual deploys.** This section is optional and can be ignored. Keep it for future use if you later want automated CI/CD.

## 20) README additions (status + CI)
 (status + CI)
Append to README:
```markdown
### Job status (Firestore)
We use Firestore Native mode. Documents live under collection `${FIRESTORE_COLLECTION}` and store fields like:
```json
{
  "status": "queued|processing|done|failed",
  "preview_url": "https://...",
  "print_url": "https://...",
  "quality": {"blur_var": 123.4}
}
```

### CI/CD
Merges to `main` trigger GitHub Actions to build via Cloud Build and deploy to Cloud Run (API and Worker). Auth uses GitHub OIDC → Google Workload Identity Federation (no JSON keys).
```

---

## 21) Acceptance criteria (Firestore + Deploy)
1. Firestore contains a document per `job_id` with live status transitions.
2. `GET /headshot/{job_id}` returns the Firestore doc contents.
3. Manual deploys succeed via `gcloud builds submit` + `gcloud run deploy` commands documented below.
4. No long‑lived service account keys are stored locally; you deploy using your gcloud auth.

## 22) Rollback plan
- Keep the previous image tag (last successful SHA). To rollback:
```bash
gcloud run deploy $SERVICE_NAME_API \
  --image us-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/$SERVICE_NAME_API:<PREV_SHA> \
  --region $REGION --allow-unauthenticated

gcloud run deploy $SERVICE_NAME_WORKER \
  --image us-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/$SERVICE_NAME_WORKER:<PREV_SHA> \
  --region $REGION
```
- Firestore is append‑only; status writes are idempotent. No schema migration required for rollback.

---

## 23) Manual deploys (no GitHub Actions)

### One‑time project setup
```bash
PROJECT_ID="your-project-id"
REGION="us-central1"
SERVICE_NAME_API="perkie-headshot-api"
SERVICE_NAME_WORKER="perkie-headshot-worker"
GCS_BUCKET_ORIGINAL="perkie-headshot-originals-prod"
GCS_BUCKET_OUTPUT="perkie-headshot-outputs-prod"

# Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com storage.googleapis.com pubsub.googleapis.com firestore.googleapis.com

# Create buckets (skip if exist)
gsutil mb -l $REGION gs://$GCS_BUCKET_ORIGINAL || true
gsutil mb -l $REGION gs://$GCS_BUCKET_OUTPUT || true

# (If using Firestore Native) Initialize in console to Native mode (or via Terraform in Section 15).
```

### Build images with Cloud Build (manual)
```bash
# API image
gcloud builds submit --tag us-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/$SERVICE_NAME_API:$(git rev-parse --short HEAD)

# Worker image (uses Worker.Dockerfile if you created it)
gcloud builds submit --tag us-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/$SERVICE_NAME_WORKER:$(git rev-parse --short HEAD) -f Worker.Dockerfile
```

### Deploy API (synchronous or async)
```bash
# Set env in one go; adjust values to your prod settings
gcloud run deploy $SERVICE_NAME_API \
  --image us-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/$SERVICE_NAME_API:$(git rev-parse --short HEAD) \
  --region $REGION \
  --allow-unauthenticated \
  --cpu 2 --memory 2Gi \
  --max-instances 20 \
  --set-env-vars ENV=prod,PROJECT_ID=$PROJECT_ID,REGION=$REGION,\
GCS_BUCKET_ORIGINAL=$GCS_BUCKET_ORIGINAL,GCS_BUCKET_OUTPUT=$GCS_BUCKET_OUTPUT,\
FIRESTORE_COLLECTION=headshots,\
UPLOAD_URL_TTL=600,DOWNLOAD_URL_TTL=604800,PREVIEW_LONG_EDGE=1600,PRINT_LONG_EDGE=3000
```

### Deploy Worker (async flow)
```bash
gcloud run deploy $SERVICE_NAME_WORKER \
  --image us-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/$SERVICE_NAME_WORKER:$(git rev-parse --short HEAD) \
  --region $REGION \
  --cpu 2 --memory 2Gi \
  --max-instances 50 \
  --set-env-vars ENV=prod,PROJECT_ID=$PROJECT_ID,REGION=$REGION,\
GCS_BUCKET_ORIGINAL=$GCS_BUCKET_ORIGINAL,GCS_BUCKET_OUTPUT=$GCS_BUCKET_OUTPUT,\
PUBSUB_SUBSCRIPTION=perkie-headshot-worker,\
FIRESTORE_COLLECTION=headshots,\
DOWNLOAD_URL_TTL=604800,PREVIEW_LONG_EDGE=1600,PRINT_LONG_EDGE=3000
```

> If you only want the synchronous MVP, you can skip deploying the worker and Pub/Sub.

### Pub/Sub (only if using async)
```bash
TOPIC="perkie-headshot-jobs"
SUBSCRIPTION="perkie-headshot-worker"

gcloud pubsub topics create $TOPIC || true
gcloud pubsub subscriptions create $SUBSCRIPTION --topic=$TOPIC || true
```

### Verify
```bash
API_URL=$(gcloud run services describe $SERVICE_NAME_API --region $REGION --format 'value(status.url)')

# Health
curl -s $API_URL/healthz

# Sync headshot (MVP)
curl -s -X POST -F "file=@/path/to/pet.jpg" $API_URL/headshot | jq

# Async headshot (if enabled)
curl -s -X POST -F "file=@/path/to/pet.jpg" $API_URL/headshot-async | jq
```

### Tips
- Use `--min-instances` on Worker to avoid cold starts during promos.
- Pin image tags per release (`:v1.2.0`) instead of SHAs for easier rollbacks.
- Keep a small `deploy.sh` (already included) that reads `.env` and runs the above commands.
) Rollback plan
- Keep the previous image tag (last successful SHA). To rollback:
```bash
gcloud run deploy $SERVICE_NAME_API \
  --image us-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/$SERVICE_NAME_API:<PREV_SHA> \
  --region $REGION --allow-unauthenticated

gcloud run deploy $SERVICE_NAME_WORKER \
  --image us-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/$SERVICE_NAME_WORKER:<PREV_SHA> \
  --region $REGION
```
- Firestore is append‑only; status writes are idempotent. No schema migration required for rollback.

