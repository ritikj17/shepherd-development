import os
import base64
import pytest
from fastapi.testclient import TestClient

# Ensure the app is imported using the package path
from app.main import app

client = TestClient(app)

# Helper to set token env for each test
@pytest.fixture(autouse=True)
def set_token(monkeypatch):
    # Set a deterministic token for testing
    monkeypatch.setenv("AI_SERVICE_TOKEN", "test-token")
    yield
    # Cleanup after test
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)

# Helper to build a minimal valid request payload
def build_payload(related=False, invalid_timestamp=False):
    evidence = [
        {
            "evidence_id": "00000000-0000-0000-0000-000000000001",
            "mime_type": "image/png",
            "content_base64": base64.b64encode(b"test").decode()
        }
    ]
    payload = {
        "incident_id": "00000000-0000-0000-0000-000000000000",
        "description": "sample description",
        "evidence": evidence,
    }
    if related:
        related_incident = {
            "incident_id": "00000000-0000-0000-0000-000000000002",
            "type": "phishing",
            "severity": "high",
            "timestamp": "2023-01-01T12:00:00Z" if not invalid_timestamp else "invalid-timestamp",
            "location": "NY",
            "status": "open"
        }
        payload["related_incidents"] = [related_incident]
    return payload

# ---------- Authentication tests ----------

def test_successful_authentication():
    response = client.post(
        "/api/v1/analyze",
        json=build_payload(),
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["incident_id"] == "00000000-0000-0000-0000-000000000000"
    # risk should be insufficient_data per current implementation
    assert data["risk"]["level"] == "insufficient_data"

def test_missing_authorization_header():
    response = client.post("/api/v1/analyze", json=build_payload())
    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "UNAUTHORIZED",
            "message": "Missing Authorization header",
            "details": {}
        }
    }

def test_invalid_token():
    response = client.post(
        "/api/v1/analyze",
        json=build_payload(),
        headers={"Authorization": "Bearer wrong-token"}
    )
    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "UNAUTHORIZED",
            "message": "Invalid token",
            "details": {}
        }
    }

def test_missing_ai_service_token(monkeypatch):
    # Remove the env var to trigger config error
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)
    response = client.post(
        "/api/v1/analyze",
        json=build_payload(),
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "CONFIG_ERROR",
            "message": "AI_SERVICE_TOKEN not set",
            "details": {}
        }
    }

# ---------- Payload validation tests ----------

def test_invalid_mime_type():
    payload = build_payload()
    payload["evidence"][0]["mime_type"] = "application/pdf"  # unsupported
    response = client.post(
        "/api/v1/analyze",
        json=payload,
        headers={"Authorization": "Bearer test-token"}
    )
    # OCR will raise an error which is turned into a 400 with OCR_ERROR envelope
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "OCR_ERROR"

def test_malformed_base64():
    payload = build_payload()
    payload["evidence"][0]["content_base64"] = "!!!notbase64!!!"
    response = client.post(
        "/api/v1/analyze",
        json=payload,
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 400
    err = response.json()
    assert err["error"]["code"] == "OCR_ERROR"

# ---------- Related incidents tests ----------

def test_related_incidents_present():
    response = client.post(
        "/api/v1/analyze",
        json=build_payload(related=True),
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 200
    # Ensure request succeeded – the field is optional and ignored by the service
    data = response.json()
    assert "risk" in data

def test_invalid_related_incident_timestamp():
    response = client.post(
        "/api/v1/analyze",
        json=build_payload(related=True, invalid_timestamp=True),
        headers={"Authorization": "Bearer test-token"}
    )
    # Pydantic validation error should be returned as 422 with our envelope
    assert response.status_code == 422
    err = response.json()
    assert err["error"]["code"] == "VALIDATION_ERROR"
    # Details should contain the field causing the failure
    assert any("timestamp" in d.get("loc", []) for d in err["error"]["details"])

# ---------- Graph endpoint test ----------

def test_graph_endpoint():
    response = client.get(
        "/api/v1/graph/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["incident_id"] == "00000000-0000-0000-0000-000000000000"
    # Default stub returns empty nodes/edges
    assert data["nodes"] == []
    assert data["edges"] == []


# ---------- Regression tests for Issue 1 & Issue 2 ----------

def test_analyze_description_only_influences_classification():
    """Verify description is classified even when evidence is empty."""
    payload = {
        "incident_id": "00000000-0000-0000-0000-000000000099",
        "description": "He threatens to kill me with violent action if I leave",
        "evidence": [],
    }
    response = client.post(
        "/api/v1/analyze",
        json=payload,
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["classification"]["label"] == "threat"
    assert data["classification"]["confidence"] > 0
    assert len(data["indicators"]) > 0


def test_threat_matching_request_returns_valid_200_not_500():
    """Regression test: Ensure threat indicator matches do not crash compute_risk with AttributeError."""
    payload = {
        "incident_id": "00000000-0000-0000-0000-000000000098",
        "description": "Subject is stalking online and monitoring my social media accounts daily",
        "evidence": [],
    }
    response = client.post(
        "/api/v1/analyze",
        json=payload,
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["classification"]["label"] == "cyberstalking"
    assert "risk" in data
    assert data["risk"]["level"] == "insufficient_data"


def test_analyze_empty_inputs_safe():
    """Verify empty description and empty evidence handled gracefully."""
    payload = {
        "incident_id": "00000000-0000-0000-0000-000000000097",
        "description": "",
        "evidence": [],
    }
    response = client.post(
        "/api/v1/analyze",
        json=payload,
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["classification"]["label"] == "other"
    assert data["classification"]["confidence"] == 0.0

