import os
from fastapi import Header, HTTPException

# Lazy load Settings to avoid import-time errors if env vars are missing
_settings = None

def _get_settings():
    global _settings
    if _settings is None:
        try:
            from ..core.config import Settings
            _settings = Settings()
        except Exception:
            # Config error when AI_SERVICE_TOKEN missing
            raise HTTPException(
                status_code=500,
                detail={"error": {"code": "CONFIG_ERROR", "message": "AI_SERVICE_TOKEN not set", "details": {}}},
            )
    return _settings

def get_ai_token(authorization: str = Header(..., description="Bearer token for AI service")):
    """Validate Authorization header against the configured AI service token.

    Returns the token string on success; raises HTTPException with a flat error
    envelope on failure.
    """
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Missing Authorization header", "details": {}}},
        )
    settings = _get_settings()
    if token != settings.AI_SERVICE_TOKEN:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid token", "details": {}}},
        )
    return token
