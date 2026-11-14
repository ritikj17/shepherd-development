from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser
from app.database.base import BaseRepository
from app.database.dependencies import get_repository
from app.models.incident import (
    IncidentCategory,
    IncidentCreate,
    IncidentListResponse,
    IncidentResponse,
    IncidentStatus,
    IncidentUpdate,
)

router = APIRouter(prefix="/api/v1/incidents", tags=["Incidents"])


@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user-owned incident",
)
async def create_incident(
    data: IncidentCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
) -> IncidentResponse:
    """Create a new incident. Authenticated user derived strictly from JWT becomes owner."""
    return await repo.create_incident(current_user.id, data)


@router.get(
    "",
    response_model=IncidentListResponse,
    summary="List incidents belonging to the authenticated user",
)
async def list_incidents(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    category: Optional[IncidentCategory] = Query(default=None),
    incident_status: Optional[IncidentStatus] = Query(default=None, alias="status"),
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
) -> IncidentListResponse:
    items, total = await repo.list_incidents(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        category=category,
        status=incident_status,
    )
    return IncidentListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/{incident_id}",
    response_model=IncidentResponse,
    summary="Get single incident by ID",
)
async def get_incident(
    incident_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
) -> IncidentResponse:
    return await repo.get_incident(current_user.id, incident_id)


@router.patch(
    "/{incident_id}",
    response_model=IncidentResponse,
    summary="Update incident details",
)
async def update_incident(
    incident_id: UUID,
    data: IncidentUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
) -> IncidentResponse:
    return await repo.update_incident(current_user.id, incident_id, data)


@router.delete(
    "/{incident_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete incident and cascade delete evidence",
)
async def delete_incident(
    incident_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseRepository = Depends(get_repository),
) -> Response:
    await repo.delete_incident(current_user.id, incident_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
