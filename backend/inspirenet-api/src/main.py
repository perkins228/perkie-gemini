"""
Production InSPyReNet Background Removal API
High-quality pet background removal with v2 effects processing
"""

import os
import time
import asyncio
import logging
import json
from typing import Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from storage import CloudStorageManager
from api_v2_endpoints import router as api_v2_router, initialize_v2_api
from inspirenet_model import InSPyReNetProcessor
from customer_image_endpoints import router as customer_router, initialize_customer_storage
from memory_monitor import memory_monitor
from simple_storage_api import register_storage_endpoints

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global instances
processor: Optional[InSPyReNetProcessor] = None
storage_manager: Optional[CloudStorageManager] = None

# Add global model loading status
model_load_in_progress = False

# Initialize FastAPI app
app = FastAPI(
    title="InSPyReNet Background Removal API",
    description="Production API for pet background removal with effects processing",
    version="2.0.1"  # CORS security hardened
)

# Initialize rate limiter - 10 requests per minute per IP for processing endpoints
# This prevents API abuse while allowing normal usage patterns
# Health checks and GET requests are not rate limited
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Configuration - Explicit Origins for Security
# Production domains for Perkie Prints
ALLOWED_ORIGINS = [
    "https://perkieprints.com",
    "https://www.perkieprints.com",
]

# Add localhost for local development (only if DEV_MODE env var set)
if os.getenv("DEV_MODE") == "true":
    ALLOWED_ORIGINS.extend([
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ])

# ============================================================================
# MIDDLEWARE CONFIGURATION
# IMPORTANT: Add ALL middleware BEFORE including routers/registering endpoints
# ============================================================================

# Add CORS middleware with regex for Shopify preview domains (changes every 2 days)
# Production domains are explicit, Shopify staging uses regex pattern
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.shopifypreview\.com",  # Match any Shopify preview subdomain
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Only methods we actually use
    allow_headers=[
        "Content-Type",
        "X-Session-ID",
        "User-Agent",
        "Cache-Control",
        "X-Requested-With",
    ],
    expose_headers=[
        "Content-Length",
        "X-Processing-Time",
        "X-Cache-Hits",
        "X-Session-ID",
    ],
    max_age=3600  # Cache preflight requests for 1 hour
)

# Add gzip compression middleware for network optimization
# Base64 images compress very well (60-80% reduction typical)
# Minimum size set to 1KB to avoid compressing tiny responses
app.add_middleware(
    GZipMiddleware,
    minimum_size=1000,  # Only compress responses larger than 1KB
    compresslevel=6     # Balance between compression ratio and CPU usage
)

# Removed duplicate CORS middleware - CORSMiddleware above handles all CORS properly

# Rate limiting is handled by slowapi via @limiter.limit() decorators on individual endpoints
# See api_v2_endpoints.py for rate limit implementation on processing endpoints

@app.middleware("http")
async def memory_check_middleware(request, call_next):
    """Check memory before processing requests"""
    # Skip memory check for health endpoints, warmup, and OPTIONS
    if request.url.path in ["/health", "/warmup", "/", "/api/v2/"] or request.method == "OPTIONS":
        return await call_next(request)
    
    # Check memory pressure
    if memory_monitor.check_memory_pressure():
        logger.warning("Request rejected due to memory pressure")
        memory_monitor.log_memory_status()
        
        # Try cleanup
        memory_monitor.force_cleanup()
        
        # Check again after cleanup
        if memory_monitor.check_memory_pressure():
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=503,
                content={
                    "error": "Service temporarily unavailable due to high memory usage",
                    "retry_after": 30
                }
            )
    
    # Process request
    response = await call_next(request)
    
    # Cleanup after large responses
    if hasattr(response, 'status_code') and response.status_code == 200:
        if memory_monitor.should_cleanup():
            memory_monitor.force_cleanup()
    
    return response

# IMPORTANT: Register routers AFTER all middleware is configured
# This ensures middleware (CORS, GZip, memory checks) wraps all endpoints

# Include API v2 router (this has the JSON response functionality we need)
app.include_router(api_v2_router)

# Include customer image storage router
app.include_router(customer_router)

