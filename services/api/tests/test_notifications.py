from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.notifications.repository import reset_notification_repository
from app.safety.repository import reset_safety_repository


@pytest.fixture(autouse=True)
def clean_state():
    reset_safety_repository()
    reset_notification_repository()
    yield
    reset_safety_repository()
    reset_notification_repository()


@pytest.mark.asyncio
async def test_session_lifecycle_generates_simulated_notifications(
    client: AsyncClient, user_1_headers: dict[str, str]
):
    # 1. Create trusted contact
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "Trusted Maya", "contact_method": "email", "contact_value": "maya@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    contact_id = c_resp.json()["id"]

    # 2. Start session -> dispatches session_start alert
    future_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    s_resp = await client.post(
        "/api/v1/safety-sessions",
        json={"trusted_contact_id": contact_id, "checkin_deadline": future_time, "consent_confirmed": True},
        headers=user_1_headers,
    )
    session_id = s_resp.json()["id"]

    # 3. Check in -> dispatches checkin_confirmed alert
    await client.post(
        f"/api/v1/safety-sessions/{session_id}/checkin",
        json={"message": "All good"},
        headers=user_1_headers,
    )

    # 4. List alerts for user 1
    a_resp = await client.get("/api/v1/alerts", headers=user_1_headers)
    assert a_resp.status_code == 200
    alerts = a_resp.json()["items"]
    assert len(alerts) >= 2

    # Verify statuses are "simulated" (mock provider)
    for alert in alerts:
        assert alert["status"] in ("simulated", "sent")
        assert "simulated" in alert["provider_reference"].lower()


@pytest.mark.asyncio
async def test_alerts_cross_user_isolation(
    client: AsyncClient, user_1_headers: dict[str, str], user_2_headers: dict[str, str]
):
    # User 1 initiates contact & session
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "User 1 Contact", "contact_method": "email", "contact_value": "u1@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    future_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    await client.post(
        "/api/v1/safety-sessions",
        json={"trusted_contact_id": c_resp.json()["id"], "checkin_deadline": future_time, "consent_confirmed": True},
        headers=user_1_headers,
    )

    # User 1 should see alerts
    a_resp1 = await client.get("/api/v1/alerts", headers=user_1_headers)
    assert a_resp1.status_code == 200
    assert len(a_resp1.json()["items"]) >= 1

    # User 2 should see 0 alerts
    a_resp2 = await client.get("/api/v1/alerts", headers=user_2_headers)
    assert a_resp2.status_code == 200
    assert len(a_resp2.json()["items"]) == 0


@pytest.mark.asyncio
async def test_get_alert_cross_user_denied(
    client: AsyncClient, user_1_headers: dict[str, str], user_2_headers: dict[str, str]
):
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "User 1 Contact", "contact_method": "email", "contact_value": "u1@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    future_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    await client.post(
        "/api/v1/safety-sessions",
        json={"trusted_contact_id": c_resp.json()["id"], "checkin_deadline": future_time, "consent_confirmed": True},
        headers=user_1_headers,
    )

    a_resp1 = await client.get("/api/v1/alerts", headers=user_1_headers)
    alert_id = a_resp1.json()["items"][0]["id"]

    # User 2 tries to fetch User 1's alert
    a_resp2 = await client.get(f"/api/v1/alerts/{alert_id}", headers=user_2_headers)
    assert a_resp2.status_code == 404
    assert a_resp2.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_overdue_check_dispatches_reminders(
    client: AsyncClient, user_1_headers: dict[str, str]
):
    from app.safety.repository import get_safety_repository
    safety_repo = get_safety_repository()

    # Create contact
    c_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={"name": "Urgent Contact", "contact_method": "email", "contact_value": "urgent@test.com", "consent_confirmed": True},
        headers=user_1_headers,
    )
    contact_id = c_resp.json()["id"]

    # Create session with future deadline initially
    future_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    s_resp = await client.post(
        "/api/v1/safety-sessions",
        json={"trusted_contact_id": contact_id, "checkin_deadline": future_time, "consent_confirmed": True},
        headers=user_1_headers,
    )
    session_id = s_resp.json()["id"]

    # Simulate passing of time by directly setting session deadline to the past
    for s in safety_repo.sessions.values():
        if str(s["id"]) == session_id:
            s["checkin_deadline"] = datetime.now(timezone.utc) - timedelta(minutes=5)

    # Call overdue check
    check_resp = await client.post("/api/v1/notifications/check-overdue", headers=user_1_headers)
    assert check_resp.status_code == 200
    check_data = check_resp.json()
    assert check_data["expired_sessions_count"] >= 1
    assert check_data["reminders_dispatched_count"] >= 1

    # Verify reminder alert exists
    a_resp = await client.get("/api/v1/alerts", headers=user_1_headers)
    reminder_alerts = [a for a in a_resp.json()["items"] if a["message_type"] == "missed_checkin_reminder"]
    assert len(reminder_alerts) >= 1
    assert reminder_alerts[0]["status"] == "simulated"
