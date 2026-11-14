from typing import Optional

from fastapi import Depends, Header

from app.auth.models import AuthenticatedUser
from app.auth.verifier import SupabaseTokenVerifier
from app.core.config import Settings, get_settings
from app.core.exceptions import AuthenticationError

_verifier: Optional[SupabaseTokenVerifier] = None


def get_token_verifier(settings: Settings = Depends(get_settings)) -> SupabaseTokenVerifier:
    global _verifier
    if _verifier is None:
        _verifier = SupabaseTokenVerifier(settings)
    return _verifier


async def get_current_user(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    verifier: SupabaseTokenVerifier = Depends(get_token_verifier),
) -> AuthenticatedUser:
    """Reusable authenticated user dependency.

    Enforces Bearer token presence, validates signature, issuer, audience and expiry,
    and derives the authenticated user ID strictly from the verified token.
    Never accepts client-supplied user_id.
    """
    if not authorization:
        raise AuthenticationError("Authorization header is required.")

    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationError("Authorization header must use the Bearer scheme.")

    token = parts[1].strip()
    return verifier.verify_token(token)
