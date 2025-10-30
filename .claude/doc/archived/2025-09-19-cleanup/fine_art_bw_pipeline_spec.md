
# Fine‑Art Black & White Pipeline — Implementation Spec (v1.0)

Author: ChatGPT  
Last updated: 2025‑08‑27

---

## Goal

Implement a **deterministic, production‑ready** pipeline that converts ordinary smartphone images (JPEG/HEIC/RAW) into **fine‑art black & white** renders suitable for large‑format printing. The pipeline mirrors a darkroom: exposure → development → printing. It is batch‑friendly, GPU‑optional, and safe for automation (no GUI dependencies).

---

## TL;DR (Order of Operations)

> **Mask/segment (optional) → Load @ 16‑bit → Linearize (de‑gamma) → Luminance via channel‑mix → Edge‑aware local contrast → Filmic sigmoid (tone map w/ highlight protection) → Optional dodge/burn → Add grain → Output‑sharpen → Export (TIFF/JPEG‑XL/HEIC).**

Why this order: edge‑aware/contrast tools and tone math behave correctly on **linear** data; tone‑map late to preserve headroom; texture (grain/sharpen) last to match final pixel pitch.

---

## Tech Stack

- **Language:** Python 3.10+
- **Core libs:** `numpy`, `opencv-python-headless`, `scikit-image` (≥ 0.20 for `local_laplacian`), `tifffile`
- **Optional:** `rawpy` (RAW support), `pillow`/`pillow-heif` (HEIC/HEIF), `fastapi` (service), `uvicorn` (ASGI), `pyyaml` (config)
- **Hardware:** CPU‑first. Optional GPU via CuPy drop‑in (`cupy`), not required.

### Install

```bash
pip install numpy opencv-python-headless scikit-image tifffile pillow pillow-heif rawpy pyyaml fastapi uvicorn
```

---

## Directory Layout

```
bw_pipeline/
  __init__.py
  config.yaml                # defaults; can override via CLI or API
  io_utils.py                # load/save helpers
  core.py                    # transformations (linearize, mix, contrast, tone, grain, sharpen)
  pipeline.py                # orchestration
  mask_utils.py              # optional background removal integration
  cli.py                     # command line interface
  server.py                  # FastAPI app
  tests/
    test_core.py
    test_pipeline.py
  examples/
    sample.jpg
    README.md
```

---

## Configuration (YAML)

```yaml
# config.yaml
io:
  bit_depth: 16           # internal processing depth
  color_space: sRGB

mono:
  # Channel mix approximating coloured glass filters; values sum ~1.0
  weights: [0.35, 0.55, 0.10]  # red‑filter look (R,G,B)
  preserve_max_channel: false  # if true, maxRGB as luma guard for speculars

local_contrast:
  method: "local_laplacian"    # or "bilateral" fallback
  sigma: 0.5                   # detail scale (0.3‑1.2 typical)
  alpha: 2.0                   # detail amplification (1.0‑3.0)
  beta: 0.0                    # tone factor (keep 0 for detail‑only)

tone_map:
  mode: "filmic_sigmoid"
  contrast: 1.8                # slope
  pivot: 0.18                  # middle‑gray
  black_clip: 1.0e-6           # floor before log/exp ops

dodge_burn:
  enabled: false
  strength: 0.08               # ± percent in log domain
  radius: 35                   # px, gaussian

grain:
  enabled: true
  strength: 0.01               # stdev (0.006‑0.02)
  size_sigma: 0.5              # blur size for soft clumps

sharpen:
  enabled: true
  method: "usm"                # unsharp mask
  radius: 0.6                  # px
  amount: 1.0
  threshold: 0.01

export:
  format: "tiff"               # tiff|jpegxl|heic|png
  tiff_compression: "lzw"
  quality: 95                  # for lossy formats
  keep_alpha: true
```

---

## Core Algorithms (Python)

> Note: All math is **linear‑light** unless stated otherwise.

### 1) Linearize (de‑gamma sRGB → linear)

```python
import numpy as np

def to_linear_srgb(img_f32):  # img in [0,1] float32, sRGB gamma
    # piecewise sRGB EOTF for accuracy
    a = 0.055
    lin = np.where(img_f32 <= 0.04045,
                   img_f32 / 12.92,
                   ((img_f32 + a) / (1 + a)) ** 2.4)
    return lin
```

### 2) Luminance via channel mix (artistic panchro / color‑filter emulation)

```python
def channel_mix_luma(lin_rgb, weights=(0.35, 0.55, 0.10)):
    w = np.asarray(weights, dtype=np.float32)
    w /= w.sum()
    return lin_rgb @ w  # tensordot equivalent
```

### 3) Edge‑aware Local Contrast (Local Laplacian preferred)

