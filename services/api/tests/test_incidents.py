from uuid import uuid4
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_get_incident(client: AsyncClient, user_1_headers: dict) -> None:
    payload = {
        "title": "Threatening direct messages",
        "description": "Received repeated explicit threats on social media.",
        "category": "threat",
        "occurred_at": "2026-11-12T10:30:00Z",
        "location_description": "Direct message inbox",
    }
    resp = await client.post("/api/v1/incidents", json=payload, headers=user_1_headers)
    assert resp.status_code == 201
    created = resp.json()
    assert created["title"] == payload["title"]
    assert created["category"] == "threat"
    assert created["status"] == "open"
    incident_id = created["id"]

    # Get incident
    get_resp = await client.get(f"/api/v1/incidents/{incident_id}", headers=user_1_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == incident_id


@pytest.mark.asyncio
async def test_create_incident_invalid_category_rejected(client: AsyncClient, user_1_headers: dict) -> None:
    payload = {
        "title": "Invalid category test",
        "description": "Some description",
        "category": "unsupported_random_category",
        "occurred_at": "2026-11-12T10:30:00Z",
    }
    resp = await client.post("/api/v1/incidents", json=payload, headers=user_1_headers)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_list_incidents_isolation_and_pagination(
    client: AsyncClient, user_1_headers: dict, user_2_headers: dict
) -> None:
    # Create 3 incidents for User 1
    for i in range(3):
        await client.post(
            "/api/v1/incidents",
            json={
                "title": f"User 1 Incident {i}",
                "description": f"Description {i}",
                "category": "general_harassment",
                "occurred_at": f"2026-11-12T1{i}:00:00Z",
            },
            headers=user_1_headers,
        )

    # Create 1 incident for User 2
    await client.post(
        "/api/v1/incidents",
        json={
            "title": "User 2 Private Incident",
            "description": "User 2 private description",
            "category": "cyberstalking",
            "occurred_at": "2026-11-12T15:00:00Z",
        },
        headers=user_2_headers,
    )

    # User 1 lists incidents
    resp_1 = await client.get("/api/v1/incidents", headers=user_1_headers)
    assert resp_1.status_code == 200
    data_1 = resp_1.json()
    assert data_1["total"] == 3
    assert len(data_1["items"]) == 3
    assert all("User 1" in item["title"] for item in data_1["items"])

    # User 2 lists incidents
    resp_2 = await client.get("/api/v1/incidents", headers=user_2_headers)
    assert resp_2.status_code == 200
    data_2 = resp_2.json()
    assert data_2["total"] == 1
    assert data_2["items"][0]["title"] == "User 2 Private Incident"


@pytest.mark.asyncio
async def test_cross_user_incident_access_denied(
    client: AsyncClient, user_1_headers: dict, user_2_headers: dict
) -> None:
    # User 1 creates an incident
    create_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "User 1 Secret Incident",
            "description": "Confidential details",
            "category": "sextortion",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = create_resp.json()["id"]

    # User 2 tries to GET User 1's incident -> 404 NOT_FOUND (prevent disclosure)
    get_resp = await client.get(f"/api/v1/incidents/{incident_id}", headers=user_2_headers)
    assert get_resp.status_code == 404
    assert get_resp.json()["error"]["code"] == "NOT_FOUND"

    # User 2 tries to PATCH User 1's incident -> 404
    patch_resp = await client.patch(
        f"/api/v1/incidents/{incident_id}",
        json={"title": "Hacked Title"},
        headers=user_2_headers,
    )
    assert patch_resp.status_code == 404

    # User 2 tries to DELETE User 1's incident -> 404
    delete_resp = await client.delete(f"/api/v1/incidents/{incident_id}", headers=user_2_headers)
    assert delete_resp.status_code == 404

    # User 1 can successfully update their incident
    valid_patch = await client.patch(
        f"/api/v1/incidents/{incident_id}",
        json={"status": "archived"},
        headers=user_1_headers,
    )
    assert valid_patch.status_code == 200
    assert valid_patch.json()["status"] == "archived"

    # User 1 can successfully delete their incident
    valid_delete = await client.delete(f"/api/v1/incidents/{incident_id}", headers=user_1_headers)
    assert valid_delete.status_code == 204
