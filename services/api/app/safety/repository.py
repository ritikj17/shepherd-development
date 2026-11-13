from abc import ABC, abstractmethod
from datetime import datetime, timezone
import logging
from typing import Optional
from uuid import UUID, uuid4

from fastapi import Depends
import httpx

from app.core.config import Settings, get_settings
from app.core.exceptions import (
    BadRequestError,
    NotFoundError,
    UpstreamServiceError,
)
from app.models.safety import (
    ContactMethod,
    SafetySessionCheckinResponse,
    SafetySessionCreate,
    SafetySessionResponse,
    TrustedContactCreate,
    TrustedContactResponse,
)

logger = logging.getLogger(__name__)


class BaseSafetyRepository(ABC):
    """Abstract interface for SafeCircle data access."""

    # Trusted Contacts
    @abstractmethod
    async def create_contact(self, user_id: UUID, data: TrustedContactCreate) -> TrustedContactResponse:
        pass

    @abstractmethod
    async def list_contacts(self, user_id: UUID) -> list[TrustedContactResponse]:
        pass

    @abstractmethod
    async def get_contact(self, user_id: UUID, contact_id: UUID) -> Optional[dict]:
        pass

    @abstractmethod
    async def delete_contact(self, user_id: UUID, contact_id: UUID) -> None:
        pass

    @abstractmethod
    async def has_active_sessions_for_contact(self, user_id: UUID, contact_id: UUID) -> bool:
        pass

    # Safety Sessions
    @abstractmethod
    async def create_session(self, user_id: UUID, data: SafetySessionCreate) -> SafetySessionResponse:
        pass

    @abstractmethod
    async def list_sessions(self, user_id: UUID) -> list[SafetySessionResponse]:
        pass

    @abstractmethod
    async def get_session(self, user_id: UUID, session_id: UUID) -> Optional[dict]:
        pass

    @abstractmethod
    async def checkin_session(
        self, user_id: UUID, session_id: UUID, message: Optional[str] = None
    ) -> SafetySessionCheckinResponse:
        pass

    @abstractmethod
    async def expire_overdue_sessions(self, user_id: Optional[UUID] = None) -> list[dict]:
        pass


