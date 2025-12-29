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
# MODEL BAKING: Pre-download BiRefNet model during build
# This eliminates cold start download time (saves 10-20 seconds)
# Uses HuggingFace transformers for native PyTorch GPU support
# ============================================================

# Set HuggingFace cache directory
ENV HF_HOME=/app/models/huggingface
ENV TRANSFORMERS_CACHE=/app/models/huggingface
RUN mkdir -p $HF_HOME

# Pre-download the BiRefNet model via transformers
# This downloads model weights during build to avoid cold start delay
RUN python3 -c "\
import os; \
os.environ['HF_HOME'] = '/app/models/huggingface'; \
from transformers import AutoModelForImageSegmentation; \
print('Downloading BiRefNet-portrait model via transformers...'); \
model = AutoModelForImageSegmentation.from_pretrained('ZhengPeng7/BiRefNet-portrait', trust_remote_code=True); \
print('BiRefNet-portrait model downloaded successfully'); \
del model; \
"

# Verify the model is cached and loadable
RUN python3 -c "\
import os; \
os.environ['HF_HOME'] = '/app/models/huggingface'; \
from transformers import AutoModelForImageSegmentation; \
model = AutoModelForImageSegmentation.from_pretrained('ZhengPeng7/BiRefNet-portrait', trust_remote_code=True); \
print('Model verification successful - cached at /app/models/huggingface'); \
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
ENV BIREFNET_MODEL_VARIANT=ZhengPeng7/BiRefNet-portrait
ENV BIREFNET_MAX_DIMENSION=2048
ENV MAX_IMAGE_SIZE_MB=30
ENV ENABLE_WARMUP_ON_STARTUP=true
ENV LOG_LEVEL=info

# HuggingFace cache (must match build-time location)
ENV HF_HOME=/app/models/huggingface
ENV TRANSFORMERS_CACHE=/app/models/huggingface

# CORS configuration (update for production)
ENV CORS_ORIGINS=*

# Start the application
CMD ["python", "src/main.py"]
