from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class IncidentCategory(str, Enum):
    CYBERSTALKING = "cyberstalking"
    THREAT = "threat"
    SEXTORTION = "sextortion"
    IMPERSONATION = "impersonation"
    DOXXING = "doxxing"
    IMAGE_BASED_ABUSE = "image_based_abuse"
    GENERAL_HARASSMENT = "general_harassment"
    OTHER = "other"


class IncidentStatus(str, Enum):
    OPEN = "open"
    ARCHIVED = "archived"


class IncidentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    category: IncidentCategory
    occurred_at: datetime
    location_description: Optional[str] = None


class IncidentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, min_length=1)
    category: Optional[IncidentCategory] = None
    occurred_at: Optional[datetime] = None
    location_description: Optional[str] = None
    status: Optional[IncidentStatus] = None


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    category: IncidentCategory
    occurred_at: datetime
    location_description: Optional[str] = None
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime


class IncidentListResponse(BaseModel):
    items: list[IncidentResponse]
    total: int
    limit: int
    offset: int
