from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser
from app.database.base import BaseRepository
from app.database.dependencies import get_repository
from app.models.safety import (
    SafetySessionCheckinRequest,
    SafetySessionCheckinResponse,
    SafetySessionCreate,
    SafetySessionListResponse,
    SafetySessionResponse,
    TrustedContactCreate,
    TrustedContactListResponse,
    TrustedContactResponse,
)
from app.notifications.service import NotificationService, get_notification_service
from app.safety.repository import BaseSafetyRepository, get_safety_repository
from app.safety.service import SafetyService

router = APIRouter(prefix="/api/v1", tags=["SafeCircle"])


def get_safety_service(
    safety_repo: BaseSafetyRepository = Depends(get_safety_repository),
    notif_service: NotificationService = Depends(get_notification_service),
    core_repo: BaseRepository = Depends(get_repository),
) -> SafetyService:
    return SafetyService(
        safety_repo=safety_repo,
        notification_service=notif_service,
        core_repo=core_repo,
    )


# ---------------- Trusted Contacts ----------------


@router.post(
    "/trusted-contacts",
    response_model=TrustedContactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a trusted contact",
)
async def create_trusted_contact(
    data: TrustedContactCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SafetyService = Depends(get_safety_service),
) -> TrustedContactResponse:
    return await service.add_trusted_contact(current_user.id, data)


@router.get(
    "/trusted-contacts",
    response_model=TrustedContactListResponse,
    status_code=status.HTTP_200_OK,
    summary="List trusted contacts for authenticated user",
)
async def list_trusted_contacts(
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SafetyService = Depends(get_safety_service),
) -> TrustedContactListResponse:
    return await service.list_trusted_contacts(current_user.id)


@router.delete(
    "/trusted-contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a trusted contact",
)
async def delete_trusted_contact(
    contact_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SafetyService = Depends(get_safety_service),
) -> None:
    await service.delete_trusted_contact(current_user.id, contact_id)


# ---------------- Safety Sessions ----------------


@router.post(
    "/safety-sessions",
    response_model=SafetySessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a safety check-in session",
)
async def create_safety_session(
    data: SafetySessionCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SafetyService = Depends(get_safety_service),
) -> SafetySessionResponse:
    return await service.create_safety_session(current_user.id, data)


@router.get(
    "/safety-sessions",
    response_model=SafetySessionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List safety check-in sessions for authenticated user",
)
async def list_safety_sessions(
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SafetyService = Depends(get_safety_service),
) -> SafetySessionListResponse:
    return await service.list_safety_sessions(current_user.id)


@router.post(
    "/safety-sessions/{session_id}/checkin",
    response_model=SafetySessionCheckinResponse,
    status_code=status.HTTP_200_OK,
    summary="Check in to an active safety session",
)
async def checkin_safety_session(
    session_id: UUID,
    data: SafetySessionCheckinRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SafetyService = Depends(get_safety_service),
) -> SafetySessionCheckinResponse:
    return await service.checkin(current_user.id, session_id, data)
