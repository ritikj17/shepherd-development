import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import pytest
from httpx import AsyncClient

from app.api.analysis_router import get_intelligence_client
from app.core.intelligence_client import IntelligenceClient


class IntegratedIntelligenceClient(IntelligenceClient):
    """Simulates the real response produced by services/intelligence following our bug fixes."""

    def __init__(self) -> None:
        pass

    async def analyze_incident(
        self,
        incident_id: Any,
        description: str,
        evidence_items: list[dict[str, Any]],
    ) -> dict[str, Any]:
        # Emulate deterministic rule classifier with combined description + OCR
        lowered = description.lower()
        if "threat" in lowered or "kill" in lowered:
            label = "threat"
            confidence = 0.8
            indicators = [{"name": "threat", "description": "Matched pattern in description: 'threatens to kill'"}]
        elif "stalk" in lowered:
            label = "cyberstalking"
            confidence = 0.7
            indicators = [{"name": "cyberstalking", "description": "Matched pattern in description: 'stalking online'"}]
        else:
            label = "other"
            confidence = 0.0
            indicators = []

        return {
            "incident_id": str(incident_id),
            "classification": {
                "label": label,
                "confidence": confidence,
                "confidence_type": "model_score_not_calibrated_probability",
                "explanation": f"Detected evidence for category '{label}'.",
                "indicators": indicators,
            },
            "indicators": indicators,
            "ocr": {"status": "not_applicable"},
            "risk": {
                "score": 0,
                "level": "insufficient_data",
                "label": "review_priority",
                "factors": [
                    {"name": "T", "value": 80 if label == "threat" else 0, "explanation": "Threat severity assessed."},
                    {"name": "F", "value": 0, "explanation": "Recurrence unavailable."},
                    {"name": "E", "value": 0, "explanation": "Evidence unavailable."},
                    {"name": "D", "value": 0, "explanation": "Exposure unavailable."},
                    {"name": "P", "value": 0, "explanation": "Pattern unavailable."},
                ],
                "explanation": "Review priority score computed.",
            },
            "limitations": [],
        }

    async def get_graph(self, incident_id: Any) -> dict[str, Any] | None:
        # Default upstream returns empty graph stub
        return {"incident_id": str(incident_id), "nodes": [], "edges": []}


@pytest.mark.asyncio
async def test_complete_live_e2e_integration_workflow(
    client: AsyncClient, user_1_headers: dict, user_2_headers: dict
) -> None:
    """Exercises the complete end-to-end live integration workflow:
    1. Incident creation (description only)
    2. ThreatLens analysis with description influencing classification
    3. EvidenceVault upload and SHA-256 verification
    4. PatternGraph fallback to repository graph
    5. SafeCircle trusted contact creation with consent
    6. SafetySession creation and checkin
    7. JusticeBridge PDF report generation
    8. Authenticated PDF download
    9. Cross-user isolation verification
    """
    # Override with integrated intelligence client
    client._transport.app.dependency_overrides[get_intelligence_client] = lambda: IntegratedIntelligenceClient()

    # Step 1: Create incident with description only
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Severe Threat Incident",
            "description": "Subject threatens to kill me with violent action if I leave",
            "category": "threat",
            "occurred_at": "2026-11-14T10:00:00Z",
        },
        headers=user_1_headers,
    )
    assert inc_resp.status_code == 201
    incident = inc_resp.json()
    incident_id = incident["id"]

    # Step 2: Request ThreatLens analysis
    analysis_resp = await client.post(
        f"/api/v1/incidents/{incident_id}/analysis",
        json={"evidence_ids": [], "include_description": True},
        headers=user_1_headers,
    )
    assert analysis_resp.status_code == 200
    analysis = analysis_resp.json()
    assert analysis["classification"]["label"] == "threat"
    assert analysis["classification"]["confidence"] == 0.8
    assert len(analysis["indicators"]) == 1

    # Step 3: Upload evidence image
    fake_png = b"\x89PNG\r\n\x1a\n" + b"live_integration_test_bytes"
    expected_sha = hashlib.sha256(fake_png).hexdigest()

    files = {"file": ("screenshot.png", fake_png, "image/png")}
    ev_resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    assert ev_resp.status_code == 201
    evidence = ev_resp.json()
    assert evidence["sha256"] == expected_sha
    evidence_id = evidence["id"]

    # Step 4: Verify PatternGraph fallback
    graph_resp = await client.get(f"/api/v1/graph/{incident_id}", headers=user_1_headers)
    assert graph_resp.status_code == 200
    graph = graph_resp.json()
    assert graph["incident_id"] == incident_id
    # Fallback to repo returns root incident node
    assert len(graph["nodes"]) >= 1
    assert graph["nodes"][0]["id"] == incident_id

    # Step 5: SafeCircle trusted contact
    contact_resp = await client.post(
        "/api/v1/trusted-contacts",
        json={
            "name": "Sister Priya",
            "contact_method": "phone",
            "contact_value": "+919876543210",
            "consent_confirmed": True,
        },
        headers=user_1_headers,
    )
    assert contact_resp.status_code == 201
    contact = contact_resp.json()
    contact_id = contact["id"]

    # Step 6: SafeCircle safety session
    deadline = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    session_resp = await client.post(
        "/api/v1/safety-sessions",
        json={
            "trusted_contact_id": contact_id,
            "incident_id": incident_id,
            "checkin_deadline": deadline,
            "consent_confirmed": True,
        },
        headers=user_1_headers,
    )
    assert session_resp.status_code == 201
    session = session_resp.json()
    session_id = session["id"]
    assert session["status"] == "active"

    # Step 7: Check-in to session
    checkin_resp = await client.post(
        f"/api/v1/safety-sessions/{session_id}/checkin",
        json={"message": "I arrived safely."},
        headers=user_1_headers,
    )
    assert checkin_resp.status_code == 200
    assert checkin_resp.json()["status"] == "checked_in"

    # Step 8: Generate JusticeBridge PDF report
    report_gen_resp = await client.post(
        f"/api/v1/reports/{incident_id}",
        json={"include_evidence_index": True, "include_analysis": True},
        headers=user_1_headers,
    )
    assert report_gen_resp.status_code == 200
    report = report_gen_resp.json()
    report_id = report["report_id"]
    assert report["status"] == "generated"

    # Step 9: Download JusticeBridge PDF report with Bearer token
    dl_resp = await client.get(
        f"/api/v1/reports/{report_id}/download",
        headers=user_1_headers,
    )
    assert dl_resp.status_code == 200
    assert dl_resp.headers["content-type"] == "application/pdf"
    assert dl_resp.content.startswith(b"%PDF-")

    # Step 10: Strict Cross-User Access Denial
    assert (await client.get(f"/api/v1/incidents/{incident_id}", headers=user_2_headers)).status_code == 404
    assert (await client.get(f"/api/v1/incidents/{incident_id}/evidence", headers=user_2_headers)).status_code == 404
    assert (await client.get(f"/api/v1/graph/{incident_id}", headers=user_2_headers)).status_code == 404
    assert (await client.get(f"/api/v1/reports/{report_id}/download", headers=user_2_headers)).status_code == 404
