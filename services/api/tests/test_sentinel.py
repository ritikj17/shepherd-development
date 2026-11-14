from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser
from app.main import create_app
from app.models.sentinel import (
    ContactAcknowledgeInput,
    LocationUpdateRequest,
    SentinelSessionCreate,
    SilentAssistTriggerInput,
    VerificationResponseInput,
)
from app.sentinel.repository import InMemorySentinelRepository, get_sentinel_repository


@pytest.fixture
def mock_user() -> AuthenticatedUser:
    return AuthenticatedUser(
        id=uuid4(),
        email="sentinel_test@shepherd.app",
        role="authenticated",
    )


@pytest.fixture
def sentinel_repo() -> InMemorySentinelRepository:
    return InMemorySentinelRepository()


@pytest.fixture
def app(mock_user: AuthenticatedUser, sentinel_repo: InMemorySentinelRepository):
    application = create_app()
    application.dependency_overrides[get_current_user] = lambda: mock_user
    application.dependency_overrides[get_sentinel_repository] = lambda: sentinel_repo
    return application


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_sentinel_session_lifecycle(client: AsyncClient):
    # 1. Start a session
    eta = (datetime.now(timezone.utc) + timedelta(minutes=45)).isoformat()
    create_payload = {
        "destination_name": "Connaught Place Central",
        "destination_lat": 28.6328,
        "destination_lng": 77.2197,
        "travel_mode": "transit",
        "expected_arrival": eta,
        "start_lat": 28.5355,
        "start_lng": 77.3910,
        "deviation_threshold_meters": 300.0,
    }

    start_res = await client.post("/api/v1/sentinel/sessions", json=create_payload)
    assert start_res.status_code == 201
    session_data = start_res.json()
    assert session_data["status"] == "active"
    assert session_data["destination_name"] == "Connaught Place Central"
    session_id = session_data["id"]

    # 2. Get active session
    active_res = await client.get("/api/v1/sentinel/sessions/active")
    assert active_res.status_code == 200
    assert active_res.json()["id"] == session_id

    # 3. Ingest normal location update
    loc_payload = {
        "latitude": 28.5360,
        "longitude": 77.3915,
        "accuracy": 12.0,
        "speed": 4.5,
    }
    loc_res = await client.post(f"/api/v1/sentinel/sessions/{session_id}/location", json=loc_payload)
    assert loc_res.status_code == 200
    loc_json = loc_res.json()
    assert loc_json["status"] == "recorded"
    assert loc_json["concern_level"] == "normal"

    # 4. Ingest an anomaly (severe deviation)
    dev_payload = {
        "latitude": 28.7000,
        "longitude": 77.5000,
        "accuracy": 10.0,
        "speed": 12.0,
    }
    dev_res = await client.post(f"/api/v1/sentinel/sessions/{session_id}/location", json=dev_payload)
    assert dev_res.status_code == 200
    dev_json = dev_res.json()
    assert dev_json["concern_level"] in ["warning", "critical"]
    assert dev_json["verification_required"] is True
    assert "verification" in dev_json
    verif_id = dev_json["verification"]["id"]

    # 5. Respond to verification: "safe"
    verif_res = await client.post(
        f"/api/v1/sentinel/sessions/{session_id}/verifications/{verif_id}/respond",
        json={"response": "safe", "user_note": "Took alternate road due to construction"},
    )
    assert verif_res.status_code == 200
    assert verif_res.json()["status"] == "safe"

    # 6. Pause and resume session
    pause_res = await client.post(f"/api/v1/sentinel/sessions/{session_id}/pause")
    assert pause_res.status_code == 200
    assert pause_res.json()["status"] == "paused"

    resume_res = await client.post(f"/api/v1/sentinel/sessions/{session_id}/resume")
    assert resume_res.status_code == 200
    assert resume_res.json()["status"] == "active"

    # 7. Stop session
    stop_res = await client.post(f"/api/v1/sentinel/sessions/{session_id}/stop")
    assert stop_res.status_code == 200
    assert stop_res.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_silent_assist_and_public_relay(client: AsyncClient, sentinel_repo: InMemorySentinelRepository):
    # Trigger Silent Assist
    trigger_payload = {
        "current_lat": 28.6139,
        "current_lng": 77.2090,
        "accuracy": 8.0,
        "haptic_confirmed": True,
    }
    sa_res = await client.post("/api/v1/sentinel/silent-assist", json=trigger_payload)
    assert sa_res.status_code == 200
    sa_data = sa_res.json()
    assert sa_data["status"] == "escalated"
    incident_id = sa_data["incident_id"]
    relay_token = sa_data["relay_token"]
    assert relay_token is not None

    # Check live timeline
    tl_res = await client.get(f"/api/v1/sentinel/timeline?incident_id={incident_id}")
    assert tl_res.status_code == 200
    events = tl_res.json()["items"]
    assert len(events) >= 1
    assert any(e["event_type"] == "silent_assist_triggered" for e in events)

    # Public Trusted Contact checks relay details without auth
    relay_res = await client.get(f"/api/v1/relay/{relay_token}")
    assert relay_res.status_code == 200
    relay_data = relay_res.json()
    assert relay_data["status"] == "pending"
    assert relay_data["last_location"]["latitude"] == 28.6139
    assert relay_data["last_location"]["longitude"] == 77.2090

    # Contact acknowledges
    ack_res = await client.post(
        f"/api/v1/relay/{relay_token}/acknowledge",
        json={
            "responder_name": "Pooja Sharma",
            "responder_note": "I am on my way to your last known location",
        },
    )
    assert ack_res.status_code == 200
    ack_data = ack_res.json()
    assert ack_data["status"] == "acknowledged"
    assert ack_data["acknowledged_by"] == "Pooja Sharma"
