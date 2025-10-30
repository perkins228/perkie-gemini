# Infrastructure Decisions Archive
*Archived: 2025-08-29*

## Summary
GPU configuration, deployment fixes, and Cloud Run optimizations.

## Key Files
- `deployment-and-gpu-fixes.md` - All infrastructure decisions

## Critical Fixes
1. **GPU Quota**: Reduced from 3 to 1 (maxScale=1)
2. **Min Instances**: MUST stay at 0 (save $65/day)
3. **Share Endpoint**: Fixed 404 with proper deployment
4. **GCS Bucket**: Configured environment variables

## Cost Management
- Accept 30-60s cold starts
- NEVER set minInstances > 0
- Use frontend warming strategies
- Cache aggressively

## Deployment Process
```bash
git push origin staging  # Auto-deploys to Shopify
gcloud run services replace --region=us-central1 < deploy.yaml  # For API
```