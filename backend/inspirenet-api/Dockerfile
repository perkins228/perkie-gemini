# Minimal InSPyReNet API for quick deployment
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV DEBIAN_FRONTEND=noninteractive

# Install minimal system dependencies
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
RUN mkdir -p /app/models /app/cache /app/logs /app/src /app/src/effects

# Create empty __init__.py files first
RUN touch /app/src/__init__.py /app/src/effects/__init__.py

# Copy requirements and install ALL dependencies
COPY requirements.txt .

# Install PyTorch with CUDA support first (to avoid conflicts)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu118

# No need to modify requirements.txt anymore as it already uses headless versions

# Install all remaining dependencies from requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Cache bust using Cloud Build ID - forces rebuild when source changes
ARG CACHEBUST=default
RUN echo "Build ID: ${CACHEBUST}"

# Copy application code
COPY src/ ./src/

# Set Python path
ENV PYTHONPATH=/app:$PYTHONPATH

# Create model info file
RUN echo '{"model_name": "InSPyReNet", "architecture": "Swin Transformer + Pyramid Decoder", "version": "2.0.0", "target_size": 1024}' > /app/models/model_info.json

# Verify critical imports including psutil
RUN python3 -c "import fastapi; import uvicorn; import torch; import psutil; import transparent_background; print('✅ All critical dependencies working')"

# Create non-root user
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
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

# Start the application
CMD ["python", "src/main.py"]
# Cache bust: CORS security hardening - Oct 5, 2025 - Remove rate_limit_middleware
