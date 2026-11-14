from abc import ABC, abstractmethod
from datetime import datetime, timezone
import logging
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import Depends
import httpx

from app.core.config import Settings, get_settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.models.sentinel import (
    AnomalyRecord,
    ConcernLevel,
    ContactRelayData,
    LiveIncidentEvent,
    LocationUpdateRequest,
    SentinelSessionCreate,
    SentinelSessionResponse,
    SessionStatus,
    VerificationRecord,
    VerificationStatus,
)

logger = logging.getLogger("shepherd.sentinel.repository")


class BaseSentinelRepository(ABC):
    """Abstract storage contract for Sentinel monitoring sessions, anomalies, and relay events."""

    # Sessions
    @abstractmethod
    async def create_session(self, user_id: UUID, data: SentinelSessionCreate) -> SentinelSessionResponse:
        pass

    @abstractmethod
    async def get_session(self, user_id: UUID, session_id: UUID) -> Optional[dict[str, Any]]:
        pass

    @abstractmethod
    async def get_active_session(self, user_id: UUID) -> Optional[dict[str, Any]]:
        pass

    @abstractmethod
    async def update_session_status(
        self, user_id: UUID, session_id: UUID, status: SessionStatus, concern: Optional[ConcernLevel] = None
    ) -> SentinelSessionResponse:
        pass

    # Location Events
    @abstractmethod
    async def record_location(
        self, user_id: UUID, session_id: UUID, location: LocationUpdateRequest
    ) -> dict[str, Any]:
        pass

    @abstractmethod
    async def get_location_history(
        self, user_id: UUID, session_id: UUID, limit: int = 50
    ) -> list[dict[str, Any]]:
        pass

    # Anomalies
    @abstractmethod
    async def record_anomaly(self, anomaly: AnomalyRecord) -> AnomalyRecord:
        pass

    @abstractmethod
    async def get_active_anomalies(self, session_id: UUID) -> list[dict[str, Any]]:
        pass

    # Verifications
    @abstractmethod
    async def create_verification(self, verification: VerificationRecord) -> VerificationRecord:
        pass

    @abstractmethod
    async def get_pending_verification(self, session_id: UUID) -> Optional[dict[str, Any]]:
        pass

    @abstractmethod
    async def resolve_verification(
        self, verification_id: UUID, status: VerificationStatus, response_note: Optional[str] = None
    ) -> dict[str, Any]:
        pass

    # Unified Timeline
    @abstractmethod
    async def record_timeline_event(self, event: LiveIncidentEvent) -> LiveIncidentEvent:
        pass

    @abstractmethod
    async def list_timeline_events(
        self, user_id: UUID, incident_id: Optional[UUID] = None, session_id: Optional[UUID] = None
    ) -> list[LiveIncidentEvent]:
        pass

    # Contact Relay
    @abstractmethod
    async def create_relay_token(self, relay_data: ContactRelayData) -> str:
        pass

    @abstractmethod
    async def get_relay_data(self, token: str) -> Optional[ContactRelayData]:
        pass

    @abstractmethod
    async def acknowledge_relay(self, token: str, responder_name: str, responder_note: Optional[str] = None) -> ContactRelayData:
        pass


