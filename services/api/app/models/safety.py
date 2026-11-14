"""Shared foundation models for Member 4 modules (safety_sessions, trusted_contacts, alerts, reports).

Member 4 coordinates with Member 2 for any schema adjustments.
"""
from datetime import datetime
from enum import Enum
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ContactMethod(str, Enum):
    EMAIL = "email"
    PHONE = "phone"


class TrustedContactCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=255)
    contact_method: ContactMethod
    contact_value: str = Field(..., min_length=1, max_length=255)
    consent_confirmed: bool = Field(..., description="Explicit consent required")


class TrustedContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    contact_method: ContactMethod
    created_at: datetime


class TrustedContactListResponse(BaseModel):
    items: list[TrustedContactResponse]


class SafetySessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trusted_contact_id: UUID
    incident_id: Optional[UUID] = None
    checkin_deadline: datetime
    consent_confirmed: bool


class SafetySessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trusted_contact_id: UUID
    incident_id: Optional[UUID] = None
    status: Literal["active", "checked_in", "expired", "cancelled"]
    checkin_deadline: datetime
    created_at: datetime


class SafetySessionCheckinRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: Optional[str] = "I am safe."


class SafetySessionCheckinResponse(BaseModel):
    id: UUID
    status: Literal["checked_in"]
    checked_in_at: datetime


class SafetySessionListResponse(BaseModel):
    items: list[SafetySessionResponse]


class ReportGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    include_evidence_index: bool = True
    include_analysis: bool = True


class ReportGenerateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: UUID
    incident_id: UUID
    status: Literal["generated", "failed", "expired"]
    file_name: str
    download_url: str
    generated_at: datetime
    expires_at: Optional[datetime] = None
