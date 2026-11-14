from abc import ABC, abstractmethod
from typing import Optional
from uuid import UUID

from app.models.analysis import IncidentGraphResponse, ThreatAnalysisRequest, ThreatAnalysisResponse
from app.models.evidence import EvidenceUploadResponse, EvidenceVerifyResponse
from app.models.incident import (
    IncidentCategory,
    IncidentCreate,
    IncidentResponse,
    IncidentStatus,
    IncidentUpdate,
)


class BaseRepository(ABC):
    """Abstract interface for SHEPHERD database and storage operations."""

    # Incidents
    @abstractmethod
    async def create_incident(self, user_id: UUID, data: IncidentCreate) -> IncidentResponse:
        pass

    @abstractmethod
    async def list_incidents(
        self,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
        category: Optional[IncidentCategory] = None,
        status: Optional[IncidentStatus] = None,
    ) -> tuple[list[IncidentResponse], int]:
        pass

    @abstractmethod
    async def get_incident(self, user_id: UUID, incident_id: UUID) -> IncidentResponse:
        pass

    @abstractmethod
    async def update_incident(self, user_id: UUID, incident_id: UUID, data: IncidentUpdate) -> IncidentResponse:
        pass

    @abstractmethod
    async def delete_incident(self, user_id: UUID, incident_id: UUID) -> None:
        pass

    # Evidence
    @abstractmethod
    async def upload_evidence(
        self,
        user_id: UUID,
        incident_id: UUID,
        file_name: str,
        mime_type: str,
        content: bytes,
    ) -> EvidenceUploadResponse:
        pass

    @abstractmethod
    async def list_evidence(self, user_id: UUID, incident_id: UUID) -> list[EvidenceUploadResponse]:
        pass

    @abstractmethod
    async def get_evidence_bytes(self, user_id: UUID, evidence_id: UUID) -> tuple[bytes, str, str]:
        """Return (file_bytes, mime_type, file_name) for authorized user."""
        pass

    @abstractmethod
    async def verify_evidence(self, user_id: UUID, evidence_id: UUID) -> EvidenceVerifyResponse:
        pass

    # Threat Analysis
    @abstractmethod
    async def save_threat_analysis(
        self,
        user_id: UUID,
        incident_id: UUID,
        analysis_data: dict,
    ) -> ThreatAnalysisResponse:
        pass

    @abstractmethod
    async def list_threat_analyses(self, user_id: UUID, incident_id: UUID) -> list[ThreatAnalysisResponse]:
        pass

    # Incident Graph
    @abstractmethod
    async def get_incident_graph(self, user_id: UUID, incident_id: UUID) -> IncidentGraphResponse:
        pass