# Register simple storage endpoints
register_storage_endpoints(app)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global processor, storage_manager
    
    logger.info("Starting production InSPyReNet Background Removal API...")
    
    try:
        # Initialize storage manager
        bucket_name = os.getenv("STORAGE_BUCKET", "perkieprints-processing-cache")
        storage_manager = CloudStorageManager(bucket_name)
        
        # Initialize processor
        target_size = int(os.getenv("TARGET_SIZE", "1024"))
        mode = os.getenv("INSPIRENET_MODE", "base")
        resize_mode = os.getenv("INSPIRENET_RESIZE", "static")
        
        processor = InSPyReNetProcessor(
            target_size=target_size,
            mode=mode,
            resize_mode=resize_mode
        )
        
        logger.info("InSPyReNet processor initialized (model will load on first request)")
        
        # Initialize API v2 components (this includes the JSON response functionality)
        initialize_v2_api(storage_manager)
        logger.info("API v2 initialized with JSON response support")
        
        # Initialize customer image storage
        customer_bucket = os.getenv("CUSTOMER_STORAGE_BUCKET", "perkieprints-customer-images")
        initialize_customer_storage(customer_bucket)
        logger.info(f"Customer image storage initialized with bucket: {customer_bucket}")
        
        # Skip model loading during startup to prevent timeout
        # Model will be loaded lazily on first request or via warmup endpoint
        logger.info("Skipping model pre-loading during startup (will load on first request)")
        
        # Log configuration for debugging
        min_instances = int(os.getenv("MIN_INSTANCES", "0"))
        logger.info(f"Configuration: MIN_INSTANCES={min_instances}")
        
        logger.info("Production InSPyReNet API started successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise

@app.get("/")
@app.head("/")
async def root():
    """Root endpoint"""
    model_info = processor.get_model_info() if processor else {"status": "not_initialized"}
    
    return {
        "service": "InSPyReNet Background Removal API",
        "version": "2.0.0",
        "status": "healthy" if processor and processor.is_model_ready() else "initializing",
        "model": "InSPyReNet with Swin Transformer",
        "model_info": model_info
    }

@app.get("/health")
@app.head("/health")
async def health_check():
    """
    Enhanced health check endpoint with model loading status and optional async preloading.
    Provides detailed health information for monitoring and frontend warmup strategies.
    """
    start_time = time.time()
    
    # Check memory status
    memory_info = memory_monitor.get_memory_info()
    memory_healthy = not memory_monitor.check_memory_pressure()
    
    # Perform cleanup if needed
    if memory_monitor.should_cleanup():
        memory_monitor.force_cleanup()
    
    # Get detailed model status
    model_status = "not_initialized"
    model_ready = False
    model_loading = False
    model_load_progress = None
    
    if processor is not None:
        model_ready = processor.is_model_ready()
        model_loading = processor.load_start_time is not None
        
        if model_ready:
            model_status = "ready"
        elif model_loading:
            model_status = "loading"
            # Calculate loading time for progress indication
            if processor.load_start_time:
                loading_time = time.time() - processor.load_start_time
                model_load_progress = {
                    "loading_for_seconds": round(loading_time, 2),
                    "estimated_remaining": max(0, 30 - loading_time)  # Estimate based on typical load time
                }
        else:
            model_status = "initialized"
    
    # Determine overall health status
    overall_status = "healthy"
    if not memory_healthy:
        overall_status = "degraded"
    elif model_status == "not_initialized":
        overall_status = "degraded"
    elif model_status == "loading":
        overall_status = "warming"
    
    # Trigger async model preloading if model is not ready (optional optimization)
    preload_triggered = False
    if processor is not None and not model_ready and not model_loading:
        try:
            # Start model loading in background without blocking the health check
            # This is helpful for containers that haven't processed their first request yet
            logger.info("Health check triggering async model preload...")
            
            # Use asyncio to start loading without blocking
            asyncio.create_task(async_model_preload())
            preload_triggered = True
            model_status = "preloading"
            
        except Exception as e:
            logger.warning(f"Failed to trigger async model preload: {e}")
    
    health_response_time = time.time() - start_time
    
    return {
        "status": overall_status,
        "timestamp": time.time(),
        "response_time": round(health_response_time, 3),
        "model": {
            "status": model_status,
            "ready": model_ready,
            "loading": model_loading,
            "preload_triggered": preload_triggered,
            "load_progress": model_load_progress,
            "load_attempts": processor.load_attempts if processor else 0,
            "device": str(processor.device) if processor else None
        },
        "storage_connected": storage_manager is not None and storage_manager.enabled,
        "memory": {
            "healthy": memory_healthy,
            "cpu_mb": memory_info.get('cpu_memory_mb', 0),
            "cpu_percent": memory_info.get('cpu_memory_percent', 0),
            "available_mb": memory_info.get('available_memory_mb', 0),
            "gpu_mb": memory_info.get('gpu_memory_allocated_mb', 0),
            "gpu_percent": memory_info.get('gpu_memory_percent', 0) * 100 if 'gpu_memory_percent' in memory_info else 0
        },
        "endpoints": {
            "warmup_available": True,
            "processing_available": model_ready
        }
    }

async def async_model_preload():
    """Async helper function to preload model without blocking health checks"""
    global model_load_in_progress
    
    if processor is None or processor.is_model_ready() or model_load_in_progress:
        return
    
    try:
        model_load_in_progress = True
        logger.info("Starting async model preload...")
        
        # Load model in a separate thread to avoid blocking
        def load_in_thread():
            try:
                processor.load_model()
                logger.info("Async model preload completed successfully")
            except Exception as e:
                logger.error(f"Async model preload failed: {e}")
        
        # Run in thread pool to avoid blocking the event loop
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            await asyncio.get_event_loop().run_in_executor(executor, load_in_thread)
            
    except Exception as e:
        logger.error(f"Async model preload error: {e}")
    finally:
        model_load_in_progress = False

@app.get("/model-info")
async def model_info():
    """Get detailed model information"""
    if processor is None:
        return {"error": "Processor not initialized"}
    
    return processor.get_model_info()

@app.post("/warmup")
async def warmup():
    """
    Lightweight warmup endpoint that initializes the model with minimal processing.
    Designed for frontend warming strategies to reduce cold start impact.
    """
    if processor is None:
        return {
            "status": "error",
            "error": True,
            "message": "Processor not initialized",
            "warmup_time": 0,
            "model_ready": False
        }
    
    logger.info("Warmup endpoint called")
    start_time = time.time()
    
    try:
        # Use the processor's warmup method
        warmup_result = processor.warmup()
        
        # Add endpoint-specific metadata and error flag
        warmup_result.update({
            "endpoint": "/warmup",
            "timestamp": time.time(),
            "container_ready": True,
            "error": warmup_result.get("status") == "error"
        })

        logger.info(f"Warmup endpoint completed in {warmup_result.get('total_time', 0):.2f}s")
        return warmup_result
        
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"Warmup endpoint failed after {total_time:.2f}s: {e}")
        
        return {
            "status": "error",
            "error": True,
            "message": f"Warmup failed: {str(e)}",
            "error_type": type(e).__name__,
            "total_time": total_time,
            "model_ready": processor.is_model_ready() if processor else False,
            "endpoint": "/warmup",
            "timestamp": time.time(),
            "container_ready": True
        }

