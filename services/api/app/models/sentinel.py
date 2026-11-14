from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class TravelMode(str, Enum):
    WALKING = "walking"
    TRANSIT = "transit"
    DRIVING = "driving"
    OTHER = "other"


class SessionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ESCALATED = "escalated"


class ConcernLevel(str, Enum):
    NORMAL = "normal"
    ADVISORY = "advisory"
    WARNING = "warning"
    CRITICAL = "critical"


class AnomalyType(str, Enum):
    ROUTE_DEVIATION = "route_deviation"
    SPEED_ANOMALY = "speed_anomaly"
    UNEXPECTED_STOP = "unexpected_stop"
    JOURNEY_TIMEOUT = "journey_timeout"
    STALE_LOCATION = "stale_location"
    COMBINED = "combined"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    SAFE = "safe"
    HELP_REQUESTED = "help_requested"
    UNANSWERED = "unanswered"


# ---------------- Location & Checkpoints ----------------

class LocationPoint(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LocationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy: Optional[float] = Field(None, ge=0.0)
    speed: Optional[float] = Field(None, ge=0.0)
    heading: Optional[float] = Field(None, ge=0.0, le=360.0)
    timestamp: Optional[datetime] = None
    is_simulated: bool = False


# ---------------- Sessions ----------------

class SentinelSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destination_name: str = Field(..., min_length=1, max_length=255)
    destination_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    destination_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    start_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    start_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    expected_arrival: datetime
    travel_mode: TravelMode = TravelMode.WALKING
    trusted_contact_ids: list[UUID] = Field(default_factory=list)
    incident_id: Optional[UUID] = None
    share_location: bool = True
    verification_timeout_seconds: int = Field(default=60, ge=15, le=300)
    deviation_threshold_meters: float = Field(default=200.0, ge=50.0, le=2000.0)
    route_checkpoints: list[dict[str, Any]] = Field(default_factory=list)
    is_demo: bool = False


class SentinelSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    incident_id: Optional[UUID] = None
    status: SessionStatus
    destination_name: str
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    expected_arrival: datetime
    travel_mode: TravelMode
    trusted_contact_ids: list[UUID]
    share_location: bool
    verification_timeout_seconds: int
    concern_level: ConcernLevel
    last_location: Optional[dict[str, Any]] = None
    active_anomaly: Optional[dict[str, Any]] = None
    active_verification: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    is_demo: bool = False


class SentinelSessionListResponse(BaseModel):
    items: list[SentinelSessionResponse]


# ---------------- Anomalies ----------------

class AnomalyRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    anomaly_type: AnomalyType
    severity: Literal["low", "medium", "high", "critical"]
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reason: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    rule_triggered: str
    location: Optional[dict[str, Any]] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None


# ---------------- Safety Verification ----------------

class VerificationRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(default_factory=uuid4)
    session_id: UUID
    anomaly_id: Optional[UUID] = None
    prompt: str = "Your journey seems different from your planned route. Are you safe?"
    deadline: datetime
    status: VerificationStatus = VerificationStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    responded_at: Optional[datetime] = None
    user_response: Optional[str] = None


class VerificationResponseInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    response: Literal["safe", "help_requested", "cannot_respond"]
    user_note: Optional[str] = None


# ---------------- Silent Assist & Live Distress ----------------

class SilentAssistTriggerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: Optional[UUID] = None
    incident_id: Optional[UUID] = None
    current_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    current_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    accuracy: Optional[float] = None
    haptic_confirmed: bool = False


# ---------------- Unified Incident Timeline ----------------

class LiveIncidentEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(default_factory=uuid4)
    incident_id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    event_type: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actor: str = "user"
    status: Literal["info", "warning", "distress", "resolved", "success"] = "info"
    title: str
    description: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class TimelineEventListResponse(BaseModel):
    items: list[LiveIncidentEvent]


# ---------------- Contact Relay & Acknowledgement ----------------

class ContactRelayData(BaseModel):
    token: str
    alert_id: UUID
    session_id: Optional[UUID] = None
    incident_id: Optional[UUID] = None
    user_display_name: str
    reason: str
    timestamp: datetime
    expires_at: datetime
    last_location: Optional[dict[str, Any]] = None
    status: Literal["pending", "acknowledged", "expired"]
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    relay_notes: Optional[str] = None


class ContactAcknowledgeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    responder_name: str = Field(..., min_length=1, max_length=255)
    responder_note: Optional[str] = Field(None, max_length=500)
