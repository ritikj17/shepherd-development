from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Literal["development", "staging", "production", "test"] = "development"
    api_host: str = "0.0.0.0"
    api_port: int = Field(default=8000, ge=1, le=65535)
    cors_origins: str = "http://localhost:3000"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Supabase JWT Verification
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""
    supabase_jwt_issuer: str = ""
    supabase_jwt_audience: str = "authenticated"

    # Storage
    supabase_evidence_bucket: str = "shepherd-evidence"
    supabase_reports_bucket: str = "shepherd-reports"

    # Intelligence API
    ai_service_url: str = "http://localhost:8001"
    ai_service_token: str = ""
    ai_service_timeout_seconds: float = Field(default=30.0, gt=0, le=120.0)

    # Evidence limits (10 MB default per docs/API_CONTRACTS.md)
    max_evidence_upload_bytes: int = Field(default=10 * 1024 * 1024, gt=0)

    # Mockable development/test adapter flag
    use_in_memory_adapter: bool = False

    @model_validator(mode="after")
    def validate_environment_requirements(self) -> "Settings":
        if self.app_env == "production" and self.use_in_memory_adapter:
            raise ValueError("USE_IN_MEMORY_ADAPTER must be false in production.")

        if not self.use_in_memory_adapter and self.app_env in ("staging", "production"):
            missing = []
            if not self.supabase_url:
                missing.append("SUPABASE_URL")
            if not self.supabase_service_role_key:
                missing.append("SUPABASE_SERVICE_ROLE_KEY")
            if not self.supabase_jwt_secret and not self.supabase_jwks_url and not self.supabase_url:
                missing.append("SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET")
            if missing:
                raise ValueError(
                    f"Missing required environment variables for {self.app_env}: {', '.join(missing)}"
                )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def effective_supabase_url(self) -> str:
        url = self.supabase_url.rstrip("/")
        if url.endswith("/rest/v1"):
            url = url[:-len("/rest/v1")]
        return url

    @property
    def effective_jwks_url(self) -> str:
        if self.supabase_jwks_url:
            return self.supabase_jwks_url.rstrip("/")
        if self.supabase_url:
            return f"{self.effective_supabase_url}/auth/v1/.well-known/jwks.json"
        return ""

    @property
    def effective_jwt_issuer(self) -> str:
        if self.supabase_jwt_issuer:
            return self.supabase_jwt_issuer.rstrip("/")
        if self.supabase_url:
            return f"{self.effective_supabase_url}/auth/v1"
        return ""


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