```python
from skimage.filters import local_laplacian
from cv2 import bilateralFilter

def boost_local_contrast(luma, method="local_laplacian", sigma=0.5, alpha=2.0, beta=0.0):
    if method == "local_laplacian":
        # luma expected in [0,1]
        return local_laplacian(luma, sigma=sigma, alpha=alpha, beta=beta)
    # Fallback: detail = luma - bilateral(luma); then add scaled detail
    blur = bilateralFilter((luma*65535).astype(np.float32), d=0, sigmaColor=12, sigmaSpace=9) / 65535.0
    detail = luma - blur
    return np.clip(luma + alpha * detail, 0, 1)
```

### 4) Filmic sigmoid (global tone‑map w/ highlight protection)

```python
def filmic_sigmoid(x, contrast=1.8, pivot=0.18, eps=1e-6):
    x = np.clip(x, eps, 1.0)
    y = 1.0 / (1.0 + np.exp(-contrast * (np.log2(x / pivot))))
    y /= y.max()  # normalize to 1
    return y
```

### 5) Optional Dodge & Burn (log‑domain, exposure‑invariant)

```python
import cv2

def dodge_burn(luma, strength=0.08, radius=35):
    base = cv2.GaussianBlur(luma, (0,0), radius)
    ratio = np.log(np.clip(luma, 1e-6, 1)) - np.log(np.clip(base, 1e-6, 1))
    return np.clip(luma + strength * ratio, 0, 1)
```

### 6) Grain (luma‑weighted, soft clumps)

```python
def add_grain(luma, strength=0.01, size_sigma=0.5):
    noise = np.random.normal(0.0, strength, luma.shape).astype(np.float32)
    import cv2
    clump = cv2.GaussianBlur(np.abs(noise), (0,0), size_sigma)
    return np.clip(luma + clump * (luma ** 0.7), 0, 1)
```

### 7) Output Sharpen (USM tuned for final pixel pitch)

```python
def unsharp_mask(img, radius=0.6, amount=1.0, threshold=0.01):
    import cv2
    blur = cv2.GaussianBlur(img, (0,0), radius)
    resid = img - blur
    mask = np.abs(resid) > threshold
    out = img.copy()
    out[mask] = np.clip(img[mask] + amount * resid[mask], 0, 1)
    return out
```

---

## Orchestrated Pipeline

```python
from dataclasses import dataclass
from typing import Tuple, Optional
import numpy as np

@dataclass
class BWConfig:
    weights: Tuple[float,float,float] = (0.35, 0.55, 0.10)
    lc_method: str = "local_laplacian"
    lc_sigma: float = 0.5
    lc_alpha: float = 2.0
    lc_beta: float = 0.0
    tone_contrast: float = 1.8
    tone_pivot: float = 0.18
    dodge_burn_enabled: bool = False
    dodge_burn_strength: float = 0.08
    dodge_burn_radius: float = 35.0
    grain_enabled: bool = True
    grain_strength: float = 0.01
    grain_size_sigma: float = 0.5
    sharpen_enabled: bool = True
    sharpen_radius: float = 0.6
    sharpen_amount: float = 1.0
    sharpen_threshold: float = 0.01

def pipeline_rgb_to_bw(rgb_u16: np.ndarray, cfg: BWConfig) -> np.ndarray:
    """
    rgb_u16: HxWx3 uint16 in sRGB space. Returns HxW float32 mono in [0,1].
    """
    img = rgb_u16.astype(np.float32) / 65535.0
    lin = to_linear_srgb(img)
    luma = channel_mix_luma(lin, cfg.weights)
    luma = boost_local_contrast(luma, cfg.lc_method, cfg.lc_sigma, cfg.lc_alpha, cfg.lc_beta)
    if cfg.dodge_burn_enabled:
        luma = dodge_burn(luma, cfg.dodge_burn_strength, cfg.dodge_burn_radius)
    luma = filmic_sigmoid(luma, cfg.tone_contrast, cfg.tone_pivot)
    if cfg.grain_enabled:
        luma = add_grain(luma, cfg.grain_strength, cfg.grain_size_sigma)
    if cfg.sharpen_enabled:
        luma = unsharp_mask(luma, cfg.sharpen_radius, cfg.sharpen_amount, cfg.sharpen_threshold)
    return luma
```

---

## Optional: Background Removal → Then B&W

If you plan to remove background, **mask first** in RGB, then process the subject crop via the pipeline above and composite later. Keep the alpha channel (`export.keep_alpha: true`).

`mask_utils.py` should expose:
```python
def segment_foreground(rgb_u8: np.ndarray) -> np.ndarray:
    """Return HxW float32 mask in [0,1]. Placeholder for CNN or colour key."""
```

---

## I/O Helpers

