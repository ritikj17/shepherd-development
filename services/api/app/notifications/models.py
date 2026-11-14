"""Notification and Alert Pydantic models."""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

AlertChannel = Literal["email", "sms", "demo"]
AlertStatus = Literal["queued", "sent", "delivered", "failed", "simulated"]


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    safety_session_id: Optional[UUID] = None
    trusted_contact_id: Optional[UUID] = None
    channel: AlertChannel
    status: AlertStatus
    provider_reference: Optional[str] = None
    message_type: str
    error_message: Optional[str] = None
    created_at: datetime


class AlertListResponse(BaseModel):
    items: list[AlertResponse]


class OverdueCheckResponse(BaseModel):
    expired_sessions_count: int
    reminders_dispatched_count: int
    details: list[dict] = Field(default_factory=list)
