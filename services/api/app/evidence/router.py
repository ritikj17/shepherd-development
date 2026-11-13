from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser
from app.core.exceptions import BadRequestError
from app.database.base import BaseRepository
from app.database.dependencies import get_repository
from app.models.evidence import (
    EvidenceListResponse,
    EvidenceUploadResponse,
    EvidenceVerifyRequest,
    EvidenceVerifyResponse,
)

router = APIRouter(prefix="/api/v1", tags=["EvidenceVault"])


@router.post(
    "/evidence",
    response_model=EvidenceUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload private evidence file",
)
async def upload_evidence(
    incident_id: UUID = Form(...),
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
) -> EvidenceUploadResponse:
    """Upload private evidence to private storage bucket.

    Validates incident ownership, MIME type and file size. Calculates SHA-256 on received bytes.
    Does not expose permanent public storage URL.
    """
    if not file.filename:
        raise BadRequestError("File must have a filename.")

    content = await file.read()
    mime_type = file.content_type or "application/octet-stream"

    return await repo.upload_evidence(
        user_id=current_user.id,
        incident_id=incident_id,
        file_name=file.filename,
        mime_type=mime_type,
        content=content,
    )


@router.get(
    "/incidents/{incident_id}/evidence",
    response_model=EvidenceListResponse,
    summary="List evidence files for an owned incident",
)
async def list_incident_evidence(
    incident_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
) -> EvidenceListResponse:
    items = await repo.list_evidence(current_user.id, incident_id)
    return EvidenceListResponse(items=items)


@router.post(
    "/evidence/verify",
    response_model=EvidenceVerifyResponse,
    summary="Verify evidence file integrity via SHA-256 re-hash",
)
async def verify_evidence_hash(
    data: EvidenceVerifyRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
) -> EvidenceVerifyResponse:
    """Re-reads stored file bytes from private storage and verifies SHA-256 matches recorded hash."""
    return await repo.verify_evidence(current_user.id, data.evidence_id)
