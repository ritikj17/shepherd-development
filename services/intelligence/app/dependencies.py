import os
from fastapi import Header, HTTPException, Depends
from typing import Optional

def verify_service_token(authorization: Optional[str] = Header(None)):
    """FastAPI dependency that validates the server‑to‑server Bearer token.

    The expected token is stored in the environment variable ``AI_SERVICE_TOKEN``.
    If the header is missing or does not match, a 401 error is raised.
    """
    expected_token = os.getenv("AI_SERVICE_TOKEN")
    if not expected_token:
        # Misconfiguration – treat as internal server error
        raise HTTPException(status_code=500, detail={"error": {"code": "CONFIG_ERROR", "message": "AI_SERVICE_TOKEN not set", "details": {}}})
    if not authorization:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Missing Authorization header", "details": {}}})
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token != expected_token:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid token", "details": {}}})
    return True
