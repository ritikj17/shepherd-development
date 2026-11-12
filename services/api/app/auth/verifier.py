import logging
from typing import Any
from uuid import UUID

import jwt
from jwt import PyJWKClient, PyJWTError

from app.auth.models import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.core.exceptions import AuthenticationError

logger = logging.getLogger(__name__)


class SupabaseTokenVerifier:
    """Verifies Supabase JWT access tokens against configured secret or JWKS."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._jwks_client: PyJWKClient | None = None
        if self.settings.effective_jwks_url:
            self._jwks_client = PyJWKClient(self.settings.effective_jwks_url, cache_jwk_set=True, lifespan=3600)

    def verify_token(self, token: str) -> AuthenticatedUser:
        """Validate token signature, issuer, audience and expiry, deriving user ID."""
        if not token or not token.strip():
            raise AuthenticationError("Authentication token is required.")

        # Check for mock development token when in-memory adapter is active
        if self.settings.use_in_memory_adapter and token.startswith("mock-user-"):
            user_suffix = token.replace("mock-user-", "")
            try:
                user_uuid = UUID(user_suffix)
            except ValueError:
                # If short identifier, turn into deterministic UUID
                import uuid
                user_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, user_suffix)
            return AuthenticatedUser(id=user_uuid, email=f"{user_suffix}@example.test")

        header = self._safe_get_unverified_header(token)
        algorithm = header.get("alg")

        options = {
            "verify_signature": True,
            "verify_exp": True,
            "verify_aud": bool(self.settings.supabase_jwt_audience),
            "verify_iss": bool(self.settings.effective_jwt_issuer),
        }

        claims: dict[str, Any] = {}
        decode_kwargs: dict[str, Any] = {
            "algorithms": [algorithm] if algorithm else ["HS256", "RS256", "ES256"],
            "options": options,
        }

        if self.settings.supabase_jwt_audience:
            decode_kwargs["audience"] = self.settings.supabase_jwt_audience
        if self.settings.effective_jwt_issuer:
            decode_kwargs["issuer"] = self.settings.effective_jwt_issuer

        try:
            if algorithm and algorithm.startswith("HS"):
                # Secret-based (HMAC)
                if not self.settings.supabase_jwt_secret:
                    raise AuthenticationError("SUPABASE_JWT_SECRET is not configured for HMAC verification.")
                claims = jwt.decode(
                    token,
                    self.settings.supabase_jwt_secret,
                    **decode_kwargs,
                )
            elif algorithm and (algorithm.startswith("RS") or algorithm.startswith("ES")):
                # Asymmetric / JWKS
                if self._jwks_client:
                    signing_key = self._jwks_client.get_signing_key_from_jwt(token)
                    claims = jwt.decode(
                        token,
                        signing_key.key,
                        **decode_kwargs,
                    )
                elif self.settings.supabase_jwt_secret:
                    # In some environments, secret may contain public key
                    claims = jwt.decode(
                        token,
                        self.settings.supabase_jwt_secret,
                        **decode_kwargs,
                    )
                else:
                    raise AuthenticationError("No JWKS URL or verification key configured for asymmetric token.")
            else:
                # Fallback to configured secret
                if not self.settings.supabase_jwt_secret:
                    raise AuthenticationError("Unsupported token algorithm or missing verification configuration.")
                claims = jwt.decode(
                    token,
                    self.settings.supabase_jwt_secret,
                    **decode_kwargs,
                )
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationError("Token has expired.") from exc
        except (PyJWTError, ValueError) as exc:
            logger.warning("Token verification failed: %s", str(exc))
            raise AuthenticationError("Invalid authentication token.") from exc

        sub = claims.get("sub")
        if not sub:
            raise AuthenticationError("Token does not contain a subject claim.")

        try:
            user_id = UUID(str(sub))
        except (ValueError, TypeError) as exc:
            raise AuthenticationError("Token subject is not a valid UUID.") from exc

        email = claims.get("email")
        role = claims.get("role", "authenticated")
        return AuthenticatedUser(id=user_id, email=email, role=role)

    def _safe_get_unverified_header(self, token: str) -> dict[str, Any]:
        try:
            return jwt.get_unverified_header(token)
        except Exception as exc:
            raise AuthenticationError("Malformed token header.") from exc
