# Perkie Prints System Overview

*Last Updated: December 11, 2025*

## Table of Contents
- [Business Overview](#business-overview)
- [Architecture Summary](#architecture-summary)
- [Git Workflow](#git-workflow)
- [Frontend (Shopify Theme)](#frontend-shopify-theme)
- [Backend APIs](#backend-apis)
- [Cloud Infrastructure](#cloud-infrastructure)
- [Deployment Process](#deployment-process)
- [Key URLs & Endpoints](#key-urls--endpoints)

---

## Business Overview

**Perkie Prints** is a custom e-commerce platform specializing in personalized pet products.

| Metric | Value |
|--------|-------|
| Mobile Traffic | 70% of orders |
| Primary Conversion Tool | FREE AI-powered pet background removal |
| Business Model | Background removal drives product sales (not a revenue source) |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    (Shopify Theme - Dawn)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Pet Processor   │  │ Pet Selector    │  │ Effects         │  │
│  │ (pet-processor  │  │ (ks-product-    │  │ Processor       │  │
│  │  .js)           │  │  pet-selector)  │  │                 │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼─────────────────────┼─────────────────────┼──────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND APIs                                │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │ InSPyReNet API          │  │ Gemini Artistic API         │   │
│  │ (Background Removal)    │  │ (AI Art Generation)         │   │
│  │ ⛔ PRODUCTION -         │  │ ✅ Active Development       │   │
│  │    DO NOT MODIFY        │  │                             │   │
│  │                         │  │ Model: gemini-2.5-flash     │   │
│  │ GPU: NVIDIA L4          │  │ SDK: google-genai==1.47.0   │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GOOGLE CLOUD PLATFORM                          │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │ Cloud Run               │  │ Cloud Storage               │   │
│  │ - inspirenet-bg-removal │  │ - perkieprints-processing   │   │
│  │ - gemini-artistic-api   │  │   -cache                    │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │ Firestore               │  │ Secret Manager              │   │
│  │ (Rate Limiting)         │  │ (API Keys)                  │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Git Workflow

### Branch Structure

| Branch | Purpose | Shopify Theme | Auto-Deploy |
|--------|---------|---------------|-------------|
| `main` | Production | perkie-gemini/main | Yes |
| `staging` | Testing/Staging | perkie-gemini/staging | Yes |

### Deployment Flow

```
Local Changes → Git Push → GitHub → Shopify Auto-Sync (1-2 min)
```

### Common Commands

```bash
# Merge staging to production
git checkout main
git pull origin main
git merge origin/staging -m "Merge staging to production"
git push origin main

# Sync main back to staging
git checkout staging
git pull origin staging
git merge origin/main -m "Sync staging with main"
git push origin staging
```

---

## Frontend (Shopify Theme)

### Key Files

| File | Purpose |
|------|---------|
| `assets/pet-processor.js` | Main pet background removal logic |
| `snippets/ks-product-pet-selector-stitch.liquid` | Pet selection UI component |
| `sections/ks-pet-bg-remover.liquid` | Background remover section |
| `templates/page.pet-background-remover.json` | Background remover page template |

### Session Management

- Pet data stored in `localStorage`
- Emergency cleanup: `PetStorage.emergencyCleanup()`
- Automatic session restoration on page reload

---

## Backend APIs

### 1. InSPyReNet Background Removal API

> ⛔ **PRODUCTION SERVICE - DO NOT MODIFY**

| Property | Value |
|----------|-------|
| Project | perkieprints-processing |
| Service | inspirenet-bg-removal-api |
| Region | us-central1 |
| GPU | NVIDIA L4 |
| URL | https://inspirenet-bg-removal-api-725543555429.us-central1.run.app |

**Endpoints:**
- `POST /remove-background` - Remove background from image
- `POST /api/v2/process` - Process image with effects
- `POST /api/v2/process-with-effects` - Enhanced processing
- `GET /health` - Health check
- `GET /warmup` - Model warmup

### 2. Gemini Artistic API

> ✅ **Active Development**

| Property | Value |
|----------|-------|
| Project | perkieprints-nanobanana |
| Project ID | gen-lang-client-0601138686 |
| Service | gemini-artistic-api |
| Region | us-central1 |
| URL | https://gemini-artistic-api-753651513695.us-central1.run.app |
| Model | gemini-2.5-flash-image |
| SDK | google-genai==1.47.0 |

**Endpoints:**
- `POST /api/v1/generate` - Generate artistic style
- `POST /api/v1/batch-generate` - Generate all styles
- `GET /api/v1/quota` - Check rate limit quota
- `GET /health` - Health check

**Source Files:**
```
backend/gemini-artistic-api/
├── src/
│   ├── main.py              # API entry point
│   ├── config.py            # Configuration
│   ├── core/
│   │   ├── gemini_client.py # Gemini API client
│   │   ├── rate_limiter.py  # Firestore rate limiting
│   │   └── storage_manager.py # Cloud Storage manager
│   └── models/
│       └── schemas.py       # Pydantic models
```

---

## Cloud Infrastructure

### Google Cloud Projects

| Project | ID | Purpose |
|---------|----|---------|
| perkieprints-processing | 725543555429 | Production BG removal (OFF-LIMITS) |
| perkieprints-nanobanana | gen-lang-client-0601138686 | Gemini API & testing |

### Cloud Storage Buckets

| Bucket | Purpose |
|--------|---------|
| perkieprints-processing-cache | Image caching with SHA256 deduplication |

### Cloud Run Configuration

| Setting | Value |
|---------|-------|
| Min Instances | 0 (scale to zero) |
| Max Instances | 5 |
| Memory | 2Gi |
| CPU | 2 |

---

## Deployment Process

### Shopify Theme (Frontend)

```bash
# Commits auto-deploy via GitHub integration
git add .
git commit -m "Description of changes"
git push origin main  # or staging
# Changes live in ~1-2 minutes
```

### Gemini Artistic API (Backend)

```bash
cd backend/gemini-artistic-api
./scripts/deploy-gemini-artistic.sh
```

Or manually:
```bash
gcloud run deploy gemini-artistic-api \
  --source . \
  --project gen-lang-client-0601138686 \
  --region us-central1 \
  --allow-unauthenticated
```

---

## Key URLs & Endpoints

### Production URLs

| Service | URL |
|---------|-----|
| Shopify Store | https://perkieprints.com |
| InSPyReNet API | https://inspirenet-bg-removal-api-725543555429.us-central1.run.app |
| Gemini Artistic API | https://gemini-artistic-api-753651513695.us-central1.run.app |

### Health Check Endpoints

```bash
# InSPyReNet (Production)
curl https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health

# Gemini Artistic
curl https://gemini-artistic-api-753651513695.us-central1.run.app/health
```

---

## Important Reminders

1. **NEVER modify** the production `perkieprints-processing` Google Cloud project
2. **NEVER modify** the production `inspirenet-bg-removal-api` service
3. **ALWAYS set** `min-instances: 0` for Cloud Run services
4. **ALWAYS** commit to the correct branch (`main` for production, `staging` for testing)
5. API keys are stored in **Google Cloud Secret Manager** - never commit them to git

---

## Troubleshooting

### Cold Start Times
- First API request takes ~30-60s due to model loading
- Use frontend pre-warming and accurate progress bars

### CORS Issues
- Check CORS configuration in API and Cloud Storage bucket

### Session Data Issues
- Use `PetStorage.emergencyCleanup()` to reset localStorage

### Shopify Sync Issues
- Check GitHub integration status in Shopify Admin
- Manually trigger "Pull from GitHub" if needed
