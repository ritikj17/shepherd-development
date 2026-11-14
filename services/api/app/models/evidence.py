from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.exceptions import UnsupportedMediaTypeError

ALLOWED_EVIDENCE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


def validate_evidence_content(content: bytes, declared_mime_type: str) -> None:
    """Validate that binary content matches the declared image MIME type via magic bytes.

    Rejects spoofed Content-Type headers where arbitrary bytes or malicious executables
    masquerade as images. Supported: image/jpeg, image/png, image/webp.
    """
    if len(content) < 4:
        raise UnsupportedMediaTypeError("File content too small to be a valid image.")

    if declared_mime_type == "image/jpeg":
        if not content.startswith(b"\xff\xd8\xff"):
            raise UnsupportedMediaTypeError("File signature does not match image/jpeg format.")
    elif declared_mime_type == "image/png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise UnsupportedMediaTypeError("File signature does not match image/png format.")
    elif declared_mime_type == "image/webp":
        if len(content) < 12 or not (content.startswith(b"RIFF") and content[8:12] == b"WEBP"):
            raise UnsupportedMediaTypeError("File signature does not match image/webp format.")
    else:
        raise UnsupportedMediaTypeError(
            f"Unsupported media type '{declared_mime_type}'. Supported: {', '.join(sorted(ALLOWED_EVIDENCE_MIME_TYPES))}"
        )



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
