"""Application configuration using Pydantic settings"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    # Google Cloud Project
    project_id: str = "gen-lang-client-0601138686"
    project_number: str = "753651513695"

    # Gemini API Configuration
    # API key loaded from Secret Manager or environment variable
    gemini_api_key: str  # No default - must be provided via env var or Secret Manager
    gemini_model: str = "gemini-2.5-flash-image"
    gemini_custom_model: str = "gemini-2.5-flash-image"  # Model for /generate-custom endpoint (can differ from gemini_model)
    gemini_temperature: float = 0.7
    gemini_top_p: float = 0.9
    gemini_top_k: int = 40

    # Rate Limiting - Gemini effects only (B&W and Color unlimited)
    rate_limit_daily: int = 10      # Customer/IP daily limit for Gemini artistic effects (generous for testing)
    rate_limit_burst: int = 10      # Session daily limit (kept same for consistency)

    # Email Rate Limits (separate from image generation)
    email_rate_limit_daily: int = 3     # Emails per day per customer/IP (1 send + 2 retries)
    email_rate_limit_burst: int = 2     # Emails per session (1 send + 1 retry)

    # Storage Configuration
    storage_bucket: str = "perkieprints-processing-cache"
    cache_ttl_seconds: int = 604800  # 7 days

    # Signed URL Configuration
    signed_url_expiry_hours: int = 24  # URL expiry time for email downloads

    # Cost Controls
    daily_cost_cap: float = 10.0
    alert_thresholds: List[float] = [0.5, 0.75, 0.9]

    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    debug: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
