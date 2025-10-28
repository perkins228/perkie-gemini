# Gemini Artistic API

Generate artistic pet portraits with automatic headshot framing using Google's Gemini 2.5 Flash Image model.

## Overview

This API provides three artistic portrait styles:
- **Black & White Fine Art Portrait** - Dramatic lighting, museum-quality aesthetics
- **Modern Ink & Wash** - East Asian brush painting style
- **Charcoal Realism** - Hand-drawn charcoal portrait study

### Key Features

- **Automatic Headshot Framing**: All styles frame pets as professional headshots
- **Smart Multi-Pet Handling**: Intelligent grouping or selection logic
- **Rate Limiting**: Three-tier system (customer/session/IP) with Firestore
- **Caching & Deduplication**: SHA256-based image caching to save costs
- **Cost Controls**: $10/day hard cap with configurable alerts

## Architecture

```
Frontend (Shopify Theme)
    ↓ HTTPS
Gemini Artistic API (Cloud Run - CPU only)
    ↓
├─→ Gemini 2.5 Flash Image API
├─→ Firestore (rate limiting)
└─→ Cloud Storage (image persistence)
```

## Quick Start

### Local Testing

1. **Install Dependencies**
```bash
pip install -r requirements.txt
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Run Locally**
```bash
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8080
```

4. **Test Health Endpoint**
```bash
curl http://localhost:8080/health
```

### Cloud Run Deployment

1. **Make Deployment Script Executable**
```bash
chmod +x scripts/deploy-gemini-artistic.sh
```

2. **Deploy**
```bash
./scripts/deploy-gemini-artistic.sh
```

3. **Verify Deployment**
```bash
# Set service URL (from deployment output)
export API_URL="https://gemini-artistic-api-XXXXXX.run.app"

# Test health endpoint
curl $API_URL/health
```

## API Endpoints

### GET /health
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "model": "gemini-2.5-flash-image",
  "timestamp": "2025-10-23T12:34:56Z"
}
```

### GET /api/v1/quota
Check remaining quota without generating.

**Query Parameters**:
- `customer_id` (optional): Customer ID
- `session_id` (optional): Session ID

**Response**:
```json
{
  "allowed": true,
  "remaining": 4,
  "limit": 5,
  "reset_time": "2025-10-24T00:00:00Z"
}
```

### POST /api/v1/generate
Generate artistic portrait with headshot framing.

**Request Body**:
```json
{
  "image_data": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "style": "bw_fine_art",  // or "ink_wash" or "charcoal_realism"
  "customer_id": "customer_12345",  // optional
  "session_id": "session_abc123"    // optional
}
```

**Response** (Success):
```json
{
  "success": true,
  "image_url": "https://storage.googleapis.com/...",
  "original_url": "https://storage.googleapis.com/...",
  "style": "bw_fine_art",
  "cache_hit": false,
  "quota_remaining": 4,
  "quota_limit": 5,
  "processing_time_ms": 2847
}
```

**Response** (Rate Limited):
```json
{
  "detail": "Rate limit exceeded. Resets at 2025-10-24T00:00:00Z"
}
```
Status: 429 Too Many Requests

## Configuration

### Environment Variables

Required variables in `.env`:

```bash
# Google Cloud Project
PROJECT_ID=perkieprints-nanobanana
PROJECT_NUMBER=753651513695

# Gemini API
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-2.5-flash-image

# Rate Limiting
RATE_LIMIT_DAILY=5      # Customer/IP limit per day
RATE_LIMIT_BURST=3      # Session limit per day

# Storage
STORAGE_BUCKET=perkieprints-processing-cache
CACHE_TTL_SECONDS=604800  # 7 days

# Cost Controls
DAILY_COST_CAP=10.0     # $10/day hard cap
```

### Rate Limits

Three-tier system with priority:

1. **Customer ID** (logged in users): 5 generations/day
2. **Session ID** (anonymous users): 3 generations/day
3. **IP Address** (fallback): 5 generations/day

### Caching Strategy

Images are cached using SHA256 hash:
- **Cache key**: `{image_hash}_{style}.jpg`
- **Cache hit**: Returns instantly without consuming quota
- **Deduplication**: Same image uploaded multiple times = single storage entry

## Cost Structure

