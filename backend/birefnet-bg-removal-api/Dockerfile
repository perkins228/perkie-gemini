# BiRefNet Background Removal API
# Optimized for Google Cloud Run with GPU
#
# Build: docker build -t birefnet-bg-removal-api .
# Run locally: docker run -p 8080:8080 --gpus all birefnet-bg-removal-api

FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    libglib2.0-0 \
    libgl1 \
    libgles2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/models /app/cache /app/logs /app/src

# Create __init__.py
RUN touch /app/src/__init__.py

# Copy requirements first (for Docker layer caching)
COPY requirements.txt .

# Install PyTorch with CUDA support
# Using CUDA 11.8 for Cloud Run GPU compatibility
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu118

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt

# ============================================================
# MODEL BAKING: Pre-download models during build
# This eliminates cold start download time (saves 30-40 seconds total)
# ============================================================

# Set HuggingFace cache directory
ENV HF_HOME=/app/models/huggingface
ENV TRANSFORMERS_CACHE=/app/models/huggingface
RUN mkdir -p $HF_HOME

# ============================================================
# 1. Pre-download BiRefNet_HR-matting model
# Trained on fine hair/fur details (better for pet photos than portrait variant)
# ============================================================
RUN python3 -c "\
import os; \
os.environ['HF_HOME'] = '/app/models/huggingface'; \
from transformers import AutoModelForImageSegmentation; \
print('Downloading BiRefNet_HR-matting model...'); \
model = AutoModelForImageSegmentation.from_pretrained('ZhengPeng7/BiRefNet_HR-matting', trust_remote_code=True); \
print('BiRefNet_HR-matting model downloaded successfully'); \
del model; \
"

# Verify BiRefNet model is cached
RUN python3 -c "\
import os; \
os.environ['HF_HOME'] = '/app/models/huggingface'; \
from transformers import AutoModelForImageSegmentation; \
model = AutoModelForImageSegmentation.from_pretrained('ZhengPeng7/BiRefNet_HR-matting', trust_remote_code=True); \
print('BiRefNet_HR-matting verification successful - cached'); \
del model; \
"

# ============================================================
# 2. Pre-download Real-ESRGAN model weights (ai-forever implementation)
# Using HuggingFace Hub for reliable model downloads
# ============================================================
ENV ESRGAN_MODEL_DIR=/app/models/esrgan
RUN mkdir -p $ESRGAN_MODEL_DIR

# Download x2 model weights from Hugging Face
RUN python3 -c "\
import os; \
os.environ['ESRGAN_MODEL_DIR'] = '/app/models/esrgan'; \
from huggingface_hub import hf_hub_download; \
print('Downloading RealESRGAN_x2.pth from ai-forever...'); \
hf_hub_download( \
    repo_id='ai-forever/Real-ESRGAN', \
    filename='RealESRGAN_x2.pth', \
    local_dir='/app/models/esrgan', \
    local_dir_use_symlinks=False \
); \
print('Real-ESRGAN x2 model downloaded successfully'); \
"

# Verify ESRGAN loads correctly with ai-forever implementation
# Note: Add huggingface_hub compatibility shim for cached_download (removed in 0.20.0)
RUN python3 -c "\
import os, torch, huggingface_hub; \
setattr(huggingface_hub, 'cached_download', lambda *a, **k: None) if not hasattr(huggingface_hub, 'cached_download') else None; \
os.environ['ESRGAN_MODEL_DIR'] = '/app/models/esrgan'; \
from RealESRGAN import RealESRGAN; \
device = torch.device('cpu'); \
model = RealESRGAN(device, scale=2); \
model.load_weights('/app/models/esrgan/RealESRGAN_x2.pth', download=False); \
print('Real-ESRGAN verification successful - model loads correctly'); \
"

# Copy application code
COPY src/ ./src/

# Set Python path
ENV PYTHONPATH=/app/src:$PYTHONPATH

# Verify critical imports
RUN python3 -c "\
import fastapi; \
import uvicorn; \
import torch; \
from transformers import AutoModelForImageSegmentation; \
import psutil; \
print('All critical dependencies working'); \
print(f'PyTorch version: {torch.__version__}'); \
print(f'CUDA available: {torch.cuda.is_available()}'); \
"

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# Expose port
EXPOSE 8080

# Runtime environment variables
ENV PORT=8080
ENV HOST=0.0.0.0

# BiRefNet configuration (transformers/HuggingFace)
# Using BiRefNet_HR-matting for fine fur/hair detail (optimized for pet photos)
ENV BIREFNET_MODEL_VARIANT=ZhengPeng7/BiRefNet_HR-matting
ENV BIREFNET_MAX_DIMENSION=1024
ENV MAX_IMAGE_SIZE_MB=30
ENV ENABLE_WARMUP_ON_STARTUP=true
ENV LOG_LEVEL=info

# HuggingFace cache (must match build-time location)
ENV HF_HOME=/app/models/huggingface
ENV TRANSFORMERS_CACHE=/app/models/huggingface

# ESRGAN model cache (must match build-time location)
ENV ESRGAN_MODEL_DIR=/app/models/esrgan

# CORS configuration (update for production)
ENV CORS_ORIGINS=*

# Start the application
CMD ["python", "src/main.py"]
