from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


ALLOWED_EVIDENCE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


class EvidenceUploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    incident_id: UUID
    file_name: str
    mime_type: str
    size_bytes: int
    sha256: str = Field(..., pattern=r"^[0-9a-f]{64}$")
    uploaded_at: datetime
    storage_status: Literal["stored"] = "stored"


class EvidenceListResponse(BaseModel):
    items: list[EvidenceUploadResponse]


class EvidenceVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_id: UUID


class EvidenceVerifyResponse(BaseModel):
    evidence_id: UUID
    stored_sha256: str
    current_sha256: str
    matches: bool
    verified_at: datetime
    message: str
