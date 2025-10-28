"""Configuration settings for Gemini Artistic API"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings with sensible defaults"""

    # Google Cloud Project
    project_id: str = "gen-lang-client-0601138686"
    project_number: str = "753651513695"

    # Gemini API (Nano Banana)
    gemini_api_key: str = "AIzaSyAP6X8DdL1kPlah25du8s_YzipwOnYd_7I"
    gemini_model: str = "gemini-2.5-flash-image"  # CRITICAL: Image generation model
    gemini_temperature: float = 0.3  # Lowered from 0.7 for max consistency (>95% Perkie Print requirement)
    gemini_top_p: float = 0.85       # Lowered from 0.9 for tighter token selection
    gemini_top_k: int = 25           # Lowered from 40 for more focused outputs

    # Rate Limiting
    rate_limit_daily: int = 5       # Customer/IP limit
    rate_limit_burst: int = 3       # Session limit

    # Storage
    storage_bucket: str = "gemini-artistic-753651513695"
    cache_ttl_seconds: int = 604800  # 7 days for temp files

    # Cost Controls
    daily_cost_cap: float = 10.0    # $10/day hard cap
    # Note: alert_thresholds not loaded from env, hardcoded for simplicity
    @property
    def alert_thresholds(self) -> List[float]:
        return [0.5, 0.75, 0.9]  # 50%, 75%, 90%

    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    debug: bool = False

    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
        "extra": "ignore"  # Ignore extra fields from env
    }


settings = Settings()
