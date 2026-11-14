from typing import Any
from unittest.mock import AsyncMock, patch
from uuid import uuid4
import pytest
from httpx import AsyncClient

from app.api.analysis_router import get_intelligence_client
from app.core.exceptions import ServiceUnavailableError, UpstreamServiceError
from app.core.intelligence_client import IntelligenceClient


class MockIntelligenceClient(IntelligenceClient):
    """Mock for Member 3 Intelligence API responses."""

    def __init__(self, mode: str = "success") -> None:
        self.mode = mode

    async def analyze_incident(
        self,
        incident_id: Any,
        description: str,
        evidence_items: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if self.mode == "unavailable":
            raise ServiceUnavailableError("Intelligence API service is currently unreachable.")
        if self.mode == "upstream_error":
            raise UpstreamServiceError("Intelligence API returned a server error.")

        return {
            "analysis_id": str(uuid4()),
            "incident_id": str(incident_id),
            "status": "completed",
            "classification": {
                "label": "general_harassment",
                "confidence": 0.82,
                "confidence_type": "model_score_not_calibrated_probability",
                "explanation": "Extracted text contains repeated unwanted contact patterns.",
            },
            "indicators": [
                {
                    "name": "repeated_unwanted_contact",
                    "description": "The text indicates repeated contact.",
                }
            ],
            "risk": {
                "score": 45,
                "level": "moderate",
                "label": "review_priority",
                "factors": [],
                "explanation": "Calculated review-priority score.",
            },
            "ocr": {
                "status": "completed",
                "text_available": True,
            },
            "limitations": [
                "AI output may be inaccurate.",
                "This result is not a prediction of crime or future harm.",
            ],
        }

    async def get_graph(self, incident_id: Any) -> dict[str, Any] | None:
        return None


@pytest.mark.asyncio
async def test_threat_analysis_orchestration_success(
    client: AsyncClient, user_1_headers: dict
) -> None:
    # 1. Create incident and upload evidence
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Incident with abusive text",
            "description": "Repeated harassing messages sent daily.",
            "category": "general_harassment",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    files = {"file": ("screenshot.png", b"\x89PNG\r\n\x1a\n" + b"test_screenshot_bytes", "image/png")}
    ev_resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    evidence_id = ev_resp.json()["id"]

    # Override intelligence client with mock returning success
    mock_ai = MockIntelligenceClient(mode="success")
    client._transport.app.dependency_overrides[get_intelligence_client] = lambda: mock_ai

    # Request analysis
    analysis_resp = await client.post(
        f"/api/v1/incidents/{incident_id}/analysis",
        json={"evidence_ids": [evidence_id], "include_description": True},
        headers=user_1_headers,
    )
    assert analysis_resp.status_code == 200
    data = analysis_resp.json()

    assert data["incident_id"] == incident_id
    assert data["status"] == "completed"
    assert data["classification"]["label"] == "general_harassment"
    assert data["classification"]["confidence_type"] == "model_score_not_calibrated_probability"
    assert data["risk"]["score"] == 45
    assert data["risk"]["level"] == "moderate"
    assert len(data["limitations"]) > 0

    # Verify persisted analysis is retrievable
    list_resp = await client.get(
        f"/api/v1/incidents/{incident_id}/analysis",
        headers=user_1_headers,
    )
    assert list_resp.status_code == 200
    assert len(list_resp.json()["items"]) == 1


@pytest.mark.asyncio
async def test_threat_analysis_upstream_unavailable_never_fabricates(
    client: AsyncClient, user_1_headers: dict
) -> None:
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Incident testing AI failure",
            "description": "Testing service down behavior",
            "category": "threat",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    mock_ai = MockIntelligenceClient(mode="unavailable")
    client._transport.app.dependency_overrides[get_intelligence_client] = lambda: mock_ai

    resp = await client.post(
        f"/api/v1/incidents/{incident_id}/analysis",
        json={"evidence_ids": [], "include_description": True},
        headers=user_1_headers,
    )
    # Never fabricate success: returns 503 SERVICE_UNAVAILABLE
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "SERVICE_UNAVAILABLE"


@pytest.mark.asyncio
async def test_threat_analysis_upstream_error_never_fabricates(
    client: AsyncClient, user_1_headers: dict
) -> None:
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Incident testing AI 500",
            "description": "Testing upstream 500 error",
            "category": "threat",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    mock_ai = MockIntelligenceClient(mode="upstream_error")
    client._transport.app.dependency_overrides[get_intelligence_client] = lambda: mock_ai

    resp = await client.post(
        f"/api/v1/incidents/{incident_id}/analysis",
        json={"evidence_ids": [], "include_description": True},
        headers=user_1_headers,
    )
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "UPSTREAM_ERROR"


@pytest.mark.asyncio
async def test_cross_user_analysis_access_denied(
    client: AsyncClient, user_1_headers: dict, user_2_headers: dict
) -> None:
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "User 1 incident for analysis",
            "description": "description",
            "category": "general_harassment",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    # User 2 tries to trigger analysis on User 1's incident -> 404
    resp = await client.post(
        f"/api/v1/incidents/{incident_id}/analysis",
        json={"evidence_ids": [], "include_description": True},
        headers=user_2_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_incident_graph_endpoint(
    client: AsyncClient, user_1_headers: dict
) -> None:
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Graph Root Incident",
            "description": "description",
            "category": "general_harassment",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    resp = await client.get(f"/api/v1/graph/{incident_id}", headers=user_1_headers)
    assert resp.status_code == 200
    graph = resp.json()
    assert graph["incident_id"] == incident_id
    assert "nodes" in graph
    assert "edges" in graph
    assert len(graph["nodes"]) >= 1
    assert graph["nodes"][0]["id"] == incident_id
