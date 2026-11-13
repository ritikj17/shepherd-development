import io
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.reports.repository import reset_report_repository

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00"
    b"\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture(autouse=True)
def clean_reports_state():
    reset_report_repository()
    yield
    reset_report_repository()


@pytest.mark.asyncio
async def test_generate_report_success(client: AsyncClient, user_1_headers: dict[str, str]):
    # 1. Create incident
    inc_payload = {
        "title": "Threatening DMs",
        "description": "User received explicit threats on social media.",
        "category": "threat",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "location_description": "Online chat",
    }
    inc_resp = await client.post("/api/v1/incidents", json=inc_payload, headers=user_1_headers)
    assert inc_resp.status_code == 201
    incident_id = inc_resp.json()["id"]

    # 2. Upload evidence
    files = {"file": ("screenshot.png", PNG_BYTES, "image/png")}
    ev_resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    assert ev_resp.status_code == 201

    # 3. Request report generation
    rep_resp = await client.post(
        f"/api/v1/reports/{incident_id}",
        json={"include_evidence_index": True, "include_analysis": True},
        headers=user_1_headers,
    )
    assert rep_resp.status_code == 200
    rep_data = rep_resp.json()
    assert rep_data["status"] == "generated"
    assert rep_data["incident_id"] == incident_id
    assert "download_url" in rep_data
    assert "report_id" in rep_data
    assert rep_data["file_name"].endswith(".pdf")


@pytest.mark.asyncio
async def test_download_report_pdf(client: AsyncClient, user_1_headers: dict[str, str]):
    # Create incident
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Harassment Incident",
            "description": "Evidence attached.",
            "category": "cyberstalking",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    # Upload evidence
    files = {"file": ("threat.png", PNG_BYTES, "image/png")}
    await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )

    # Generate report
    rep_resp = await client.post(
        f"/api/v1/reports/{incident_id}",
        json={"include_evidence_index": True, "include_analysis": True},
        headers=user_1_headers,
    )
    report_id = rep_resp.json()["report_id"]
    download_url = rep_resp.json()["download_url"]

    # Download PDF
    dl_resp = await client.get(download_url, headers=user_1_headers)
    assert dl_resp.status_code == 200
    assert dl_resp.headers["content-type"] == "application/pdf"
    assert "attachment" in dl_resp.headers["content-disposition"]
    # PDF magic bytes
    assert dl_resp.content.startswith(b"%PDF-")
    assert len(dl_resp.content) > 1000


@pytest.mark.asyncio
async def test_report_cross_user_generation_denied(
    client: AsyncClient, user_1_headers: dict[str, str], user_2_headers: dict[str, str]
):
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Private Incident",
            "description": "User 1 private event.",
            "category": "general_harassment",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    # User 2 attempts to generate report for User 1's incident
    rep_resp = await client.post(
        f"/api/v1/reports/{incident_id}",
        json={"include_evidence_index": True, "include_analysis": True},
        headers=user_2_headers,
    )
    assert rep_resp.status_code == 404
    assert rep_resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_report_cross_user_download_denied(
    client: AsyncClient, user_1_headers: dict[str, str], user_2_headers: dict[str, str]
):
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Private Incident",
            "description": "Secret details.",
            "category": "threat",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    rep_resp = await client.post(
        f"/api/v1/reports/{incident_id}",
        json={"include_evidence_index": False, "include_analysis": False},
        headers=user_1_headers,
    )
    report_id = rep_resp.json()["report_id"]

    # User 2 attempts to download User 1's report
    dl_resp = await client.get(f"/api/v1/reports/{report_id}/download", headers=user_2_headers)
    assert dl_resp.status_code == 404
    assert dl_resp.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_list_reports_isolation(
    client: AsyncClient, user_1_headers: dict[str, str], user_2_headers: dict[str, str]
):
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Incident 1",
            "description": "Desc",
            "category": "general_harassment",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    await client.post(
        f"/api/v1/reports/{incident_id}",
        json={"include_evidence_index": True, "include_analysis": True},
        headers=user_1_headers,
    )

    # User 1 should see 1 report
    r1 = await client.get("/api/v1/reports", headers=user_1_headers)
    assert r1.status_code == 200
    assert len(r1.json()) == 1

    # User 2 should see 0 reports
    r2 = await client.get("/api/v1/reports", headers=user_2_headers)
    assert r2.status_code == 200
    assert len(r2.json()) == 0
