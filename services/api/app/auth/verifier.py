import os
import base64
from typing import Dict
from fastapi import Header, HTTPException, Depends
import jwt
from ..core.config import Settings

settings = Settings()

def get_current_user(authorization: str = Header(..., description="Bearer Supabase access token")) -> Dict:
    """Validate Supabase JWT and extract user ID.

    For this implementation we perform a minimal verification: decode the JWT
    without signature verification (the service role key is not a JWT secret).
    In production you would verify the token against Supabase's JWKS.
    """
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Missing Authorization header", "details": {}}})
    try:
        # Decode without verification; we only need the 'sub' claim which holds the user id.
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid token payload", "details": {}}})
        return {"user_id": user_id}
    except Exception as e:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED", "message": f"Invalid token: {e}", "details": {}}})
