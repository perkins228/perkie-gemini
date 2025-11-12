# ============================================================================
# OPTIMIZED INSPIRENET API DOCKERFILE - Multi-Stage Build
# ============================================================================
# Goal: Reduce cold start time from 81-92s to 15-20s
#
# Optimizations:
# 1. Multi-stage build (reduce final image size 10GB → 6-8GB)
# 2. Bake InSPyReNet model into container (eliminate 10-20s download)
# 3. NVIDIA CUDA base (proper GPU support)
# 4. Minimal runtime dependencies
# 5. Layer caching optimization
#
# Expected cold start: 15-20s (75% improvement vs 81-92s)
# ============================================================================

# ============================================================================
# STAGE 1: BUILDER - Download dependencies and model
# ============================================================================
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04 AS builder

# Build arguments
ARG PYTHON_VERSION=3.11
ARG DEBIAN_FRONTEND=noninteractive

# Install Python and build dependencies
RUN apt-get update && apt-get install -y \
    python${PYTHON_VERSION} \
    python${PYTHON_VERSION}-dev \
    python3-pip \
    git \
    wget \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for python
RUN ln -sf /usr/bin/python${PYTHON_VERSION} /usr/bin/python3 && \
    ln -sf /usr/bin/python3 /usr/bin/python

# Upgrade pip
RUN python3 -m pip install --upgrade pip setuptools wheel

# Create build directory
WORKDIR /build

# Copy requirements
COPY requirements.txt .

# Install PyTorch with CUDA support (largest dependency - cache this layer)
RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cu118

# Install all other dependencies
RUN pip install --no-cache-dir -r requirements.txt

# ============================================================================
# CRITICAL OPTIMIZATION: Pre-download and cache InSPyReNet model
# This eliminates 10-20s model download on every cold start
# ============================================================================
RUN mkdir -p /root/.cache/transparent-background && \
    python3 -c "from transparent_background import Remover; \
    print('🔄 Downloading InSPyReNet model (368MB)...'); \
    r = Remover(mode='base'); \
    print('✅ Model downloaded and cached at /root/.cache/transparent-background')"

# Verify model was cached
RUN ls -lah /root/.cache/transparent-background/ && \
    echo "✅ Model cache verified"

# ============================================================================
# STAGE 2: RUNTIME - Minimal production image
# ============================================================================
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Runtime arguments
ARG PYTHON_VERSION=3.11
ARG DEBIAN_FRONTEND=noninteractive

# Install minimal runtime dependencies (no build tools!)
RUN apt-get update && apt-get install -y \
    python${PYTHON_VERSION} \
    python3-pip \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for python
RUN ln -sf /usr/bin/python${PYTHON_VERSION} /usr/bin/python3 && \
    ln -sf /usr/bin/python3 /usr/bin/python

# Create app directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/models /app/cache /app/logs /app/src

# Copy Python packages from builder (includes PyTorch, dependencies)
COPY --from=builder /usr/local/lib/python${PYTHON_VERSION}/dist-packages /usr/local/lib/python${PYTHON_VERSION}/dist-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# ============================================================================
# CRITICAL: Copy cached InSPyReNet model from builder stage
# This is the 10-20s cold start savings!
# ============================================================================
COPY --from=builder /root/.cache /root/.cache

# Verify model is present in runtime image
RUN echo "✅ Verifying model cache in runtime image..." && \
    ls -lah /root/.cache/transparent-background/ && \
    du -sh /root/.cache/transparent-background/

# Copy application code (do this LAST for better layer caching)
COPY src/ ./src/

# Set Python path
ENV PYTHONPATH=/app:$PYTHONPATH

# Verify critical imports
RUN python3 -c "import fastapi; import uvicorn; import torch; import transparent_background; print('✅ All critical dependencies working')"

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app && \
    chown -R app:app /root/.cache
USER app

# Expose port
EXPOSE 8080

# Runtime environment variables
ENV MODEL_PATH=/app/models/inspirenet.pth
ENV STORAGE_BUCKET=perkieprints-processing-cache
ENV TARGET_SIZE=1024
ENV INSPIRENET_MODE=base
ENV INSPIRENET_RESIZE=dynamic
ENV LOG_LEVEL=info
ENV CACHE_TTL=86400

# Enable GPU
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Start the application
CMD ["python", "src/main.py"]

# ============================================================================
# Build Instructions:
# docker build -t inspirenet-optimized:latest .
#
# Expected Image Size: 6-8GB (vs 10GB+ unoptimized)
# Expected Cold Start: 15-20s (vs 81-92s unoptimized)
# ============================================================================
