from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.safety.repository import reset_safety_repository


@pytest.fixture(autouse=True)
def clean_safety_state():
    reset_safety_repository()
    yield
    reset_safety_repository()


@pytest.mark.asyncio
async def test_create_trusted_contact_success(client: AsyncClient, user_1_headers: dict[str, str]):
    payload = {
        "name": "Sister Sarah",
        "contact_method": "email",
        "contact_value": "sarah@example.test",
        "consent_confirmed": True,
    }
    resp = await client.post("/api/v1/trusted-contacts", json=payload, headers=user_1_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Sister Sarah"
    assert data["contact_method"] == "email"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_trusted_contact_missing_consent_rejected(client: AsyncClient, user_1_headers: dict[str, str]):
    payload = {
        "name": "Friend Alex",
        "contact_method": "phone",
        "contact_value": "+15551234567",
        "consent_confirmed": False,
    }
    resp = await client.post("/api/v1/trusted-contacts", json=payload, headers=user_1_headers)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "BAD_REQUEST"
    assert "Consent confirmation is required" in resp.json()["error"]["message"]


@pytest.mark.asyncio
async def test_create_trusted_contact_invalid_method(client: AsyncClient, user_1_headers: dict[str, str]):
    payload = {
        "name": "Invalid Contact",
        "contact_method": "pager",
        "contact_value": "pager123",
        "consent_confirmed": True,
    }
    resp = await client.post("/api/v1/trusted-contacts", json=payload, headers=user_1_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_trusted_contacts_isolation(
    client: AsyncClient, user_1_headers: dict[str, str], user_2_headers: dict[str, str]
):
    # User 1 creates contact
    await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "User 1 Contact", "contact_method": "email", "contact_value": "u1@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )

    # User 2 creates contact
    await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "User 2 Contact", "contact_method": "phone", "contact_value": "+10000000", "consent_confirmed": True},
        headers=user_2_headers,
    )

    # User 1 list
    resp1 = await client.get("/api/v1/trusted-contacts", headers=user_1_headers)
    assert resp1.status_code == 200
    items1 = resp1.json()["items"]
    assert len(items1) == 1
    assert items1[0]["name"] == "User 1 Contact"

    # User 2 list
    resp2 = await client.get("/api/v1/trusted-contacts", headers=user_2_headers)
    assert resp2.status_code == 200
    items2 = resp2.json()["items"]
    assert len(items2) == 1
    assert items2[0]["name"] == "User 2 Contact"


@pytest.mark.asyncio
async def test_delete_trusted_contact_success(client: AsyncClient, user_1_headers: dict[str, str]):
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "To Delete", "contact_method": "email", "contact_value": "del@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    contact_id = c_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/trusted-contacts/{contact_id}", headers=user_1_headers)
    assert del_resp.status_code == 204

    # Verify deleted
    list_resp = await client.get("/api/v1/trusted-contacts", headers=user_1_headers)
    assert len(list_resp.json()["items"]) == 0


@pytest.mark.asyncio
async def test_delete_trusted_contact_cross_user_denied(
    client: AsyncClient, user_1_headers: dict[str, str], user_2_headers: dict[str, str]
):
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "User 1 Contact", "contact_method": "email", "contact_value": "u1@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    contact_id = c_resp.json()["id"]

    # User 2 attempts to delete User 1's contact -> returns 404
    del_resp = await client.delete(f"/api/v1/trusted-contacts/{contact_id}", headers=user_2_headers)
    assert del_resp.status_code == 404
    assert del_resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_create_safety_session_success(client: AsyncClient, user_1_headers: dict[str, str]):
    # 1. Create trusted contact
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "Sarah", "contact_method": "email", "contact_value": "sarah@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    contact_id = c_resp.json()["id"]

    # 2. Create safety session
    future_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    s_payload = {
        "trusted_contact_id": contact_id,
        "incident_id": None,
        "checkin_deadline": future_time,
        "consent_confirmed": True,
    }
    s_resp = await client.post("/api/v1/safety-sessions", json=s_payload, headers=user_1_headers)
    assert s_resp.status_code == 201
    s_data = s_resp.json()
    assert s_data["status"] == "active"
    assert s_data["trusted_contact_id"] == contact_id


