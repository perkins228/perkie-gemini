"""Request/response schemas for API validation"""
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Dict


class ArtisticStyle(str, Enum):
    """Available artistic styles - only 2 styles to replace production effects"""
    INK_WASH = "ink_wash"                                   # "Modern" - replaces Pop Art
    PEN_AND_MARKER = "pen_and_marker"                       # "Sketch" - replaces Dithering


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


class SignedUrlRequest(BaseModel):
    """Request for signed upload URL"""
    customer_id: Optional[str] = Field(None, description="Customer ID")
    session_id: Optional[str] = Field(None, description="Session ID")
    file_type: str = Field("image/jpeg", description="File content type")


class SignedUrlResponse(BaseModel):
    """Response with signed URL for upload"""
    signed_url: str = Field(..., description="Signed URL for PUT upload")
    public_url: str = Field(..., description="Public URL after upload completes")
    upload_id: str = Field(..., description="Unique identifier for this upload")
    blob_path: str = Field(..., description="GCS blob path")
    expires_in: int = Field(..., description="URL expiry in seconds")
    method: str = Field("PUT", description="HTTP method to use")
    content_type: str = Field(..., description="Content type for upload")


class ConfirmUploadRequest(BaseModel):
    """Request to confirm successful upload"""
    upload_id: str = Field(..., description="Upload ID from signed URL response")
    blob_path: str = Field(..., description="GCS blob path")
    customer_id: Optional[str] = Field(None, description="Customer ID")
    session_id: Optional[str] = Field(None, description="Session ID")


class ConfirmUploadResponse(BaseModel):
    """Response confirming upload"""
    success: bool
    upload_id: str
    size: int = Field(..., description="File size in bytes")
    content_type: str
    public_url: str
    created: str = Field(..., description="Creation timestamp")


class SendEmailRequest(BaseModel):
    """Request to send processed images via email"""
    to_email: str = Field(..., description="Recipient email address")
    to_name: str = Field(..., description="Recipient name")
    customer_id: Optional[str] = Field(None, description="Customer ID for rate limiting")
    session_id: Optional[str] = Field(None, description="Session ID for rate limiting")
    order_id: Optional[str] = Field(None, description="Shopify order ID")
    image_urls: Dict[str, str] = Field(..., description="Dict of image URLs (original_url, ink_wash_url, pen_marker_url, etc.)")
    subject: Optional[str] = Field("Your Pet Images from Perkie Prints", description="Email subject")


class SendEmailResponse(BaseModel):
    """Response from email send operation"""
    success: bool
    message_id: Optional[str] = Field(None, description="Email provider message ID")
    error: Optional[str] = Field(None, description="Error message if failed")
    signed_urls: Optional[Dict[str, str]] = Field(None, description="Signed URLs generated for images")
    quota_remaining: int = Field(..., description="Email quota remaining")
    quota_limit: int = Field(..., description="Email quota limit")


class CaptureEmailRequest(BaseModel):
    """Request to capture email for remarketing (no email sent)"""
    email: str = Field(..., description="Email address to capture")
    name: str = Field(..., description="Customer name")
    customer_id: Optional[str] = Field(None, description="Customer ID")
    session_id: Optional[str] = Field(None, description="Session ID")
    selected_style: str = Field(..., description="Selected image style (enhancedblackwhite, color, modern, sketch)")
    order_id: Optional[str] = Field(None, description="Shopify order ID if applicable")


class CaptureEmailResponse(BaseModel):
    """Response from email capture operation"""
    success: bool
    capture_id: str = Field(..., description="Unique ID for this capture")
    timestamp: str = Field(..., description="Capture timestamp")