# OPTIONS endpoints removed - CORSMiddleware handles all preflight requests automatically

@app.post("/load-model")
async def load_model():
    """Manually trigger model loading"""
    global model_load_in_progress
    
    if processor is None:
        return {"error": "Processor not initialized"}
    
    if processor.is_model_ready():
        return {"status": "already_loaded", "message": "Model is already loaded and ready"}
    
    if model_load_in_progress:
        return {"status": "in_progress", "message": "Model loading is already in progress"}
    
    try:
        model_load_in_progress = True
        logger.info("Manual model load triggered via API")
        
        # Clear memory before loading
        memory_monitor.force_cleanup()
        
        # Load model
        processor.load_model()
        
        if processor.is_model_ready():
            return {
                "status": "success",
                "message": "Model loaded successfully",
                "model_info": processor.get_model_info()
            }
        else:
            return {
                "status": "failed",
                "message": "Model loading failed",
                "model_info": processor.get_model_info()
            }
            
    except Exception as e:
        logger.error(f"Manual model load failed: {e}")
        return {
            "status": "error",
            "message": f"Model loading error: {str(e)}",
            "error_type": type(e).__name__
        }
    finally:
        model_load_in_progress = False

# Add HTTP GET fallback for compatibility WebSocket endpoint
@app.get("/ws/progress/{session_id}")
async def progress_info_compatibility(session_id: str):
    """HTTP GET fallback for compatibility WebSocket endpoint"""
    from api_v2_endpoints import enhanced_progress_manager
    
    return {
        "endpoint": f"/ws/progress/{session_id}",
        "protocol": "WebSocket endpoint (use ws:// or wss://)",
        "session_id": session_id,
        "message": "This is a WebSocket endpoint. Use WebSocket protocol to connect.",
        "websocket_url": f"ws://your-domain/ws/progress/{session_id}",
        "enhanced_endpoint": f"/ws/enhanced-progress/{session_id}",
        "api_v2_enhanced_endpoint": f"/api/v2/ws/enhanced-progress/{session_id}",
        "note": "Consider using the enhanced WebSocket endpoint for better progress tracking",
        "progress_manager_status": "initialized" if enhanced_progress_manager else "not_initialized"
    }

