from abc import ABC, abstractmethod
from datetime import datetime, timezone
import logging
from typing import Optional
from uuid import UUID, uuid4

from fastapi import Depends
import httpx

from app.core.config import Settings, get_settings
from app.core.exceptions import UpstreamServiceError
from app.notifications.models import AlertChannel, AlertResponse, AlertStatus

logger = logging.getLogger(__name__)


class BaseNotificationRepository(ABC):
    """Abstract interface for alerts and notification logs."""

    @abstractmethod
    async def create_alert(
        self,
        user_id: UUID,
        channel: AlertChannel,
        status: AlertStatus,
        message_type: str,
        safety_session_id: Optional[UUID] = None,
        trusted_contact_id: Optional[UUID] = None,
        provider_reference: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> AlertResponse:
        pass

    @abstractmethod
    async def list_alerts(self, user_id: UUID) -> list[AlertResponse]:
        pass

    @abstractmethod
    async def get_alert(self, user_id: UUID, alert_id: UUID) -> Optional[AlertResponse]:
        pass

    @abstractmethod
    async def has_alert_for_session(
        self, user_id: UUID, session_id: UUID, message_type: str
    ) -> bool:
        pass


class InMemoryNotificationRepository(BaseNotificationRepository):
    """In-memory notification repository for testing and offline development."""

    def __init__(self) -> None:
        self.alerts: dict[UUID, dict] = {}

    async def create_alert(
        self,
        user_id: UUID,
        channel: AlertChannel,
        status: AlertStatus,
        message_type: str,
        safety_session_id: Optional[UUID] = None,
        trusted_contact_id: Optional[UUID] = None,
        provider_reference: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> AlertResponse:
        alert_id = uuid4()
        now = datetime.now(timezone.utc)
        record = {
            "id": alert_id,
            "user_id": user_id,
            "safety_session_id": safety_session_id,
            "trusted_contact_id": trusted_contact_id,
            "channel": channel,
            "status": status,
            "provider_reference": provider_reference,
            "message_type": message_type,
            "error_message": error_message,
            "created_at": now,
            "updated_at": now,
        }
        self.alerts[alert_id] = record
        return AlertResponse(**record)

    async def list_alerts(self, user_id: UUID) -> list[AlertResponse]:
        user_alerts = [
            AlertResponse(**a) for a in self.alerts.values()
            if a["user_id"] == user_id
        ]
        user_alerts.sort(key=lambda x: x.created_at, reverse=True)
        return user_alerts

    async def get_alert(self, user_id: UUID, alert_id: UUID) -> Optional[AlertResponse]:
        alert = self.alerts.get(alert_id)
        if not alert or alert["user_id"] != user_id:
            return None
        return AlertResponse(**alert)

    async def has_alert_for_session(
        self, user_id: UUID, session_id: UUID, message_type: str
    ) -> bool:
        for a in self.alerts.values():
            if (
                a["user_id"] == user_id
                and a.get("safety_session_id") == session_id
                and a.get("message_type") == message_type
            ):
                return True
        return False


class SupabaseNotificationRepository(BaseNotificationRepository):
    """Production Supabase PostgREST repository for alerts."""

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

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, headers=self.headers, timeout=15.0)

    async def create_alert(
        self,
        user_id: UUID,
        channel: AlertChannel,
        status: AlertStatus,
        message_type: str,
        safety_session_id: Optional[UUID] = None,
        trusted_contact_id: Optional[UUID] = None,
        provider_reference: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> AlertResponse:
        alert_id = uuid4()
        now = datetime.now(timezone.utc)
        payload = {
            "id": str(alert_id),
            "user_id": str(user_id),
            "safety_session_id": str(safety_session_id) if safety_session_id else None,
            "trusted_contact_id": str(trusted_contact_id) if trusted_contact_id else None,
            "channel": channel,
            "status": status,
            "provider_reference": provider_reference,
            "message_type": message_type,
            "error_message": error_message,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        async with self._client() as client:
            resp = await client.post("/rest/v1/alerts", json=payload)
            if resp.status_code >= 400:
                logger.error("Supabase create_alert failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to persist alert record.")
            rows = resp.json()
            row = rows[0] if isinstance(rows, list) and rows else payload
            return AlertResponse(
                id=UUID(row["id"]),
                user_id=UUID(row["user_id"]),
                safety_session_id=UUID(row["safety_session_id"]) if row.get("safety_session_id") else None,
                trusted_contact_id=UUID(row["trusted_contact_id"]) if row.get("trusted_contact_id") else None,
                channel=row["channel"],
                status=row["status"],
                provider_reference=row.get("provider_reference"),
                message_type=row["message_type"],
                error_message=row.get("error_message"),
                created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
            )

    async def list_alerts(self, user_id: UUID) -> list[AlertResponse]:
        async with self._client() as client:
            resp = await client.get(
                "/rest/v1/alerts",
                params={"user_id": f"eq.{user_id}", "order": "created_at.desc"},
            )
            if resp.status_code >= 400:
                logger.error("Supabase list_alerts failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to fetch alert records.")
            rows = resp.json()
            return [
                AlertResponse(
                    id=UUID(r["id"]),
                    user_id=UUID(r["user_id"]),
                    safety_session_id=UUID(r["safety_session_id"]) if r.get("safety_session_id") else None,
                    trusted_contact_id=UUID(r["trusted_contact_id"]) if r.get("trusted_contact_id") else None,
                    channel=r["channel"],
                    status=r["status"],
                    provider_reference=r.get("provider_reference"),
                    message_type=r["message_type"],
                    error_message=r.get("error_message"),
                    created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
                )
                for r in rows
            ]

    async def get_alert(self, user_id: UUID, alert_id: UUID) -> Optional[AlertResponse]:
        async with self._client() as client:
            resp = await client.get(
                "/rest/v1/alerts",
                params={"id": f"eq.{alert_id}", "user_id": f"eq.{user_id}"},
            )
            if resp.status_code >= 400:
                return None
            rows = resp.json()
            if not rows:
                return None
            r = rows[0]
            return AlertResponse(
                id=UUID(r["id"]),
                user_id=UUID(r["user_id"]),
                safety_session_id=UUID(r["safety_session_id"]) if r.get("safety_session_id") else None,
                trusted_contact_id=UUID(r["trusted_contact_id"]) if r.get("trusted_contact_id") else None,
                channel=r["channel"],
                status=r["status"],
                provider_reference=r.get("provider_reference"),
                message_type=r["message_type"],
                error_message=r.get("error_message"),
                created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
            )

    async def has_alert_for_session(
        self, user_id: UUID, session_id: UUID, message_type: str
    ) -> bool:
        async with self._client() as client:
            resp = await client.get(
                "/rest/v1/alerts",
                params={
                    "user_id": f"eq.{user_id}",
                    "safety_session_id": f"eq.{session_id}",
                    "message_type": f"eq.{message_type}",
                },
            )
            if resp.status_code >= 400:
                return False
            rows = resp.json()
            return len(rows) > 0


_singleton_notification_repo: Optional[BaseNotificationRepository] = None


def get_notification_repository(settings: Settings = Depends(get_settings)) -> BaseNotificationRepository:
    """Dependency returning the configured notification repository."""
    global _singleton_notification_repo
    if _singleton_notification_repo is not None:
        return _singleton_notification_repo

    if not isinstance(settings, Settings):
        settings = get_settings()

    if settings.use_in_memory_adapter or not settings.supabase_url or not settings.supabase_service_role_key:
        _singleton_notification_repo = InMemoryNotificationRepository()
        return _singleton_notification_repo

    _singleton_notification_repo = SupabaseNotificationRepository(settings)
    return _singleton_notification_repo


def reset_notification_repository() -> None:
    """Reset singleton for clean testing."""
    global _singleton_notification_repo
    _singleton_notification_repo = None
