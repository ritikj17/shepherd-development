from uuid import UUID

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser
from app.core.intelligence_client import IntelligenceClient
from app.database.base import BaseRepository
from app.database.dependencies import get_repository
from app.models.analysis import (
    IncidentGraphResponse,
    ThreatAnalysisListResponse,
    ThreatAnalysisRequest,
    ThreatAnalysisResponse,
)

router = APIRouter(prefix="/api/v1", tags=["ThreatLens & PatternGraph"])


def get_intelligence_client() -> IntelligenceClient:
    return IntelligenceClient()


@router.post(
    "/incidents/{incident_id}/analysis",
    response_model=ThreatAnalysisResponse,
    summary="Request threat analysis for an incident and its evidence",
)
async def request_threat_analysis(
    incident_id: UUID,
    request: ThreatAnalysisRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
    ai_client: IntelligenceClient = Depends(get_intelligence_client),
) -> ThreatAnalysisResponse:
    """Orchestrates threat analysis request to Member 3's Intelligence API.

    1. Validates incident ownership.
    2. Validates evidence ownership and retrieves files from private storage.
    3. Calls Intelligence API server-to-server.
    4. Persists results and returns documented schema.
    Never fabricates successful analysis.
    """
    # Validate incident ownership
    incident = await repo.get_incident(current_user.id, incident_id)

    # Gather evidence items
    evidence_items = []
    if request.evidence_ids:
        for eid in request.evidence_ids:
            content, mime_type, file_name = await repo.get_evidence_bytes(current_user.id, eid)
            evidence_items.append({
                "evidence_id": eid,
                "mime_type": mime_type,
                "file_name": file_name,
                "bytes": content,
            })

    # Call Intelligence API server-to-server
    analysis_raw = await ai_client.analyze_incident(
        incident_id=incident_id,
        description=incident.description if request.include_description else "",
        evidence_items=evidence_items,
    )

    # Persist analysis in database
    return await repo.save_threat_analysis(
        user_id=current_user.id,
        incident_id=incident_id,
        analysis_data=analysis_raw,
    )


@router.get(
    "/incidents/{incident_id}/analysis",
    response_model=ThreatAnalysisListResponse,
    summary="List threat analyses for an incident",
)
async def get_incident_analyses(
    incident_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
) -> ThreatAnalysisListResponse:
    items = await repo.list_threat_analyses(current_user.id, incident_id)
    return ThreatAnalysisListResponse(items=items)


@router.get(
    "/graph/{incident_id}",
    response_model=IncidentGraphResponse,
    summary="Get incident relationship graph for PatternGraph visualization",
)
async def get_incident_graph(
    incident_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
    ai_client: IntelligenceClient = Depends(get_intelligence_client),
) -> IncidentGraphResponse:
    """Retrieve graph relationships for the authorized user's incident.

    Checks repository records and queries Intelligence API if available.
    """
    # Ensure ownership check on incident
    await repo.get_incident(current_user.id, incident_id)

    # Check if Intelligence API has updated graph representation
    upstream_graph = await ai_client.get_graph(incident_id)
    if upstream_graph:
        return IncidentGraphResponse(**upstream_graph)

    # Return repository graph
    return await repo.get_incident_graph(current_user.id, incident_id)