class InMemorySentinelRepository(BaseSentinelRepository):
    """Full in-memory implementation for Sentinel operations."""

    def __init__(self) -> None:
        self.sessions: dict[UUID, dict[str, Any]] = {}
        self.locations: dict[UUID, list[dict[str, Any]]] = {}  # session_id -> list
        self.anomalies: dict[UUID, dict[str, Any]] = {}
        self.verifications: dict[UUID, dict[str, Any]] = {}
        self.timeline_events: list[dict[str, Any]] = []
        self.relay_tokens: dict[str, dict[str, Any]] = {}

    async def create_session(self, user_id: UUID, data: SentinelSessionCreate) -> SentinelSessionResponse:
        # Check for existing active session
        for s in self.sessions.values():
            if s["user_id"] == user_id and s["status"] in (SessionStatus.ACTIVE.value, SessionStatus.PAUSED.value):
                # Auto-complete or close old active session
                s["status"] = SessionStatus.COMPLETED.value
                s["updated_at"] = datetime.now(timezone.utc)

        session_id = uuid4()
        now = datetime.now(timezone.utc)
        record = {
            "id": session_id,
            "user_id": user_id,
            "incident_id": data.incident_id,
            "status": SessionStatus.ACTIVE.value,
            "destination_name": data.destination_name.strip(),
            "destination_lat": data.destination_lat,
            "destination_lng": data.destination_lng,
            "start_lat": data.start_lat,
            "start_lng": data.start_lng,
            "expected_arrival": data.expected_arrival,
            "travel_mode": data.travel_mode.value,
            "trusted_contact_ids": [str(c) for c in data.trusted_contact_ids],
            "share_location": data.share_location,
            "verification_timeout_seconds": data.verification_timeout_seconds,
            "deviation_threshold_meters": data.deviation_threshold_meters,
            "concern_level": ConcernLevel.NORMAL.value,
            "last_location": None,
            "created_at": now,
            "updated_at": now,
            "is_demo": data.is_demo,
        }
        self.sessions[session_id] = record
        self.locations[session_id] = []

        return SentinelSessionResponse(
            id=session_id,
            user_id=user_id,
            incident_id=data.incident_id,
            status=SessionStatus.ACTIVE,
            destination_name=record["destination_name"],
            destination_lat=record["destination_lat"],
            destination_lng=record["destination_lng"],
            expected_arrival=record["expected_arrival"],
            travel_mode=data.travel_mode,
            trusted_contact_ids=data.trusted_contact_ids,
            share_location=record["share_location"],
            verification_timeout_seconds=record["verification_timeout_seconds"],
            concern_level=ConcernLevel.NORMAL,
            last_location=None,
            created_at=now,
            updated_at=now,
            is_demo=data.is_demo,
        )

    async def get_session(self, user_id: UUID, session_id: UUID) -> Optional[dict[str, Any]]:
        s = self.sessions.get(session_id)
        if not s or s["user_id"] != user_id:
            return None
        return dict(s)

    async def get_active_session(self, user_id: UUID) -> Optional[dict[str, Any]]:
        for s in self.sessions.values():
            if s["user_id"] == user_id and s["status"] in (SessionStatus.ACTIVE.value, SessionStatus.PAUSED.value):
                return dict(s)
        return None

    async def update_session_status(
        self, user_id: UUID, session_id: UUID, status: SessionStatus, concern: Optional[ConcernLevel] = None
    ) -> SentinelSessionResponse:
        s = self.sessions.get(session_id)
        if not s or s["user_id"] != user_id:
            raise NotFoundError("Sentinel session not found.")

        now = datetime.now(timezone.utc)
        s["status"] = status.value
        s["updated_at"] = now
        if concern:
            s["concern_level"] = concern.value

        return SentinelSessionResponse(
            id=s["id"],
            user_id=s["user_id"],
            incident_id=s.get("incident_id"),
            status=status,
            destination_name=s["destination_name"],
            destination_lat=s.get("destination_lat"),
            destination_lng=s.get("destination_lng"),
            expected_arrival=s["expected_arrival"],
            travel_mode=s["travel_mode"],
            trusted_contact_ids=[UUID(cid) for cid in s.get("trusted_contact_ids", [])],
            share_location=s["share_location"],
            verification_timeout_seconds=s["verification_timeout_seconds"],
            concern_level=ConcernLevel(s["concern_level"]),
            last_location=s.get("last_location"),
            created_at=s["created_at"],
            updated_at=s["updated_at"],
            is_demo=s.get("is_demo", False),
        )

    async def record_location(
        self, user_id: UUID, session_id: UUID, location: LocationUpdateRequest
    ) -> dict[str, Any]:
        s = self.sessions.get(session_id)
        if not s or s["user_id"] != user_id:
            raise NotFoundError("Sentinel session not found.")

        now = location.timestamp or datetime.now(timezone.utc)
        loc_record = {
            "session_id": session_id,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "accuracy": location.accuracy,
            "speed": location.speed,
            "heading": location.heading,
            "timestamp": now,
            "is_simulated": location.is_simulated,
        }
        self.locations.setdefault(session_id, []).append(loc_record)
        s["last_location"] = loc_record
        s["updated_at"] = now
        return loc_record

    async def get_location_history(
        self, user_id: UUID, session_id: UUID, limit: int = 50
    ) -> list[dict[str, Any]]:
        s = self.sessions.get(session_id)
        if not s or s["user_id"] != user_id:
            raise NotFoundError("Sentinel session not found.")
        history = self.locations.get(session_id, [])
        return history[-limit:]

    async def record_anomaly(self, anomaly: AnomalyRecord) -> AnomalyRecord:
        record = anomaly.model_dump()
        self.anomalies[anomaly.id] = record
        return anomaly

    async def get_active_anomalies(self, session_id: UUID) -> list[dict[str, Any]]:
        return [
            a for a in self.anomalies.values()
            if a["session_id"] == session_id and not a.get("resolved")
        ]

    async def create_verification(self, verification: VerificationRecord) -> VerificationRecord:
        self.verifications[verification.id] = verification.model_dump()
        return verification

    async def get_pending_verification(self, session_id: UUID) -> Optional[dict[str, Any]]:
        for v in self.verifications.values():
            if v["session_id"] == session_id and v["status"] == VerificationStatus.PENDING.value:
                return dict(v)
        return None

    async def resolve_verification(
        self, verification_id: UUID, status: VerificationStatus, response_note: Optional[str] = None
    ) -> dict[str, Any]:
        v = self.verifications.get(verification_id)
        if not v:
            raise NotFoundError("Verification record not found.")
        now = datetime.now(timezone.utc)
        v["status"] = status.value
        v["responded_at"] = now
        v["user_response"] = response_note
        return dict(v)

    async def record_timeline_event(self, event: LiveIncidentEvent) -> LiveIncidentEvent:
        self.timeline_events.append(event.model_dump())
        return event

    async def list_timeline_events(
        self, user_id: UUID, incident_id: Optional[UUID] = None, session_id: Optional[UUID] = None
    ) -> list[LiveIncidentEvent]:
        matched = []
        for e in self.timeline_events:
            if incident_id and e.get("incident_id") == incident_id:
                matched.append(LiveIncidentEvent(**e))
            elif session_id and e.get("session_id") == session_id:
                matched.append(LiveIncidentEvent(**e))
        matched.sort(key=lambda x: x.timestamp)
        return matched

    async def create_relay_token(self, relay_data: ContactRelayData) -> str:
        self.relay_tokens[relay_data.token] = relay_data.model_dump()
        return relay_data.token

    async def get_relay_data(self, token: str) -> Optional[ContactRelayData]:
        data = self.relay_tokens.get(token)
        if not data:
            return None
        return ContactRelayData(**data)

    async def acknowledge_relay(
        self, token: str, responder_name: str, responder_note: Optional[str] = None
    ) -> ContactRelayData:
        data = self.relay_tokens.get(token)
        if not data:
            raise NotFoundError("Invalid or expired response relay link.")

        now = datetime.now(timezone.utc)
        data["status"] = "acknowledged"
        data["acknowledged_at"] = now
        data["acknowledged_by"] = responder_name.strip()
        data["relay_notes"] = responder_note.strip() if responder_note else None
        return ContactRelayData(**data)


# Singleton in-memory instance for dev / test mode
_in_memory_sentinel_repo = InMemorySentinelRepository()


def get_sentinel_repository(settings: Settings = Depends(get_settings)) -> BaseSentinelRepository:
    """Dependency provider returning in-memory repository for local evaluation."""
    # When USE_IN_MEMORY_ADAPTER is set or during testing, use in-memory store
    return _in_memory_sentinel_repo