@pytest.mark.asyncio
async def test_create_safety_session_past_deadline_rejected(client: AsyncClient, user_1_headers: dict[str, str]):
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "Sarah", "contact_method": "email", "contact_value": "sarah@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    contact_id = c_resp.json()["id"]

    past_time = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    s_payload = {
        "trusted_contact_id": contact_id,
        "checkin_deadline": past_time,
        "consent_confirmed": True,
    }
    s_resp = await client.post("/api/v1/safety-sessions", json=s_payload, headers=user_1_headers)
    assert s_resp.status_code == 400
    assert "future" in s_resp.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_create_safety_session_cross_user_contact_rejected(
    client: AsyncClient, user_1_headers: dict[str, str], user_2_headers: dict[str, str]
):
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "User 1 Contact", "contact_method": "email", "contact_value": "u1@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    contact_id = c_resp.json()["id"]

    # User 2 tries to start session with User 1's contact
    future_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    s_payload = {
        "trusted_contact_id": contact_id,
        "checkin_deadline": future_time,
        "consent_confirmed": True,
    }
    s_resp = await client.post("/api/v1/safety-sessions", json=s_payload, headers=user_2_headers)
    assert s_resp.status_code == 404
    assert s_resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_delete_contact_in_use_rejected(client: AsyncClient, user_1_headers: dict[str, str]):
    # 1. Create contact
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "Busy Contact", "contact_method": "email", "contact_value": "busy@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    contact_id = c_resp.json()["id"]

    # 2. Start active session
    future_time = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
    await client.post(
        "/api/v1/safety-sessions",
        json={"trusted_contact_id": contact_id, "checkin_deadline": future_time, "consent_confirmed": True},
        headers=user_1_headers,
    )

    # 3. Attempt delete -> rejected with 400 CONTACT_IN_USE
    del_resp = await client.delete(f"/api/v1/trusted-contacts/{contact_id}", headers=user_1_headers)
    assert del_resp.status_code == 400
    assert del_resp.json()["error"]["details"]["code"] == "CONTACT_IN_USE"


@pytest.mark.asyncio
async def test_safety_session_checkin_and_idempotence(client: AsyncClient, user_1_headers: dict[str, str]):
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "Sarah", "contact_method": "email", "contact_value": "sarah@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    contact_id = c_resp.json()["id"]

    future_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    s_resp = await client.post(
        "/api/v1/safety-sessions",
        json={"trusted_contact_id": contact_id, "checkin_deadline": future_time, "consent_confirmed": True},
        headers=user_1_headers,
    )
    session_id = s_resp.json()["id"]

    # Check in
    chk_resp1 = await client.post(
        f"/api/v1/safety-sessions/{session_id}/checkin",
        json={"message": "I made it home safely."},
        headers=user_1_headers,
    )
    assert chk_resp1.status_code == 200
    data1 = chk_resp1.json()
    assert data1["status"] == "checked_in"
    assert "checked_in_at" in data1

    # Idempotent repeat check in
    chk_resp2 = await client.post(
        f"/api/v1/safety-sessions/{session_id}/checkin",
        json={"message": "Repeat check in"},
        headers=user_1_headers,
    )
    assert chk_resp2.status_code == 200
    data2 = chk_resp2.json()
    assert data2["checked_in_at"] == data1["checked_in_at"]


@pytest.mark.asyncio
async def test_safety_session_checkin_cross_user_denied(
    client: AsyncClient, user_1_headers: dict[str, str], user_2_headers: dict[str, str]
):
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "Sarah", "contact_method": "email", "contact_value": "sarah@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    contact_id = c_resp.json()["id"]

    future_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    s_resp = await client.post(
        "/api/v1/safety-sessions",
        json={"trusted_contact_id": contact_id, "checkin_deadline": future_time, "consent_confirmed": True},
        headers=user_1_headers,
    )
    session_id = s_resp.json()["id"]

    # User 2 attempts to check in
    chk_resp = await client.post(
        f"/api/v1/safety-sessions/{session_id}/checkin",
        json={"message": "I am safe."},
        headers=user_2_headers,
    )
    assert chk_resp.status_code == 404