class InMemorySafetyRepository(BaseSafetyRepository):
    """In-memory SafeCircle repository for offline testing and development."""

    def __init__(self) -> None:
        self.contacts: dict[UUID, dict] = {}
        self.sessions: dict[UUID, dict] = {}

    async def create_contact(self, user_id: UUID, data: TrustedContactCreate) -> TrustedContactResponse:
        contact_id = uuid4()
        now = datetime.now(timezone.utc)
        record = {
            "id": contact_id,
            "user_id": user_id,
            "name": data.name.strip(),
            "contact_method": data.contact_method.value if isinstance(data.contact_method, ContactMethod) else str(data.contact_method),
            "contact_value": data.contact_value.strip(),
            "consent_confirmed": data.consent_confirmed,
            "created_at": now,
            "updated_at": now,
        }
        self.contacts[contact_id] = record
        return TrustedContactResponse(
            id=contact_id,
            name=record["name"],
            contact_method=ContactMethod(record["contact_method"]),
            created_at=record["created_at"],
        )

    async def list_contacts(self, user_id: UUID) -> list[TrustedContactResponse]:
        user_contacts = [
            c for c in self.contacts.values()
            if c["user_id"] == user_id
        ]
        user_contacts.sort(key=lambda x: x["created_at"], reverse=True)
        return [
            TrustedContactResponse(
                id=c["id"],
                name=c["name"],
                contact_method=ContactMethod(c["contact_method"]),
                created_at=c["created_at"],
            )
            for c in user_contacts
        ]

    async def get_contact(self, user_id: UUID, contact_id: UUID) -> Optional[dict]:
        contact = self.contacts.get(contact_id)
        if not contact or contact["user_id"] != user_id:
            return None
        return contact

    async def delete_contact(self, user_id: UUID, contact_id: UUID) -> None:
        contact = await self.get_contact(user_id, contact_id)
        if not contact:
            raise NotFoundError("Trusted contact not found.")
        del self.contacts[contact_id]

    async def has_active_sessions_for_contact(self, user_id: UUID, contact_id: UUID) -> bool:
        now = datetime.now(timezone.utc)
        for s in self.sessions.values():
            if s["user_id"] == user_id and s["trusted_contact_id"] == contact_id:
                # If active and not expired yet
                if s["status"] == "active" and s["checkin_deadline"] > now:
                    return True
        return False

    async def create_session(self, user_id: UUID, data: SafetySessionCreate) -> SafetySessionResponse:
        session_id = uuid4()
        now = datetime.now(timezone.utc)
        record = {
            "id": session_id,
            "user_id": user_id,
            "trusted_contact_id": data.trusted_contact_id,
            "incident_id": data.incident_id,
            "status": "active",
            "checkin_deadline": data.checkin_deadline,
            "checked_in_at": None,
            "cancelled_at": None,
            "created_at": now,
            "updated_at": now,
        }
        self.sessions[session_id] = record
        return SafetySessionResponse(
            id=session_id,
            trusted_contact_id=data.trusted_contact_id,
            incident_id=data.incident_id,
            status="active",
            checkin_deadline=data.checkin_deadline,
            created_at=now,
        )

    async def list_sessions(self, user_id: UUID) -> list[SafetySessionResponse]:
        now = datetime.now(timezone.utc)
        user_sessions = [
            s for s in self.sessions.values()
            if s["user_id"] == user_id
        ]
        # Auto-update status to expired if active and deadline passed
        for s in user_sessions:
            if s["status"] == "active" and s["checkin_deadline"] <= now:
                s["status"] = "expired"
                s["updated_at"] = now

        user_sessions.sort(key=lambda x: x["created_at"], reverse=True)
        return [
            SafetySessionResponse(
                id=s["id"],
                trusted_contact_id=s["trusted_contact_id"],
                incident_id=s["incident_id"],
                status=s["status"],
                checkin_deadline=s["checkin_deadline"],
                created_at=s["created_at"],
            )
            for s in user_sessions
        ]

    async def get_session(self, user_id: UUID, session_id: UUID) -> Optional[dict]:
        session = self.sessions.get(session_id)
        if not session or session["user_id"] != user_id:
            return None
        # Check deadline expiry
        now = datetime.now(timezone.utc)
        if session["status"] == "active" and session["checkin_deadline"] <= now:
            session["status"] = "expired"
            session["updated_at"] = now
        return session

    async def checkin_session(
        self, user_id: UUID, session_id: UUID, message: Optional[str] = None
    ) -> SafetySessionCheckinResponse:
        session = await self.get_session(user_id, session_id)
        if not session:
            raise NotFoundError("Safety session not found.")

        if session["status"] == "cancelled":
            raise BadRequestError("Cannot check in to a cancelled safety session.")

        now = datetime.now(timezone.utc)
        # Idempotent: if already checked in, preserve original timestamp
        if session["status"] == "checked_in":
            return SafetySessionCheckinResponse(
                id=session["id"],
                status="checked_in",
                checked_in_at=session["checked_in_at"],
            )

        session["status"] = "checked_in"
        session["checked_in_at"] = now
        session["updated_at"] = now
        return SafetySessionCheckinResponse(
            id=session["id"],
            status="checked_in",
            checked_in_at=now,
        )

    async def expire_overdue_sessions(self, user_id: Optional[UUID] = None) -> list[dict]:
        now = datetime.now(timezone.utc)
        expired_sessions = []
        for s in self.sessions.values():
            if user_id is not None and s["user_id"] != user_id:
                continue
            if s["status"] == "active" and s["checkin_deadline"] <= now:
                s["status"] = "expired"
                s["updated_at"] = now
                expired_sessions.append(s)
        return expired_sessions


