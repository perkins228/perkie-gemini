# Backend Services

This directory contains all backend services:

## inspirenet-api/
Main API for pet background removal with features:
- Background removal using AI models
- Multiple image effects (Black & White, Pop Art, etc.)
- Customer image storage with lifecycle management
- Caching and performance optimizations

### Quick Start
```bash
cd inspirenet-api
pip install -r requirements.txt
python src/main.py
```

### Deployment
The API is deployed on Google Cloud Run. See deployment guide in docs.

## image-processor/
Legacy image processing service (being phased out in favor of inspirenet-api).