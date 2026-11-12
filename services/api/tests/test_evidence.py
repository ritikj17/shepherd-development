import hashlib
from uuid import uuid4
import pytest
from httpx import AsyncClient

from app.database.in_memory import InMemoryRepository


@pytest.mark.asyncio
async def test_upload_evidence_success_and_sha256(
    client: AsyncClient, user_1_headers: dict
) -> None:
    # 1. Create incident
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Incident with Screenshot",
            "description": "User uploaded screenshot evidence",
            "category": "general_harassment",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    # 2. Upload synthetic PNG evidence
    file_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRsynthetic-evidence-bytes"
    expected_sha256 = hashlib.sha256(file_bytes).hexdigest().lower()

    files = {"file": ("test_evidence.png", file_bytes, "image/png")}
    data = {"incident_id": incident_id}

    resp = await client.post("/api/v1/evidence", data=data, files=files, headers=user_1_headers)
    assert resp.status_code == 201
    ev_data = resp.json()

    assert ev_data["incident_id"] == incident_id
    assert ev_data["file_name"] == "test_evidence.png"
    assert ev_data["mime_type"] == "image/png"
    assert ev_data["size_bytes"] == len(file_bytes)
    assert ev_data["sha256"] == expected_sha256
    assert ev_data["storage_status"] == "stored"
    # Never contain a public storage URL
    assert "public_url" not in ev_data
    assert "url" not in ev_data


@pytest.mark.asyncio
async def test_upload_evidence_unsupported_media_type(
    client: AsyncClient, user_1_headers: dict
) -> None:
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Incident test",
            "description": "Testing MIME rejection",
            "category": "threat",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    files = {"file": ("malicious.exe", b"MZ\x90\x00executable", "application/x-dosexec")}
    resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


@pytest.mark.asyncio
async def test_upload_evidence_size_limit_exceeded(
    client: AsyncClient, user_1_headers: dict
) -> None:
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Size test",
            "description": "Testing 10MB limit",
            "category": "threat",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    # 10 MB + 1 byte
    too_large_bytes = b"X" * (10 * 1024 * 1024 + 1)
    files = {"file": ("huge.png", too_large_bytes, "image/png")}
    resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


@pytest.mark.asyncio
async def test_upload_evidence_empty_file_rejected(
    client: AsyncClient, user_1_headers: dict
) -> None:
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Empty file test",
            "description": "Testing empty file",
            "category": "threat",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    files = {"file": ("empty.png", b"", "image/png")}
    resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "BAD_REQUEST"


@pytest.mark.asyncio
async def test_cross_user_evidence_upload_and_verify_denied(
    client: AsyncClient, user_1_headers: dict, user_2_headers: dict, repo: InMemoryRepository
) -> None:
    # User 1 creates incident and uploads evidence
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "User 1 incident",
            "description": "desc",
            "category": "general_harassment",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    # User 2 tries to upload evidence to User 1's incident -> 404
    files = {"file": ("hack.png", b"testbytes", "image/png")}
    forbidden_upload = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_2_headers,
    )
    assert forbidden_upload.status_code == 404

    # User 1 uploads valid evidence
    valid_upload = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    assert valid_upload.status_code == 201
    evidence_id = valid_upload.json()["id"]

    # User 2 tries to list User 1's evidence -> 404
    forbidden_list = await client.get(
        f"/api/v1/incidents/{incident_id}/evidence",
        headers=user_2_headers,
    )
    assert forbidden_list.status_code == 404

    # User 2 tries to verify User 1's evidence -> 404
    forbidden_verify = await client.post(
        "/api/v1/evidence/verify",
        json={"evidence_id": evidence_id},
        headers=user_2_headers,
    )
    assert forbidden_verify.status_code == 404

    # User 1 verifies evidence -> 200 matches: true
    user_1_verify = await client.post(
        "/api/v1/evidence/verify",
        json={"evidence_id": evidence_id},
        headers=user_1_headers,
    )
    assert user_1_verify.status_code == 200
    v_data = user_1_verify.json()
    assert v_data["matches"] is True
    assert v_data["stored_sha256"] == v_data["current_sha256"]

    # Simulate byte tampering in storage and re-verify -> matches: false
    ev_record = repo.evidence[list(repo.evidence.keys())[0]]
    repo.storage[ev_record["storage_path"]] = b"tampered_bytes_in_storage"

    tampered_verify = await client.post(
        "/api/v1/evidence/verify",
        json={"evidence_id": evidence_id},
        headers=user_1_headers,
    )
    assert tampered_verify.status_code == 200
    tampered_data = tampered_verify.json()
    assert tampered_data["matches"] is False
    assert tampered_data["stored_sha256"] != tampered_data["current_sha256"]


@pytest.mark.asyncio
async def test_delete_incident_cascades_evidence(
    client: AsyncClient, user_1_headers: dict, repo: InMemoryRepository
) -> None:
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Incident to delete",
            "description": "desc",
            "category": "threat",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    files = {"file": ("test.png", b"testpngbytes", "image/png")}
    up_resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    assert up_resp.status_code == 201
    assert len(repo.evidence) == 1
    assert len(repo.storage) == 1

    # Delete incident
    del_resp = await client.delete(f"/api/v1/incidents/{incident_id}", headers=user_1_headers)
    assert del_resp.status_code == 204

    # Verify database and storage cascade cleanup
    assert len(repo.evidence) == 0
    assert len(repo.storage) == 0