class SupabaseSafetyRepository(BaseSafetyRepository):
    """Production Supabase PostgREST implementation for SafeCircle."""

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

    async def create_contact(self, user_id: UUID, data: TrustedContactCreate) -> TrustedContactResponse:
        contact_id = uuid4()
        now = datetime.now(timezone.utc)
        payload = {
            "id": str(contact_id),
            "user_id": str(user_id),
            "name": data.name.strip(),
            "contact_method": data.contact_method.value,
            "contact_value": data.contact_value.strip(),
            "consent_confirmed": data.consent_confirmed,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        async with self._client() as client:
            resp = await client.post("/rest/v1/trusted_contacts", json=payload)
            if resp.status_code >= 400:
                logger.error("Supabase create_contact failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to persist trusted contact.")
            rows = resp.json()
            row = rows[0] if isinstance(rows, list) and rows else payload
            return TrustedContactResponse(
                id=UUID(row["id"]),
                name=row["name"],
                contact_method=ContactMethod(row["contact_method"]),
                created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
            )

    async def list_contacts(self, user_id: UUID) -> list[TrustedContactResponse]:
        async with self._client() as client:
            resp = await client.get(
                "/rest/v1/trusted_contacts",
                params={"user_id": f"eq.{user_id}", "order": "created_at.desc"},
            )
            if resp.status_code >= 400:
                logger.error("Supabase list_contacts failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to fetch trusted contacts.")
            rows = resp.json()
            return [
                TrustedContactResponse(
                    id=UUID(r["id"]),
                    name=r["name"],
                    contact_method=ContactMethod(r["contact_method"]),
                    created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
                )
                for r in rows
            ]

    async def get_contact(self, user_id: UUID, contact_id: UUID) -> Optional[dict]:
        async with self._client() as client:
            resp = await client.get(
                "/rest/v1/trusted_contacts",
                params={"id": f"eq.{contact_id}", "user_id": f"eq.{user_id}"},
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
                "name": r["name"],
                "contact_method": r["contact_method"],
                "contact_value": r["contact_value"],
                "consent_confirmed": r["consent_confirmed"],
                "created_at": datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
            }

    async def delete_contact(self, user_id: UUID, contact_id: UUID) -> None:
        contact = await self.get_contact(user_id, contact_id)
        if not contact:
            raise NotFoundError("Trusted contact not found.")

        async with self._client() as client:
            resp = await client.delete(
                "/rest/v1/trusted_contacts",
                params={"id": f"eq.{contact_id}", "user_id": f"eq.{user_id}"},
            )
            if resp.status_code >= 400:
                logger.error("Supabase delete_contact failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to delete trusted contact.")

    async def has_active_sessions_for_contact(self, user_id: UUID, contact_id: UUID) -> bool:
        now = datetime.now(timezone.utc)
        async with self._client() as client:
            resp = await client.get(
                "/rest/v1/safety_sessions",
                params={
                    "user_id": f"eq.{user_id}",
                    "trusted_contact_id": f"eq.{contact_id}",
                    "status": "eq.active",
                    "checkin_deadline": f"gt.{now.isoformat()}",
                },
            )
            if resp.status_code >= 400:
                return False
            rows = resp.json()
            return len(rows) > 0

    async def create_session(self, user_id: UUID, data: SafetySessionCreate) -> SafetySessionResponse:
        session_id = uuid4()
        now = datetime.now(timezone.utc)
        payload = {
            "id": str(session_id),
            "user_id": str(user_id),
            "trusted_contact_id": str(data.trusted_contact_id),
            "incident_id": str(data.incident_id) if data.incident_id else None,
            "status": "active",
            "checkin_deadline": data.checkin_deadline.isoformat(),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        async with self._client() as client:
            resp = await client.post("/rest/v1/safety_sessions", json=payload)
            if resp.status_code >= 400:
                logger.error("Supabase create_session failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to persist safety session.")
            rows = resp.json()
            row = rows[0] if isinstance(rows, list) and rows else payload
            return SafetySessionResponse(
                id=UUID(row["id"]),
                trusted_contact_id=UUID(row["trusted_contact_id"]),
                incident_id=UUID(row["incident_id"]) if row.get("incident_id") else None,
                status=row["status"],
                checkin_deadline=datetime.fromisoformat(row["checkin_deadline"].replace("Z", "+00:00")),
                created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
            )

    async def list_sessions(self, user_id: UUID) -> list[SafetySessionResponse]:
        now = datetime.now(timezone.utc)
        async with self._client() as client:
            resp = await client.get(
                "/rest/v1/safety_sessions",
                params={"user_id": f"eq.{user_id}", "order": "created_at.desc"},
            )
            if resp.status_code >= 400:
                logger.error("Supabase list_sessions failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to fetch safety sessions.")
            rows = resp.json()
            results = []
            for r in rows:
                status = r["status"]
                deadline = datetime.fromisoformat(r["checkin_deadline"].replace("Z", "+00:00"))
                if status == "active" and deadline <= now:
                    status = "expired"
                results.append(
                    SafetySessionResponse(
                        id=UUID(r["id"]),
                        trusted_contact_id=UUID(r["trusted_contact_id"]),
                        incident_id=UUID(r["incident_id"]) if r.get("incident_id") else None,
                        status=status,
                        checkin_deadline=deadline,
                        created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
                    )
                )
            return results

    async def get_session(self, user_id: UUID, session_id: UUID) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        async with self._client() as client:
            resp = await client.get(
                "/rest/v1/safety_sessions",
                params={"id": f"eq.{session_id}", "user_id": f"eq.{user_id}"},
            )
            if resp.status_code >= 400:
                return None
            rows = resp.json()
            if not rows:
                return None
            r = rows[0]
            status = r["status"]
            deadline = datetime.fromisoformat(r["checkin_deadline"].replace("Z", "+00:00"))
            if status == "active" and deadline <= now:
                status = "expired"
            return {
                "id": UUID(r["id"]),
                "user_id": UUID(r["user_id"]),
                "trusted_contact_id": UUID(r["trusted_contact_id"]),
                "incident_id": UUID(r["incident_id"]) if r.get("incident_id") else None,
                "status": status,
                "checkin_deadline": deadline,
                "checked_in_at": datetime.fromisoformat(r["checked_in_at"].replace("Z", "+00:00")) if r.get("checked_in_at") else None,
                "created_at": datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
            }

    async def checkin_session(
        self, user_id: UUID, session_id: UUID, message: Optional[str] = None
    ) -> SafetySessionCheckinResponse:
        session = await self.get_session(user_id, session_id)
        if not session:
            raise NotFoundError("Safety session not found.")

        if session["status"] == "cancelled":
            raise BadRequestError("Cannot check in to a cancelled safety session.")

        if session["status"] == "checked_in":
            return SafetySessionCheckinResponse(
                id=session["id"],
                status="checked_in",
                checked_in_at=session["checked_in_at"],
            )

        now = datetime.now(timezone.utc)
        async with self._client() as client:
            resp = await client.patch(
                "/rest/v1/safety_sessions",
                params={"id": f"eq.{session_id}", "user_id": f"eq.{user_id}"},
                json={
                    "status": "checked_in",
                    "checked_in_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                },
            )
            if resp.status_code >= 400:
                logger.error("Supabase checkin_session failed: %s %s", resp.status_code, resp.text)
                raise UpstreamServiceError("Failed to update safety session check-in.")
            return SafetySessionCheckinResponse(
                id=session["id"],
                status="checked_in",
                checked_in_at=now,
            )

    async def expire_overdue_sessions(self, user_id: Optional[UUID] = None) -> list[dict]:
        now = datetime.now(timezone.utc)
        params = {"status": "eq.active", "checkin_deadline": f"lte.{now.isoformat()}"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"

        async with self._client() as client:
            resp = await client.get("/rest/v1/safety_sessions", params=params)
            if resp.status_code >= 400:
                return []
            rows = resp.json()
            if not rows:
                return []

            # Update them to expired
            await client.patch(
                "/rest/v1/safety_sessions",
                params=params,
                json={"status": "expired", "updated_at": now.isoformat()},
            )
            return [
                {
                    "id": UUID(r["id"]),
                    "user_id": UUID(r["user_id"]),
                    "trusted_contact_id": UUID(r["trusted_contact_id"]),
                    "incident_id": UUID(r["incident_id"]) if r.get("incident_id") else None,
                    "checkin_deadline": datetime.fromisoformat(r["checkin_deadline"].replace("Z", "+00:00")),
                }
                for r in rows
            ]


# Singleton repository management
_singleton_safety_repo: Optional[BaseSafetyRepository] = None


def get_safety_repository(settings: Settings = Depends(get_settings)) -> BaseSafetyRepository:
    """Dependency returning the configured safety repository."""
    global _singleton_safety_repo
    if _singleton_safety_repo is not None:
        return _singleton_safety_repo

    if not isinstance(settings, Settings):
        settings = get_settings()

    if settings.use_in_memory_adapter or not settings.supabase_url or not settings.supabase_service_role_key:
        _singleton_safety_repo = InMemorySafetyRepository()
        return _singleton_safety_repo

    _singleton_safety_repo = SupabaseSafetyRepository(settings)
    return _singleton_safety_repo


def reset_safety_repository() -> None:
    """Reset the singleton instance for clean test execution."""
    global _singleton_safety_repo
    _singleton_safety_repo = None