# Add HTTP GET endpoint for enhanced WebSocket testing
@app.get("/ws/enhanced-progress/{session_id}")
async def enhanced_progress_info(session_id: str):
    """HTTP GET endpoint for enhanced WebSocket testing"""
    from api_v2_endpoints import enhanced_progress_manager
    
    return {
        "endpoint": f"/ws/enhanced-progress/{session_id}",
        "protocol": "WebSocket endpoint (use ws:// or wss://)",
        "session_id": session_id,
        "message": "This is the enhanced WebSocket endpoint. Use WebSocket protocol to connect.",
        "websocket_url": f"ws://your-domain/ws/enhanced-progress/{session_id}",
        "status": "available",
        "progress_manager_status": "initialized" if enhanced_progress_manager else "not_initialized",
        "features": [
            "Real-time progress tracking",
            "Stage-by-stage updates", 
            "Error handling",
            "Session management",
            "Ping/pong keepalive"
        ]
    }

# Add compatibility WebSocket endpoint for frontend
@app.websocket("/ws/progress/{session_id}")
async def progress_websocket_compatibility(websocket: WebSocket, session_id: str):
    """
    Compatibility WebSocket endpoint for frontend - redirects to enhanced progress
    This fixes the 403 Forbidden errors in frontend WebSocket connections
    """
    logger.info(f"Compatibility WebSocket connection attempt for session {session_id}")
    
    try:
        # Import here to avoid circular imports
        from api_v2_endpoints import enhanced_progress_manager
        
        if enhanced_progress_manager:
            # Connect to the progress manager (this will accept the WebSocket)
            await enhanced_progress_manager.connect(websocket, session_id)
            logger.info(f"Compatibility progress manager connected for session {session_id}")
            
            # Keep connection alive until manager disconnects
            try:
                while True:
                    # The enhanced_progress_manager handles the actual communication
                    await asyncio.sleep(1)
            except WebSocketDisconnect:
                logger.info(f"Compatibility WebSocket disconnected for session {session_id}")
            except Exception as e:
                logger.error(f"Compatibility WebSocket error for session {session_id}: {e}")
        else:
            await websocket.close(code=1011, reason="Progress manager not available")
            logger.error(f"Enhanced progress manager not available for session {session_id}")
    
    except Exception as e:
        logger.error(f"Compatibility WebSocket connection failed for session {session_id}: {e}")
        try:
            await websocket.close(code=1011, reason="Connection failed")
        except:
            pass

# Add compatibility mapping for enhanced progress WebSocket
@app.websocket("/ws/enhanced-progress/{session_id}")
async def enhanced_progress_websocket_main(websocket: WebSocket, session_id: str):
    """
    Enhanced progress WebSocket endpoint - main app compatibility
    This ensures the enhanced progress endpoint is available at main app level
    Fixed routing for frontend expectations
    """
    logger.info(f"Enhanced WebSocket connection attempt for session {session_id}")
    
    try:
        # Import here to avoid circular imports
        from api_v2_endpoints import enhanced_progress_manager
        
        if enhanced_progress_manager:
            # Connect to the progress manager (this will accept the WebSocket)
            await enhanced_progress_manager.connect(websocket, session_id)
            logger.info(f"Enhanced progress manager connected for session {session_id}")
            
            # Keep connection alive until manager disconnects
            try:
                while True:
                    # The enhanced_progress_manager handles the actual communication
                    await asyncio.sleep(1)
            except WebSocketDisconnect:
                logger.info(f"Enhanced WebSocket disconnected for session {session_id}")
            except Exception as e:
                logger.error(f"Enhanced WebSocket error for session {session_id}: {e}")
        else:
            await websocket.close(code=1011, reason="Progress manager not available")
            logger.error(f"Enhanced progress manager not available for session {session_id}")
    
    except Exception as e:
        logger.error(f"Enhanced WebSocket connection failed for session {session_id}: {e}")
        try:
            await websocket.close(code=1011, reason="Connection failed")
        except:
            pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    log_level = os.getenv("LOG_LEVEL", "info")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level=log_level,
        access_log=True
    )
