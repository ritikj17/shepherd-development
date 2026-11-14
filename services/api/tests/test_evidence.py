import hashlib
from typing import Any
from uuid import UUID, uuid4
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
    files = {"file": ("hack.png", b"\x89PNG\r\n\x1a\nvalid_png_bytes", "image/png")}
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

    files = {"file": ("test.png", b"\x89PNG\r\n\x1a\nvalid_png_payload", "image/png")}
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


@pytest.mark.asyncio
async def test_upload_evidence_misleading_mime_header_rejected(
    client: AsyncClient, user_1_headers: dict
) -> None:
    """[DEFECT-01 REGRESSION]: Reject uploads where Content-Type does not match file magic bytes."""
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Incident for magic bytes test",
            "description": "desc",
            "category": "threat",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    # 1. Executable with image/png header
    files = {"file": ("fake.png", b"MZ\x90\x00this_is_an_exe", "image/png")}
    resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"

    # 2. HTML script with image/jpeg header
    files = {"file": ("fake.jpg", b"<script>alert(1)</script>", "image/jpeg")}
    resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"

    # 3. Plain text with image/webp header
    files = {"file": ("fake.webp", b"Just some plain text data", "image/webp")}
    resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files=files,
        headers=user_1_headers,
    )
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


@pytest.mark.asyncio
async def test_upload_evidence_all_supported_formats_with_magic_bytes(
    client: AsyncClient, user_1_headers: dict
) -> None:
    """Verify JPEG, PNG, and WebP uploads succeed when genuine magic bytes are provided."""
    inc_resp = await client.post(
        "/api/v1/incidents",
        json={
            "title": "Incident for valid image formats",
            "description": "desc",
            "category": "threat",
            "occurred_at": "2026-11-12T10:00:00Z",
        },
        headers=user_1_headers,
    )
    incident_id = inc_resp.json()["id"]

    # 1. Valid JPEG
    jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00valid_jpeg"
    resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files={"file": ("photo.jpg", jpeg_bytes, "image/jpeg")},
        headers=user_1_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["mime_type"] == "image/jpeg"

    # 2. Valid WebP (RIFF + 4-byte size + WEBP + payload)
    webp_bytes = b"RIFF\x20\x00\x00\x00WEBPVP8 \x14\x00\x00\x00valid_webp_data_chunk"
    resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files={"file": ("image.webp", webp_bytes, "image/webp")},
        headers=user_1_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["mime_type"] == "image/webp"

    # 3. Valid PNG
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRvalid_png_data"
    resp = await client.post(
        "/api/v1/evidence",
        data={"incident_id": incident_id},
        files={"file": ("screenshot.png", png_bytes, "image/png")},
        headers=user_1_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["mime_type"] == "image/png"


@pytest.mark.asyncio
async def test_supabase_deletion_ordering_deletes_storage_before_db() -> None:
    """[DEFECT-02 REGRESSION]: Ensure Supabase repository issues storage deletion before DB row deletion."""
    from unittest.mock import AsyncMock, patch
    from app.core.config import Settings
    from app.database.supabase_client import SupabasePostgrestRepository
    from app.models.evidence import EvidenceUploadResponse
    from app.models.incident import IncidentResponse, IncidentStatus, IncidentCategory
    from datetime import datetime, timezone

    settings = Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        use_in_memory_adapter=False,
    )
    repo = SupabasePostgrestRepository(settings)

    test_user_id = uuid4()
    test_incident_id = uuid4()
    test_evidence_id = uuid4()

    mock_incident = IncidentResponse(
        id=test_incident_id,
        user_id=test_user_id,
        title="Test Inc",
        description="Desc",
        category=IncidentCategory.THREAT,
        occurred_at=datetime.now(timezone.utc),
        status=IncidentStatus.OPEN,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    mock_evidence = EvidenceUploadResponse(
        id=test_evidence_id,
        incident_id=test_incident_id,
        file_name="evidence.png",
        mime_type="image/png",
        size_bytes=100,
        sha256="a" * 64,
        uploaded_at=datetime.now(timezone.utc),
        storage_status="stored",
    )

    call_order: list[str] = []

    async def mock_get_incident(u_id: UUID, i_id: UUID) -> IncidentResponse:
        call_order.append("get_incident")
        return mock_incident

    async def mock_list_evidence(u_id: UUID, i_id: UUID) -> list[EvidenceUploadResponse]:
        call_order.append("list_evidence")
        return [mock_evidence]

    async def mock_delete_storage(bucket: str, path: str) -> None:
        call_order.append("delete_storage_object")

    repo.get_incident = mock_get_incident  # type: ignore
    repo.list_evidence = mock_list_evidence  # type: ignore
    repo._delete_storage_object = mock_delete_storage  # type: ignore

    mock_http_resp = AsyncMock()
    mock_http_resp.status_code = 200

    mock_http_client = AsyncMock()
    mock_http_client.delete = AsyncMock(return_value=mock_http_resp)

    async def mock_client_delete(endpoint: str, params: dict) -> AsyncMock:
        call_order.append("db_delete_incident")
        return mock_http_resp

    mock_http_client.delete.side_effect = mock_client_delete

    class MockClientContext:
        async def __aenter__(self) -> AsyncMock:
            return mock_http_client
        async def __aexit__(self, *args: Any) -> None:
            pass

    repo._client = lambda: MockClientContext()  # type: ignore

    await repo.delete_incident(test_user_id, test_incident_id)

    # Verify that storage deletion strictly precedes database row deletion
    assert "delete_storage_object" in call_order
    assert "db_delete_incident" in call_order
    storage_idx = call_order.index("delete_storage_object")
    db_idx = call_order.index("db_delete_incident")
    assert storage_idx < db_idx, f"Expected storage deletion before DB deletion, got: {call_order}"

