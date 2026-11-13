from pydantic import BaseModel, Field, UUID4
from typing import List, Optional, Dict, Any
from datetime import datetime

class EvidenceItem(BaseModel):
    evidence_id: UUID4 = Field(..., description="Evidence UUID")
    mime_type: str = Field(..., description="MIME type of the file, e.g., image/png")
    content_base64: str = Field(..., description="Base64‑encoded file content")

class RelatedIncident(BaseModel):
    incident_id: UUID4 = Field(..., description="Related incident UUID")
    type: str = Field(..., description="Incident type")
    severity: str = Field(..., description="Severity level")
    timestamp: datetime = Field(..., description="ISO-8601 timestamp")
    location: Optional[str] = Field(None, description="Location string")
    status: Optional[str] = Field(None, description="Current status")

class AnalyzeRequest(BaseModel):
    incident_id: UUID4 = Field(..., description="Incident UUID")
    description: Optional[str] = Field(None, description="User‑provided incident description")
    evidence: List[EvidenceItem] = Field(..., description="List of evidence items")
    related_incidents: Optional[List[RelatedIncident]] = Field(
        None, description="Optional list of related incident context supplied by Core API"
    )