**Conservative Estimate** (4,000 generations/month):
- Gemini API: 4,000 × $0.039 = $156/month
- Cloud Run (CPU): ~$0.05/month (scales to zero)
- Cloud Storage: ~$1/month
- Firestore: Free tier (50K reads/day)
- **Total**: ~$157/month

**With 30% Cache Hit Rate**:
- Effective cost: ~$110/month

**Daily Cap**: $10/day = $300/month maximum

## Headshot Framing Logic

All styles follow this process:

1. **Identify** pets in image
2. **Frame** as headshot (head + neck + upper shoulders)
3. **Multi-pet logic**:
   - Touching pets → Group headshot
   - Separated but all clear → Group headshot
   - Separated with mixed focus → Select clearest pet
4. **Remove background** completely
5. **Apply artistic style** with specific techniques

## Testing

### Test with Sample Image

```bash
# Create test image (base64)
base64 test_pet.jpg > test_image.b64

# Test generation
curl -X POST "http://localhost:8080/api/v1/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "data:image/jpeg;base64,<BASE64_HERE>",
    "style": "bw_fine_art",
    "session_id": "test_session"
  }'
```

### Test Rate Limiting

```bash
# Session limit is 3/day
# This should work (1st request)
curl -X POST "$API_URL/api/v1/generate" -d '...' # quota_remaining: 2

# This should work (2nd request)
curl -X POST "$API_URL/api/v1/generate" -d '...' # quota_remaining: 1

# This should work (3rd request)
curl -X POST "$API_URL/api/v1/generate" -d '...' # quota_remaining: 0

# This should fail with 429 (4th request)
curl -X POST "$API_URL/api/v1/generate" -d '...' # Rate limit exceeded
```

### Test Cache Hits

```bash
# Upload same image + style twice
# 1st request: cache_hit: false, processing_time_ms: ~3000
curl -X POST "$API_URL/api/v1/generate" -d '...'

# 2nd request: cache_hit: true, processing_time_ms: 0, quota unchanged
curl -X POST "$API_URL/api/v1/generate" -d '...'
```

## Troubleshooting

### Issue: Gemini API returns "Invalid model"
**Solution**: Verify model name is exactly "gemini-2.5-flash-image" (not 2.0, not standard 2.5)

### Issue: Rate limiting not working
**Solution**: Check Firestore permissions:
```bash
gcloud services enable firestore.googleapis.com
```

### Issue: Storage URLs return 404
**Solution**: Verify bucket exists and has correct permissions:
```bash
gsutil ls gs://perkieprints-processing-cache
```

### Issue: Slow response times
**Solution**: Increase CPU allocation in `deploy-gemini-artistic.yaml`:
```yaml
resources:
  limits:
    cpu: "4000m"  # Increase from 2000m
    memory: "4Gi"
```

## Project Structure

```
backend/gemini-artistic-api/
├── requirements.txt              # Python dependencies
├── .env.example                  # Environment template
├── .gitignore                    # Git exclusions
├── README.md                     # This file
├── Dockerfile                    # Container build
├── deploy-gemini-artistic.yaml   # Cloud Run config
├── src/
│   ├── __init__.py
│   ├── config.py                 # Settings
│   ├── main.py                   # FastAPI app
│   ├── core/
│   │   ├── __init__.py
│   │   ├── gemini_client.py      # Gemini API wrapper
│   │   ├── rate_limiter.py       # Firestore rate limiting
│   │   └── storage_manager.py    # Cloud Storage + caching
│   └── models/
│       ├── __init__.py
│       └── schemas.py            # Pydantic models
└── scripts/
    └── deploy-gemini-artistic.sh # Deployment automation
```

## Security Considerations

- **No Authentication**: API uses rate limiting only (add auth for production)
- **API Keys**: Never commit `.env` file to git
- **Service Account**: Cloud Run uses dedicated service account with minimal permissions
- **CORS**: Currently allows all origins (update for production)

## Next Steps

1. **Deploy Backend** ✓ (You're here!)
2. **Create Frontend Components** (Week 2)
   - `assets/artistic-styles.js` (ES5 compatible)
   - Portrait Styles UI component
   - Comparison viewer
3. **Shopify Integration** (Week 3)
   - Add to `sections/ks-pet-bg-remover.liquid`
   - Session management hooks
4. **A/B Testing** (Week 4)
   - 30-day test: +3% conversion OR +5% AOV to proceed

## License

Proprietary - Perkie Prints