```python
import cv2, tifffile as tiff
import numpy as np

def load_image_u16(path: str):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(path)
    if img.dtype == np.uint8:
        img = (img.astype(np.uint16) * 257)  # 8‑bit to 16‑bit widen
    if img.ndim == 2:
        img = np.stack([img, img, img], axis=-1)
    return img

def save_mono(path: str, mono_f32: np.ndarray, fmt="tiff", quality=95):
    arr16 = (np.clip(mono_f32,0,1)*65535).astype(np.uint16)
    if fmt == "tiff":
        tiff.imwrite(path, arr16, photometric='minisblack', compression='lzw')
    elif fmt in ("jpg","jpeg","jpegxl","png","heic"):
        import cv2
        rgb = cv2.merge([arr16, arr16, arr16])
        if fmt in ("jpg","jpeg"):
            cv2.imwrite(path, (rgb/257).astype(np.uint8), [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        else:
            cv2.imwrite(path, (rgb/257).astype(np.uint8))
    else:
        raise ValueError(f"Unsupported format: {fmt}")
```

---

## CLI

```bash
python -m bw_pipeline.cli \
  --input ./examples/sample.jpg \
  --output ./out/sample_bw.tif \
  --weights 0.35 0.55 0.10 \
  --contrast 1.8 --pivot 0.18 \
  --grain 0.01 --sharpen 0.6 1.0 0.01
```

`cli.py` parses args, loads YAML, overrides flags, runs `pipeline_rgb_to_bw`, and saves.

---

## FastAPI Service (for Shopify/App integration)

```python
# server.py
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import numpy as np
import cv2, base64
from .pipeline import pipeline_rgb_to_bw, BWConfig

app = FastAPI()

@app.post("/process-bw")
async def process_bw(file: UploadFile = File(...)):
    raw = await file.read()
    img_arr = np.frombuffer(raw, np.uint8)
    rgb = cv2.imdecode(img_arr, cv2.IMREAD_UNCHANGED)
    if rgb.ndim == 2:
        rgb = cv2.cvtColor(rgb, cv2.COLOR_GRAY2RGB)
    rgb16 = (rgb.astype(np.uint16) * (257 if rgb.dtype==np.uint8 else 1))
    cfg = BWConfig()
    mono = pipeline_rgb_to_bw(rgb16, cfg)
    # return preview as PNG base64 (downscaled)
    preview = (np.clip(mono*255,0,255)).astype(np.uint8)
    scale = min(1024 / preview.shape[1], 1.0)
    if scale < 1.0:
        preview = cv2.resize(preview, (int(preview.shape[1]*scale), int(preview.shape[0]*scale)), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode(".png", preview)
    b64 = base64.b64encode(buf).decode("ascii")
    return JSONResponse({"preview_png_base64": b64})
```

---

## Quality Guardrails

- **No halos:** check the absolute difference between input luma and blurred version; clamp USM threshold accordingly.
- **Highlight safety:** never process values ≤ `black_clip`; tone‑map using smooth shoulder (sigmoid) to avoid clipping skies.
- **Determinism:** seed RNG for grain in batch processing where exact repeats are required.

### Unit Tests (pytest)

```python
def test_monotonic_tone_map():
    import numpy as np
    x = np.linspace(1e-6,1,1000).astype(np.float32)
    y = filmic_sigmoid(x, contrast=1.8, pivot=0.18)
    assert np.all(np.diff(y) > 0)

def test_pipeline_shape_dtype(sample_rgb_u16):
    from bw_pipeline.pipeline import pipeline_rgb_to_bw, BWConfig
    y = pipeline_rgb_to_bw(sample_rgb_u16, BWConfig())
    assert y.ndim == 2 and y.dtype == np.float32
```

---

## Performance Notes

- Prefer `local_laplacian` (vectorised); for very large images, tile process in 1024‑px strips with 32‑px overlap to avoid seams.
- For GPU: import `cupy as np` (drop‑in) after validating memory use; avoid mixing CuPy/NumPy in tight loops.

---

## Mermaid Dataflow (Optional)

```mermaid
flowchart LR
    A[Load @ 16‑bit] --> B[Linearize]
    B --> C[Channel Mix → Luma]
    C --> D[Edge‑aware Local Contrast]
    D --> E[Filmic Sigmoid Tone‑map]
    E -->|opt| F[Dodge & Burn]
    F --> G[Add Grain]
    G --> H[Output Sharpen]
    H --> I[Export TIFF/JPEG‑XL/HEIC]
```

---

## Acceptance Criteria

- **Visual:** No visible halos at 200% zoom; highlights roll‑off smoothly (no flat clipping), grain looks organic at 300 dpi prints.
- **Numeric:** Tone‑mapper strictly increasing; pipeline preserves > 90% edge energy (SSIM on Laplacian pyramid) on mid‑tones.
- **Throughput:** ≥ 10 MP/s on a modern 8‑core CPU for JPEG input, local_laplacian enabled.

---

## FAQ

**Q: Can we skip linearisation for speed?**  
A: Not recommended. Contrast math in gamma space yields dull mids & harsh highlights.

**Q: RAW vs JPEG?**  
A: If RAW is available, debayer + WB + linearise then continue. For JPEG/HEIC, widen to 16‑bit first and proceed.

**Q: Where to integrate background removal?**  
A: Before the pipeline, in RGB space. Run the pipeline on the subject crop; composite afterward.

---

## Changelog

- v1.0: Initial spec with code skeletons, CLI, and FastAPI service.
