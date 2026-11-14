from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ClassificationResult(BaseModel):
    label: str
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    confidence_type: Literal["model_score_not_calibrated_probability"] = (
        "model_score_not_calibrated_probability"
    )
    explanation: str


class Indicator(BaseModel):
    name: str
    description: str


class RiskAssessment(BaseModel):
    score: Optional[int] = Field(default=None, ge=0, le=100)
    level: Optional[Literal["low", "moderate", "high", "insufficient_data"]] = None
    label: Literal["review_priority"] = "review_priority"
    factors: list[dict[str, Any]] = Field(default_factory=list)
    explanation: str


class OCRSummary(BaseModel):
    status: Literal["completed", "failed", "not_applicable"]
    text_available: bool = False
    extracted_text: Optional[str] = None


class ThreatAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence_ids: list[UUID] = Field(default_factory=list)
    include_description: bool = True


class ThreatAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    analysis_id: UUID
    incident_id: UUID
    status: Literal["completed", "failed"]
    classification: ClassificationResult
    indicators: list[Indicator] = Field(default_factory=list)
    risk: RiskAssessment
    ocr: OCRSummary
    limitations: list[str] = Field(default_factory=list)
    created_at: datetime


class ThreatAnalysisListResponse(BaseModel):
    items: list[ThreatAnalysisResponse]


class GraphNode(BaseModel):
    id: UUID
    label: str
    category: str


class GraphEdge(BaseModel):
    id: UUID
    source: UUID
    target: UUID
    relationship: Literal[
        "SAME_USER_REPORTED_IDENTIFIER",
        "SIMILAR_MESSAGE_CONTENT",
        "REPEATED_CONTACT_PATTERN",
        "USER_REPORTED_RELATED_EVENT",
    ]
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    explanation: str


class IncidentGraphResponse(BaseModel):
    incident_id: UUID
    nodes: list[GraphNode]
    edges: list[GraphEdge]
