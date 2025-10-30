"""Request/response schemas for API validation"""
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Dict


class ArtisticStyle(str, Enum):
    """Available artistic styles - only 2 styles to replace production effects"""
    INK_WASH = "ink_wash"                                   # "Modern" - replaces Pop Art
    VAN_GOGH_POST_IMPRESSIONISM = "van_gogh_post_impressionism"  # "Classic" - replaces Dithering


class GenerateRequest(BaseModel):
    """Request to generate single artistic style"""
    image_data: str = Field(..., description="Base64 encoded image")
    style: ArtisticStyle = Field(..., description="Style to apply")
    customer_id: Optional[str] = Field(None, description="Customer ID")
    session_id: Optional[str] = Field(None, description="Session ID")


class GenerateResponse(BaseModel):
    """Response with generated image"""
    success: bool
    image_url: str
    original_url: str
    style: str
    cache_hit: bool = False
    quota_remaining: int
    quota_limit: int
    processing_time_ms: int
    warning_level: int = Field(1, description="Warning level: 1=silent, 2=reminder, 3=warning, 4=exhausted")


class QuotaStatus(BaseModel):
    """Rate limit quota status"""
    allowed: bool
    remaining: int
    limit: int
    reset_time: str
    warning_level: int = Field(1, description="Warning level: 1=silent, 2=reminder, 3=warning, 4=exhausted")


class BatchGenerateRequest(BaseModel):
    """Request to generate both artistic styles at once"""
    image_data: str = Field(..., description="Base64 encoded image")
    customer_id: Optional[str] = Field(None, description="Customer ID")
    session_id: Optional[str] = Field(None, description="Session ID")


class StyleResult(BaseModel):
    """Result for single style in batch"""
    style: str
    image_url: str
    cache_hit: bool = False
    processing_time_ms: int


class BatchGenerateResponse(BaseModel):
    """Response with both generated styles"""
    success: bool
    original_url: str
    results: Dict[str, StyleResult]
    quota_remaining: int
    quota_limit: int
    total_processing_time_ms: int
    warning_level: int = Field(1, description="Warning level: 1=silent, 2=reminder, 3=warning, 4=exhausted")
