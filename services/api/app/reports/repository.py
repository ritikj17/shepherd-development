from abc import ABC, abstractmethod
from datetime import datetime, timezone
import logging
from typing import Optional
from uuid import UUID, uuid4

from fastapi import Depends
import httpx

from app.core.config import Settings, get_settings
from app.core.exceptions import UpstreamServiceError

logger = logging.getLogger(__name__)


class BaseReportRepository(ABC):
    """Abstract interface for JusticeBridge report metadata and storage."""

    @abstractmethod
    async def save_report(
        self,
        user_id: UUID,
        incident_id: UUID,
        report_id: UUID,
        file_name: str,
        pdf_bytes: bytes,
        expires_at: Optional[datetime] = None,
    ) -> dict:
        pass

    @abstractmethod
    async def get_report(self, user_id: UUID, report_id: UUID) -> Optional[dict]:
        pass

    @abstractmethod
    async def get_report_pdf(self, user_id: UUID, report_id: UUID) -> Optional[bytes]:
        pass

    @abstractmethod
    async def list_reports(self, user_id: UUID, incident_id: Optional[UUID] = None) -> list[dict]:
        pass


class InMemoryReportRepository(BaseReportRepository):
    """In-memory report repository for testing and offline development."""

    def __init__(self) -> None:
        self.reports: dict[UUID, dict] = {}
        self.storage: dict[str, bytes] = {}  # storage_path -> bytes

    async def save_report(
        self,
        user_id: UUID,
        incident_id: UUID,
        report_id: UUID,
        file_name: str,
        pdf_bytes: bytes,
        expires_at: Optional[datetime] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        storage_path = f"{user_id}/{incident_id}/{report_id}.pdf"
        self.storage[storage_path] = pdf_bytes

        record = {
            "id": report_id,
            "user_id": user_id,
            "incident_id": incident_id,
            "storage_bucket": "shepherd-reports",
            "storage_path": storage_path,
            "file_name": file_name,
            "status": "generated",
            "generated_at": now,
            "expires_at": expires_at,
        }
        self.reports[report_id] = record
        return record

    async def get_report(self, user_id: UUID, report_id: UUID) -> Optional[dict]:
        report = self.reports.get(report_id)
        if not report or report["user_id"] != user_id:
            return None
        return report

    async def get_report_pdf(self, user_id: UUID, report_id: UUID) -> Optional[bytes]:
        report = await self.get_report(user_id, report_id)
        if not report:
            return None
        return self.storage.get(report["storage_path"])

    async def list_reports(self, user_id: UUID, incident_id: Optional[UUID] = None) -> list[dict]:
        user_reports = [
            r for r in self.reports.values()
            if r["user_id"] == user_id and (incident_id is None or r["incident_id"] == incident_id)
        ]
        user_reports.sort(key=lambda x: x["generated_at"], reverse=True)
        return user_reports


class SupabaseReportRepository(BaseReportRepository):
    """Supabase PostgREST & Storage repository for JusticeBridge reports."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        url = settings.supabase_url.rstrip("/")
        if url.endswith("/rest/v1"):
            url = url[:-len("/rest/v1")]
        self.base_url = url
        self.service_key = settings.supabase_service_role_key
        self.headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self.reports_bucket = "shepherd-reports"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, headers=self.headers, timeout=20.0)

    async def save_report(
        self,
        user_id: UUID,
        incident_id: UUID,
        report_id: UUID,
        file_name: str,
        pdf_bytes: bytes,
        expires_at: Optional[datetime] = None,
    ) -> dict:
        storage_path = f"{user_id}/{incident_id}/{report_id}.pdf"
        now = datetime.now(timezone.utc)

        # 1. Upload PDF binary to private shepherd-reports storage bucket
        storage_url = f"/storage/v1/object/{self.reports_bucket}/{storage_path}"
        upload_headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        }
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
            upload_resp = await client.post(storage_url, content=pdf_bytes, headers=upload_headers)
            if upload_resp.status_code >= 400:
                logger.error("Supabase Storage PDF upload failed: %s %s", upload_resp.status_code, upload_resp.text)
                raise UpstreamServiceError("Failed to store generated report in private storage.")

        # 2. Persist metadata in reports table
        payload = {
            "id": str(report_id),
            "user_id": str(user_id),
            "incident_id": str(incident_id),
            "storage_bucket": self.reports_bucket,
            "storage_path": storage_path,
            "status": "generated",
            "generated_at": now.isoformat(),
            "expires_at": expires_at.isoformat() if expires_at else None,
        }

        async with self._client() as client:
            resp = await client.post("/rest/v1/reports", json=payload)
            if resp.status_code >= 400:
                logger.error("Supabase insert report metadata failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to persist report record.")
            return {
                "id": report_id,
                "user_id": user_id,
                "incident_id": incident_id,
                "storage_bucket": self.reports_bucket,
                "storage_path": storage_path,
                "file_name": file_name,
                "status": "generated",
                "generated_at": now,
                "expires_at": expires_at,
            }

    async def get_report(self, user_id: UUID, report_id: UUID) -> Optional[dict]:
        async with self._client() as client:
            resp = await client.get(
                "/rest/v1/reports",
                params={"id": f"eq.{report_id}", "user_id": f"eq.{user_id}"},
            )
            if resp.status_code >= 400:
                return None
            rows = resp.json()
            if not rows:
                return None
            r = rows[0]
            return {
                "id": UUID(r["id"]),
                "user_id": UUID(r["user_id"]),
                "incident_id": UUID(r["incident_id"]),
                "storage_bucket": r["storage_bucket"],
                "storage_path": r["storage_path"],
                "file_name": f"incident-report-{r['incident_id'][:8]}.pdf",
                "status": r["status"],
                "generated_at": datetime.fromisoformat(r["generated_at"].replace("Z", "+00:00")),
                "expires_at": datetime.fromisoformat(r["expires_at"].replace("Z", "+00:00")) if r.get("expires_at") else None,
            }

    async def get_report_pdf(self, user_id: UUID, report_id: UUID) -> Optional[bytes]:
        report = await self.get_report(user_id, report_id)
        if not report:
            return None

        storage_url = f"/storage/v1/object/{self.reports_bucket}/{report['storage_path']}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
        }
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
            resp = await client.get(storage_url, headers=headers)
            if resp.status_code >= 400:
                logger.error("Supabase Storage get report PDF failed: %s", resp.status_code)
                return None
            return resp.content

    async def list_reports(self, user_id: UUID, incident_id: Optional[UUID] = None) -> list[dict]:
        params = {"user_id": f"eq.{user_id}", "order": "generated_at.desc"}
        if incident_id:
            params["incident_id"] = f"eq.{incident_id}"

        async with self._client() as client:
            resp = await client.get("/rest/v1/reports", params=params)
            if resp.status_code >= 400:
                return []
            rows = resp.json()
            return [
                {
                    "id": UUID(r["id"]),
                    "user_id": UUID(r["user_id"]),
                    "incident_id": UUID(r["incident_id"]),
                    "storage_bucket": r["storage_bucket"],
                    "storage_path": r["storage_path"],
                    "file_name": f"incident-report-{r['incident_id'][:8]}.pdf",
                    "status": r["status"],
                    "generated_at": datetime.fromisoformat(r["generated_at"].replace("Z", "+00:00")),
                    "expires_at": datetime.fromisoformat(r["expires_at"].replace("Z", "+00:00")) if r.get("expires_at") else None,
                }
                for r in rows
            ]


_singleton_report_repo: Optional[BaseReportRepository] = None


def get_report_repository(settings: Settings = Depends(get_settings)) -> BaseReportRepository:
    """Dependency returning the configured report repository."""
    global _singleton_report_repo
    if _singleton_report_repo is not None:
        return _singleton_report_repo

    if not isinstance(settings, Settings):
        settings = get_settings()

    if settings.use_in_memory_adapter or not settings.supabase_url or not settings.supabase_service_role_key:
        _singleton_report_repo = InMemoryReportRepository()
        return _singleton_report_repo

    _singleton_report_repo = SupabaseReportRepository(settings)
    return _singleton_report_repo


def reset_report_repository() -> None:
    """Reset singleton for clean testing."""
    global _singleton_report_repo
    _singleton_report_repo = None
