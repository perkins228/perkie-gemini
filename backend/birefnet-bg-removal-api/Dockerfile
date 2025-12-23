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
# ============================================================

# Set model cache directories
ENV U2NET_HOME=/app/models/u2net
ENV REMBG_MODELS_DIR=/app/models/rembg
RUN mkdir -p $U2NET_HOME $REMBG_MODELS_DIR

# Pre-download the BiRefNet model
# This runs the model initialization which triggers download
RUN python3 -c "\
import os; \
os.makedirs('/app/models/rembg', exist_ok=True); \
from rembg import new_session; \
print('Downloading BiRefNet-general model...'); \
session = new_session('birefnet-general'); \
print('BiRefNet-general model downloaded successfully'); \
"

# Verify the model is cached
RUN python3 -c "\
from rembg import new_session; \
session = new_session('birefnet-general'); \
print('Model verification successful'); \
"

# Copy application code
COPY src/ ./src/

# Set Python path
ENV PYTHONPATH=/app/src:$PYTHONPATH

# Verify critical imports
RUN python3 -c "\
import fastapi; \
import uvicorn; \
from rembg import new_session; \
import psutil; \
print('All critical dependencies working'); \
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
ENV BIREFNET_MODEL_VARIANT=birefnet-general
ENV BIREFNET_MAX_DIMENSION=2048
ENV MAX_IMAGE_SIZE_MB=30
ENV ENABLE_WARMUP_ON_STARTUP=true
ENV LOG_LEVEL=info

# CORS configuration (update for production)
ENV CORS_ORIGINS=*

# Start the application
CMD ["python", "src/main.py"]
