"""Pydantic schemas for request/response validation"""
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Dict


class ArtisticStyle(str, Enum):
    """Available artistic styles with pet identification and background removal"""
    BW_FINE_ART = "bw_fine_art"                             # "Perkie Print" - Black & White Fine Art Portrait
    INK_WASH = "ink_wash"                                   # "Modern" - Modern Ink & Wash
    VAN_GOGH_POST_IMPRESSIONISM = "van_gogh_post_impressionism"  # "Classic" - Van Gogh Post-Impressionism


class GenerateRequest(BaseModel):
    """Request to generate artistic style"""
    image_data: str = Field(..., description="Base64 encoded image data")
    style: ArtisticStyle = Field(..., description="Artistic style to apply")
    customer_id: Optional[str] = Field(None, description="Customer ID for rate limiting")
    session_id: Optional[str] = Field(None, description="Session ID for anonymous users")

    class Config:
        json_schema_extra = {
            "example": {
                "image_data": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
                "style": "bw_fine_art",
                "customer_id": "customer_12345",
                "session_id": "session_abc123"
            }
        }


class GenerateResponse(BaseModel):
    """Response with generated image"""
    success: bool = Field(..., description="Whether generation succeeded")
    image_url: str = Field(..., description="URL of generated image")
    original_url: str = Field(..., description="URL of original uploaded image")
    style: str = Field(..., description="Style that was applied")
    cache_hit: bool = Field(False, description="Whether result came from cache")
    quota_remaining: int = Field(..., description="Remaining quota for this user")
    quota_limit: int = Field(..., description="Total quota limit")
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "image_url": "https://storage.googleapis.com/bucket/generated/...",
                "original_url": "https://storage.googleapis.com/bucket/originals/...",
                "style": "bw_fine_art",
                "cache_hit": False,
                "quota_remaining": 4,
                "quota_limit": 5,
                "processing_time_ms": 2847
            }
        }


class QuotaStatus(BaseModel):
    """Rate limit quota status"""
    allowed: bool
    remaining: int
    limit: int
    reset_time: str


class BatchGenerateRequest(BaseModel):
    """Request to generate all 3 artistic styles at once"""
    image_data: str = Field(..., description="Base64 encoded image data")
    customer_id: Optional[str] = Field(None, description="Customer ID for rate limiting")
    session_id: Optional[str] = Field(None, description="Session ID for anonymous users")

    class Config:
        json_schema_extra = {
            "example": {
                "image_data": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
                "customer_id": "customer_12345",
                "session_id": "session_abc123"
            }
        }


class StyleResult(BaseModel):
    """Result for a single style in batch generation"""
    style: str = Field(..., description="Style that was applied")
    image_url: str = Field(..., description="URL of generated image")
    cache_hit: bool = Field(False, description="Whether result came from cache")
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")


class BatchGenerateResponse(BaseModel):
    """Response with all 3 generated styles"""
    success: bool = Field(..., description="Whether generation succeeded")
    original_url: str = Field(..., description="URL of original uploaded image")
    results: Dict[str, StyleResult] = Field(..., description="Results for each style")
    quota_remaining: int = Field(..., description="Remaining quota for this user")
    quota_limit: int = Field(..., description="Total quota limit")
    total_processing_time_ms: int = Field(..., description="Total processing time in milliseconds")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "original_url": "https://storage.googleapis.com/bucket/originals/...",
                "results": {
                    "bw_fine_art": {
                        "style": "bw_fine_art",
                        "image_url": "https://storage.googleapis.com/bucket/generated/...",
                        "cache_hit": False,
                        "processing_time_ms": 2847
                    },
                    "ink_wash": {
                        "style": "ink_wash",
                        "image_url": "https://storage.googleapis.com/bucket/generated/...",
                        "cache_hit": False,
                        "processing_time_ms": 3012
                    },
                    "van_gogh_post_impressionism": {
                        "style": "van_gogh_post_impressionism",
                        "image_url": "https://storage.googleapis.com/bucket/generated/...",
                        "cache_hit": False,
                        "processing_time_ms": 2956
                    }
                },
                "quota_remaining": 2,
                "quota_limit": 5,
                "total_processing_time_ms": 8815
            }
        }
