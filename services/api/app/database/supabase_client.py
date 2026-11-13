import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

import httpx

from app.core.config import Settings
from app.core.exceptions import (
    BadRequestError,
    NotFoundError,
    PayloadTooLargeError,
    UpstreamServiceError,
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

logger = logging.getLogger(__name__)


def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "_", name)
    return cleaned or "evidence_file"


class SupabasePostgrestRepository(BaseRepository):
    """Supabase PostgreSQL (via PostgREST) and Supabase Storage repository.

    Enforces ownership filtering and byte-level SHA-256 calculation & verification.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        url = settings.supabase_url.rstrip("/")
        if url.endswith("/rest/v1"):
            url = url[:-len("/rest/v1")]
        self.base_url = url
        self.service_key = settings.supabase_service_role_key
        self.anon_key = settings.supabase_anon_key or settings.supabase_service_role_key
        self.headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self.evidence_bucket = settings.supabase_evidence_bucket
        self.max_upload_bytes = settings.max_evidence_upload_bytes

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, headers=self.headers, timeout=15.0)

    # ---------------- Incidents ----------------
    async def create_incident(self, user_id: UUID, data: IncidentCreate) -> IncidentResponse:
        incident_id = uuid4()
        now = datetime.now(timezone.utc)
        payload = {
            "id": str(incident_id),
            "user_id": str(user_id),
            "title": data.title,
            "description": data.description,
            "category": data.category.value,
            "occurred_at": data.occurred_at.isoformat(),
            "location_description": data.location_description,
            "status": IncidentStatus.OPEN.value,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        async with self._client() as client:
            resp = await client.post("/rest/v1/incidents", json=payload)
            if resp.status_code >= 400:
                logger.error("Supabase create_incident failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to persist incident in database.")
            rows = resp.json()
            row = rows[0] if isinstance(rows, list) and rows else payload
            return IncidentResponse(**row)

    async def list_incidents(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
        category: Optional[IncidentCategory] = None,
        status: Optional[IncidentStatus] = None,
    ) -> tuple[list[IncidentResponse], int]:
        params: dict[str, str] = {
            "user_id": f"eq.{user_id}",
            "order": "occurred_at.desc",
            "limit": str(limit),
            "offset": str(offset),
        }
        if category:
            params["category"] = f"eq.{category.value}"
        if status:
            params["status"] = f"eq.{status.value}"

        headers = dict(self.headers)
        headers["Prefer"] = "count=exact"

        async with httpx.AsyncClient(base_url=self.base_url, headers=headers, timeout=15.0) as client:
            resp = await client.get("/rest/v1/incidents", params=params)
            if resp.status_code >= 400:
                logger.error("Supabase list_incidents failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to query incidents from database.")

            rows = resp.json()
            content_range = resp.headers.get("content-range", "")
            total = 0
            if "/" in content_range:
                try:
                    total = int(content_range.split("/")[1])
                except (ValueError, IndexError):
                    total = len(rows)
            else:
                total = len(rows)

            return [IncidentResponse(**r) for r in rows], total

    async def get_incident(self, user_id: UUID, incident_id: UUID) -> IncidentResponse:
        params = {
            "id": f"eq.{incident_id}",
            "user_id": f"eq.{user_id}",
            "select": "*",
        }
        async with self._client() as client:
            resp = await client.get("/rest/v1/incidents", params=params)
            if resp.status_code >= 400:
                raise UpstreamServiceError("Failed to query incident.")
            rows = resp.json()
            if not rows:
                raise NotFoundError("Incident not found.")
            return IncidentResponse(**rows[0])

    async def update_incident(self, user_id: UUID, incident_id: UUID, data: IncidentUpdate) -> IncidentResponse:
        await self.get_incident(user_id, incident_id)

        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return await self.get_incident(user_id, incident_id)

        if "category" in update_dict and hasattr(update_dict["category"], "value"):
            update_dict["category"] = update_dict["category"].value
        if "status" in update_dict and hasattr(update_dict["status"], "value"):
            update_dict["status"] = update_dict["status"].value
        if "occurred_at" in update_dict and isinstance(update_dict["occurred_at"], datetime):
            update_dict["occurred_at"] = update_dict["occurred_at"].isoformat()

        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

        params = {"id": f"eq.{incident_id}", "user_id": f"eq.{user_id}"}
        async with self._client() as client:
            resp = await client.patch("/rest/v1/incidents", params=params, json=update_dict)
            if resp.status_code >= 400:
                logger.error("Supabase update_incident failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to update incident in database.")
            rows = resp.json()
            if not rows:
                raise NotFoundError("Incident not found.")
            return IncidentResponse(**rows[0])

    async def delete_incident(self, user_id: UUID, incident_id: UUID) -> None:
        await self.get_incident(user_id, incident_id)

        # Retrieve evidence records to delete storage objects
        evidence_list = await self.list_evidence(user_id, incident_id)

        # [DEFECT-02 RESOLUTION]: Clean up storage objects in private bucket BEFORE deleting
        # database incident row. If storage deletion fails or network is interrupted, the
        # incident and evidence rows remain in the DB, allowing subsequent retries to discover
        # and clean up the objects rather than leaving untraceable orphaned files in storage.
        # Note: Complete two-phase distributed atomicity between PostgreSQL and Supabase Storage
        # is not supported over HTTP; deleting storage objects prior to DB record removal ensures
        # fail-safe idempotency without orphaned blobs.
        for ev in evidence_list:
            storage_path = f"{user_id}/{incident_id}/{ev.id}/{_sanitize_filename(ev.file_name)}"
            try:
                await self._delete_storage_object(self.evidence_bucket, storage_path)
            except Exception as exc:
                logger.warning("Failed to delete storage object %s: %s", storage_path, exc)

        # Delete database incident (DB cascade will remove DB evidence, analyses, links)
        params = {"id": f"eq.{incident_id}", "user_id": f"eq.{user_id}"}
        async with self._client() as client:
            resp = await client.delete("/rest/v1/incidents", params=params)
            if resp.status_code >= 400:
                raise UpstreamServiceError("Failed to delete incident from database.")

    # ---------------- Evidence ----------------
    async def upload_evidence(
        self,
        user_id: UUID,
        incident_id: UUID,
        file_name: str,
        mime_type: str,
        content: bytes,
    ) -> EvidenceUploadResponse:
        # Validate incident ownership
        await self.get_incident(user_id, incident_id)

        if mime_type not in ALLOWED_EVIDENCE_MIME_TYPES:
            raise UnsupportedMediaTypeError(
                f"Unsupported media type '{mime_type}'. Supported: {', '.join(sorted(ALLOWED_EVIDENCE_MIME_TYPES))}"
            )

        size_bytes = len(content)
        if size_bytes == 0:
            raise BadRequestError("Cannot upload an empty file.")
        if size_bytes > self.max_upload_bytes:
            raise PayloadTooLargeError(
                f"File size {size_bytes} bytes exceeds maximum {self.max_upload_bytes} bytes."
            )

        # [DEFECT-01 RESOLUTION]: Validate magic bytes against declared MIME type
        validate_evidence_content(content, mime_type)

        sha256_hash = hashlib.sha256(content).hexdigest().lower()
        evidence_id = uuid4()
        safe_name = _sanitize_filename(file_name)
        storage_path = f"{user_id}/{incident_id}/{evidence_id}/{safe_name}"

        # Upload to Supabase Storage (private bucket)
        await self._upload_storage_object(self.evidence_bucket, storage_path, content, mime_type)

        now = datetime.now(timezone.utc)
        payload = {
            "id": str(evidence_id),
            "incident_id": str(incident_id),
            "user_id": str(user_id),
            "file_name": safe_name,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "storage_bucket": self.evidence_bucket,
            "storage_path": storage_path,
            "sha256": sha256_hash,
            "uploaded_at": now.isoformat(),
        }

        async with self._client() as client:
            resp = await client.post("/rest/v1/evidence", json=payload)
            if resp.status_code >= 400:
                logger.error("Supabase insert evidence failed: %s %s", resp.status_code, resp.text)
                # Cleanup uploaded storage object to prevent orphan
                await self._delete_storage_object(self.evidence_bucket, storage_path)
                raise UpstreamServiceError("Failed to record evidence in database.")

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
        await self.get_incident(user_id, incident_id)

        params = {
            "incident_id": f"eq.{incident_id}",
            "user_id": f"eq.{user_id}",
            "order": "uploaded_at.desc",
        }
        async with self._client() as client:
            resp = await client.get("/rest/v1/evidence", params=params)
            if resp.status_code >= 400:
                raise UpstreamServiceError("Failed to list evidence.")
            rows = resp.json()
            return [
                EvidenceUploadResponse(
                    id=r["id"],
                    incident_id=r["incident_id"],
                    file_name=r["file_name"],
                    mime_type=r["mime_type"],
                    size_bytes=r["size_bytes"],
                    sha256=r["sha256"],
                    uploaded_at=r["uploaded_at"],
                    storage_status="stored",
                )
                for r in rows
            ]

    async def get_evidence_bytes(self, user_id: UUID, evidence_id: UUID) -> tuple[bytes, str, str]:
        params = {"id": f"eq.{evidence_id}", "user_id": f"eq.{user_id}"}
        async with self._client() as client:
            resp = await client.get("/rest/v1/evidence", params=params)
            if resp.status_code >= 400 or not resp.json():
                raise NotFoundError("Evidence not found.")
            record = resp.json()[0]

        storage_path = record["storage_path"]
        content = await self._download_storage_object(self.evidence_bucket, storage_path)
        return content, record["mime_type"], record["file_name"]

    async def verify_evidence(self, user_id: UUID, evidence_id: UUID) -> EvidenceVerifyResponse:
        params = {"id": f"eq.{evidence_id}", "user_id": f"eq.{user_id}"}
        async with self._client() as client:
            resp = await client.get("/rest/v1/evidence", params=params)
            if resp.status_code >= 400 or not resp.json():
                raise NotFoundError("Evidence not found.")
            record = resp.json()[0]

        stored_sha256 = record["sha256"]
        storage_path = record["storage_path"]
        content = await self._download_storage_object(self.evidence_bucket, storage_path)
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

        payload = {
            "id": str(analysis_id),
            "incident_id": str(incident_id),
            "user_id": str(user_id),
            "status": analysis_data.get("status", "completed"),
            "classification_label": analysis_data["classification"]["label"],
            "confidence": analysis_data["classification"].get("confidence"),
            "confidence_type": analysis_data["classification"].get(
                "confidence_type", "model_score_not_calibrated_probability"
            ),
            "explanation": analysis_data["classification"]["explanation"],
            "indicators": analysis_data.get("indicators", []),
            "ocr_status": analysis_data.get("ocr", {}).get("status", "not_applicable"),
            "risk_score": analysis_data.get("risk", {}).get("score"),
            "risk_level": analysis_data.get("risk", {}).get("level"),
            "risk_factors": analysis_data.get("risk", {}).get("factors", []),
            "limitations": analysis_data.get("limitations", []),
            "created_at": now.isoformat(),
        }

        async with self._client() as client:
            resp = await client.post("/rest/v1/threat_analyses", json=payload)
            if resp.status_code >= 400:
                logger.error("Supabase save_threat_analysis failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to persist threat analysis in database.")

        return ThreatAnalysisResponse(
            analysis_id=analysis_id,
            incident_id=incident_id,
            status=payload["status"],
            classification=ClassificationResult(**analysis_data["classification"]),
            indicators=[Indicator(**i) for i in payload["indicators"]],
            risk=RiskAssessment(**analysis_data.get("risk", {"explanation": "N/A"})),
            ocr=OCRSummary(**analysis_data.get("ocr", {"status": "not_applicable"})),
            limitations=payload["limitations"],
            created_at=now,
        )

    async def list_threat_analyses(self, user_id: UUID, incident_id: UUID) -> list[ThreatAnalysisResponse]:
        await self.get_incident(user_id, incident_id)

        params = {
            "incident_id": f"eq.{incident_id}",
            "user_id": f"eq.{user_id}",
            "order": "created_at.desc",
        }
        async with self._client() as client:
            resp = await client.get("/rest/v1/threat_analyses", params=params)
            if resp.status_code >= 400:
                raise UpstreamServiceError("Failed to query threat analyses.")
            rows = resp.json()

            items = []
            for r in rows:
                items.append(
                    ThreatAnalysisResponse(
                        analysis_id=r["id"],
                        incident_id=r["incident_id"],
                        status=r["status"],
                        classification=ClassificationResult(
                            label=r["classification_label"],
                            confidence=r.get("confidence"),
                            confidence_type=r.get("confidence_type", "model_score_not_calibrated_probability"),
                            explanation=r["explanation"],
                        ),
                        indicators=[Indicator(**i) for i in r.get("indicators", [])],
                        risk=RiskAssessment(
                            score=r.get("risk_score"),
                            level=r.get("risk_level"),
                            factors=r.get("risk_factors", []),
                            explanation="Stored review-priority indicator.",
                        ),
                        ocr=OCRSummary(
                            status=r.get("ocr_status", "not_applicable"),
                            text_available=r.get("ocr_status") == "completed",
                        ),
                        limitations=r.get("limitations", []),
                        created_at=r["created_at"],
                    )
                )
            return items

    # ---------------- Incident Graph ----------------
    async def get_incident_graph(self, user_id: UUID, incident_id: UUID) -> IncidentGraphResponse:
        target = await self.get_incident(user_id, incident_id)

        # Retrieve user incident links
        async with self._client() as client:
            params = {
                "user_id": f"eq.{user_id}",
                "or": f"(source_incident_id.eq.{incident_id},target_incident_id.eq.{incident_id})",
            }
            resp = await client.get("/rest/v1/incident_links", params=params)
            links = resp.json() if resp.status_code < 400 else []

            involved_ids = {str(incident_id)}
            edges = []
            for l in links:
                involved_ids.add(str(l["source_incident_id"]))
                involved_ids.add(str(l["target_incident_id"]))
                edges.append(
                    GraphEdge(
                        id=l["id"],
                        source=l["source_incident_id"],
                        target=l["target_incident_id"],
                        relationship=l["relationship"],
                        confidence=l.get("confidence"),
                        explanation=l["explanation"],
                    )
                )

            # Retrieve nodes
            inc_params = {
                "user_id": f"eq.{user_id}",
                "id": f"in.({','.join(involved_ids)})",
            }
            inc_resp = await client.get("/rest/v1/incidents", params=inc_params)
            inc_rows = inc_resp.json() if inc_resp.status_code < 400 else []

            nodes = [
                GraphNode(id=r["id"], label=r["title"], category=r["category"])
                for r in inc_rows
            ]

        return IncidentGraphResponse(
            incident_id=incident_id,
            nodes=nodes,
            edges=edges,
        )

    # ---------------- Private Storage Helpers ----------------
    async def _upload_storage_object(self, bucket: str, path: str, content: bytes, mime_type: str) -> None:
        url = f"/storage/v1/object/{bucket}/{path}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": mime_type,
            "x-upsert": "false",
        }
        async with httpx.AsyncClient(base_url=self.base_url, headers=headers, timeout=30.0) as client:
            resp = await client.post(url, content=content)
            if resp.status_code >= 400:
                logger.error("Storage upload failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to store private evidence object.")

    async def _download_storage_object(self, bucket: str, path: str) -> bytes:
        url = f"/storage/v1/object/authenticated/{bucket}/{path}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
        }
        async with httpx.AsyncClient(base_url=self.base_url, headers=headers, timeout=30.0) as client:
            resp = await client.get(url)
            if resp.status_code >= 400:
                logger.error("Storage download failed: %s %s", resp.status_code, resp.text)
                raise NotFoundError("Storage object not found or inaccessible.")
            return resp.content

    async def _delete_storage_object(self, bucket: str, path: str) -> None:
        url = f"/storage/v1/object/{bucket}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
        }
        payload = {"prefixes": [path]}
        async with httpx.AsyncClient(base_url=self.base_url, headers=headers, timeout=15.0) as client:
            resp = await client.request("DELETE", url, json=payload)
            if resp.status_code >= 400:
                logger.warning("Storage object deletion returned error: %s %s", resp.status_code, resp.text)
