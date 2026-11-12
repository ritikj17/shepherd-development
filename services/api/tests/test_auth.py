import jwt
import pytest
from uuid import uuid4
from httpx import AsyncClient

from tests.conftest import create_test_jwt, JWT_SECRET


@pytest.mark.asyncio
async def test_auth_missing_header_rejected(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/incidents")
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_auth_invalid_scheme_rejected(client: AsyncClient) -> None:
    resp = await client.get(
        "/api/v1/incidents",
        headers={"Authorization": "Basic dXNlcjpwYXNz"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_auth_expired_token_rejected(client: AsyncClient) -> None:
    expired_token = create_test_jwt(uuid4(), expires_in=-100)
    resp = await client.get(
        "/api/v1/incidents",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp.status_code == 401
    assert "expired" in resp.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_auth_invalid_signature_rejected(client: AsyncClient) -> None:
    bad_signature_token = create_test_jwt(uuid4(), secret="different-unknown-secret-key-32-bytes")
    resp = await client.get(
        "/api/v1/incidents",
        headers={"Authorization": f"Bearer {bad_signature_token}"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_auth_wrong_audience_rejected(client: AsyncClient) -> None:
    wrong_aud_token = create_test_jwt(uuid4(), aud="wrong_audience")
    resp = await client.get(
        "/api/v1/incidents",
        headers={"Authorization": f"Bearer {wrong_aud_token}"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_auth_malformed_token_rejected(client: AsyncClient) -> None:
    resp = await client.get(
        "/api/v1/incidents",
        headers={"Authorization": "Bearer not-a-valid-jwt-token"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_auth_none_algorithm_rejected(client: AsyncClient) -> None:
    none_token = jwt.encode(
        {"sub": str(uuid4()), "aud": "authenticated", "iss": "https://test.supabase.co/auth/v1", "exp": 9999999999},
        key="",
        algorithm="none",
    )
    resp = await client.get(
        "/api/v1/incidents",
        headers={"Authorization": f"Bearer {none_token}"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_auth_derives_owner_ignores_client_user_id(client: AsyncClient, user_1_headers: dict) -> None:
    spoofed_user_id = str(uuid4())
    payload = {
        "title": "Incident with attempted user_id spoofing",
        "description": "User attempting to pass custom user_id in body.",
        "category": "threat",
        "occurred_at": "2026-11-12T10:00:00Z",
        "user_id": spoofed_user_id,  # Extra forbidden field
    }
    # Because extra fields are forbidden by Pydantic schema
    resp = await client.post("/api/v1/incidents", json=payload, headers=user_1_headers)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
