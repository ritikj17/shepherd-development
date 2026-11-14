import hashlib
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from app.core.exceptions import (
    BadRequestError,
    NotFoundError,
    PayloadTooLargeError,
    UnsupportedMediaTypeError,
)
from app.database.base import BaseRepository
from app.models.analysis import (
    ClassificationResult,
    GraphEdge,
    GraphNode,
    IncidentGraphResponse,
    Indicator,
    OCRSummary,
    RiskAssessment,
    ThreatAnalysisResponse,
)
from app.models.evidence import (
    ALLOWED_EVIDENCE_MIME_TYPES,
    EvidenceUploadResponse,
    EvidenceVerifyResponse,
    validate_evidence_content,
)
from app.models.incident import (
    IncidentCategory,
    IncidentCreate,
    IncidentResponse,
    IncidentStatus,
    IncidentUpdate,
)


def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "_", name)
    return cleaned or "evidence_file"


class InMemoryRepository(BaseRepository):
    """In-memory repository implementing full ownership checks and byte verification.

    Used for unit tests and local development when Supabase credentials are not configured.
    All storage and records are isolated by authenticated user_id.
    """

    def __init__(self, max_upload_bytes: int = 10 * 1024 * 1024) -> None:
        self.max_upload_bytes = max_upload_bytes
        # In-memory stores
        self.incidents: dict[UUID, dict] = {}
        self.evidence: dict[UUID, dict] = {}
        self.storage: dict[str, bytes] = {}  # storage_path -> bytes
        self.threat_analyses: dict[UUID, dict] = {}
        self.incident_links: list[dict] = []

    # ---------------- Incidents ----------------
    async def create_incident(self, user_id: UUID, data: IncidentCreate) -> IncidentResponse:
        incident_id = uuid4()
        now = datetime.now(timezone.utc)
        record = {
            "id": incident_id,
            "user_id": user_id,
            "title": data.title,
            "description": data.description,
            "category": data.category,
            "occurred_at": data.occurred_at,
            "location_description": data.location_description,
            "status": IncidentStatus.OPEN,
            "created_at": now,
            "updated_at": now,
        }
        self.incidents[incident_id] = record
        return IncidentResponse(**record)

    async def list_incidents(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
        category: Optional[IncidentCategory] = None,
        status: Optional[IncidentStatus] = None,
    ) -> tuple[list[IncidentResponse], int]:
        user_records = [
            r for r in self.incidents.values()
            if r["user_id"] == user_id
        ]
        if category:
            user_records = [r for r in user_records if r["category"] == category]
        if status:
            user_records = [r for r in user_records if r["status"] == status]

        user_records.sort(key=lambda x: x["occurred_at"], reverse=True)
        total = len(user_records)
        paged = user_records[offset : offset + limit]
        return [IncidentResponse(**r) for r in paged], total

    async def get_incident(self, user_id: UUID, incident_id: UUID) -> IncidentResponse:
        record = self.incidents.get(incident_id)
        if not record or record["user_id"] != user_id:
            raise NotFoundError("Incident not found.")
        return IncidentResponse(**record)

    async def update_incident(self, user_id: UUID, incident_id: UUID, data: IncidentUpdate) -> IncidentResponse:
        record = self.incidents.get(incident_id)
        if not record or record["user_id"] != user_id:
            raise NotFoundError("Incident not found.")

        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return IncidentResponse(**record)

        for key, value in update_dict.items():
            record[key] = value
        record["updated_at"] = datetime.now(timezone.utc)
        return IncidentResponse(**record)

    async def delete_incident(self, user_id: UUID, incident_id: UUID) -> None:
        record = self.incidents.get(incident_id)
        if not record or record["user_id"] != user_id:
            raise NotFoundError("Incident not found.")

        # Cascade: delete associated evidence and storage objects
        evidence_to_delete = [
            e_id for e_id, e in self.evidence.items()
            if e["incident_id"] == incident_id
        ]
        for e_id in evidence_to_delete:
            storage_path = self.evidence[e_id]["storage_path"]
            self.storage.pop(storage_path, None)
            self.evidence.pop(e_id, None)

        # Cascade: delete associated analyses
        analyses_to_delete = [
            a_id for a_id, a in self.threat_analyses.items()
            if a["incident_id"] == incident_id
        ]
        for a_id in analyses_to_delete:
            self.threat_analyses.pop(a_id, None)

        # Cascade: delete links
        self.incident_links = [
            l for l in self.incident_links
            if l["source_incident_id"] != incident_id and l["target_incident_id"] != incident_id
        ]

        self.incidents.pop(incident_id, None)

    # ---------------- Evidence ----------------
    async def upload_evidence(
        self,
        user_id: UUID,
        incident_id: UUID,
        file_name: str,
        mime_type: str,
        content: bytes,
    ) -> EvidenceUploadResponse:
        # Check incident ownership
        await self.get_incident(user_id, incident_id)

        # Validate MIME type
        if mime_type not in ALLOWED_EVIDENCE_MIME_TYPES:
            raise UnsupportedMediaTypeError(
                f"Unsupported media type '{mime_type}'. Supported: {', '.join(sorted(ALLOWED_EVIDENCE_MIME_TYPES))}"
            )

        # Validate size
        size_bytes = len(content)
        if size_bytes == 0:
            raise BadRequestError("Cannot upload an empty file.")
        if size_bytes > self.max_upload_bytes:
            raise PayloadTooLargeError(
                f"File size {size_bytes} bytes exceeds maximum {self.max_upload_bytes} bytes."
            )

        # Validate content magic bytes (prevents header spoofing)
        validate_evidence_content(content, mime_type)

        # Compute SHA-256 on received bytes
        sha256_hash = hashlib.sha256(content).hexdigest().lower()
        evidence_id = uuid4()
        safe_name = _sanitize_filename(file_name)
        storage_path = f"{user_id}/{incident_id}/{evidence_id}/{safe_name}"

        # Store in private bucket storage
        self.storage[storage_path] = content
        now = datetime.now(timezone.utc)

        record = {
            "id": evidence_id,
            "incident_id": incident_id,
            "user_id": user_id,
            "file_name": safe_name,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "storage_bucket": "shepherd-evidence",
            "storage_path": storage_path,
            "sha256": sha256_hash,
            "uploaded_at": now,
        }
        self.evidence[evidence_id] = record

        return EvidenceUploadResponse(
            id=evidence_id,
            incident_id=incident_id,
            file_name=safe_name,
            mime_type=mime_type,
            size_bytes=size_bytes,
            sha256=sha256_hash,
            uploaded_at=now,
            storage_status="stored",
        )

    async def list_evidence(self, user_id: UUID, incident_id: UUID) -> list[EvidenceUploadResponse]:
        # Validate incident ownership
        await self.get_incident(user_id, incident_id)

        items = [
            EvidenceUploadResponse(
                id=e["id"],
                incident_id=e["incident_id"],
                file_name=e["file_name"],
                mime_type=e["mime_type"],
                size_bytes=e["size_bytes"],
                sha256=e["sha256"],
                uploaded_at=e["uploaded_at"],
                storage_status="stored",
            )
            for e in self.evidence.values()
            if e["incident_id"] == incident_id and e["user_id"] == user_id
        ]
        items.sort(key=lambda x: x.uploaded_at, reverse=True)
        return items

    async def get_evidence_bytes(self, user_id: UUID, evidence_id: UUID) -> tuple[bytes, str, str]:
        record = self.evidence.get(evidence_id)
        if not record or record["user_id"] != user_id:
            raise NotFoundError("Evidence not found.")

        content = self.storage.get(record["storage_path"])
        if content is None:
            raise NotFoundError("Stored evidence object missing from storage.")

        return content, record["mime_type"], record["file_name"]

    async def verify_evidence(self, user_id: UUID, evidence_id: UUID) -> EvidenceVerifyResponse:
        record = self.evidence.get(evidence_id)
        if not record or record["user_id"] != user_id:
            raise NotFoundError("Evidence not found.")

        stored_sha256 = record["sha256"]
        content = self.storage.get(record["storage_path"])
        if content is None:
            raise NotFoundError("Stored evidence file could not be read from storage.")

        current_sha256 = hashlib.sha256(content).hexdigest().lower()
        matches = current_sha256 == stored_sha256
        now = datetime.now(timezone.utc)

        msg = (
            "Stored file bytes match the original recorded hash."
            if matches
            else "Stored file bytes DO NOT match the original recorded hash."
        )

        return EvidenceVerifyResponse(
            evidence_id=evidence_id,
            stored_sha256=stored_sha256,
            current_sha256=current_sha256,
            matches=matches,
            verified_at=now,
            message=msg,
        )

    # ---------------- Threat Analysis ----------------
    async def save_threat_analysis(
        self,
        user_id: UUID,
        incident_id: UUID,
        analysis_data: dict,
    ) -> ThreatAnalysisResponse:
        await self.get_incident(user_id, incident_id)

        analysis_id = analysis_data.get("analysis_id") or uuid4()
        now = datetime.now(timezone.utc)

        raw_record = {
            "id": analysis_id,
            "incident_id": incident_id,
            "user_id": user_id,
            "status": analysis_data.get("status", "completed"),
            "classification": analysis_data["classification"],
            "indicators": analysis_data.get("indicators", []),
            "risk": analysis_data.get("risk", {"explanation": "N/A"}),
            "ocr": analysis_data.get("ocr", {"status": "not_applicable", "text_available": False}),
            "limitations": analysis_data.get("limitations", []),
            "created_at": now,
        }
        self.threat_analyses[analysis_id] = raw_record

        return ThreatAnalysisResponse(
            analysis_id=analysis_id,
            incident_id=incident_id,
            status=raw_record["status"],
            classification=ClassificationResult(**raw_record["classification"]),
            indicators=[Indicator(**i) for i in raw_record["indicators"]],
            risk=RiskAssessment(**raw_record["risk"]),
            ocr=OCRSummary(**raw_record["ocr"]),
            limitations=raw_record["limitations"],
            created_at=now,
        )

    async def list_threat_analyses(self, user_id: UUID, incident_id: UUID) -> list[ThreatAnalysisResponse]:
        await self.get_incident(user_id, incident_id)

        items = [
            ThreatAnalysisResponse(
                analysis_id=a["id"],
                incident_id=a["incident_id"],
                status=a["status"],
                classification=ClassificationResult(**a["classification"]),
                indicators=[Indicator(**i) for i in a["indicators"]],
                risk=RiskAssessment(**a["risk"]),
                ocr=OCRSummary(**a["ocr"]),
                limitations=a["limitations"],
                created_at=a["created_at"],
            )
            for a in self.threat_analyses.values()
            if a["incident_id"] == incident_id and a["user_id"] == user_id
        ]
        items.sort(key=lambda x: x.created_at, reverse=True)
        return items

    # ---------------- Incident Graph ----------------
    async def get_incident_graph(self, user_id: UUID, incident_id: UUID) -> IncidentGraphResponse:
        # Validate that the requested incident belongs to user
        target_incident = await self.get_incident(user_id, incident_id)

        # Find all user-owned incidents connected or relevant
        user_incidents = {
            r["id"]: r for r in self.incidents.values()
            if r["user_id"] == user_id
        }

        # Filter links belonging to user where target or source matches
        relevant_links = [
            l for l in self.incident_links
            if l["user_id"] == user_id
            and (l["source_incident_id"] == incident_id or l["target_incident_id"] == incident_id)
        ]

        # Gather involved node IDs
        involved_ids = {incident_id}
        for link in relevant_links:
            involved_ids.add(link["source_incident_id"])
            involved_ids.add(link["target_incident_id"])

        nodes = []
        for n_id in involved_ids:
            inc = user_incidents.get(n_id)
            if inc:
                nodes.append(GraphNode(id=inc["id"], label=inc["title"], category=inc["category"].value if hasattr(inc["category"], "value") else str(inc["category"])))

        edges = [
            GraphEdge(
                id=l.get("id") or uuid4(),
                source=l["source_incident_id"],
                target=l["target_incident_id"],
                relationship=l["relationship"],
                confidence=l.get("confidence"),
                explanation=l["explanation"],
            )
            for l in relevant_links
        ]

        return IncidentGraphResponse(
            incident_id=incident_id,
            nodes=nodes,
            edges=edges,
        )
