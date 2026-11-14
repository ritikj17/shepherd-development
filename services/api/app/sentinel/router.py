from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser
from app.database.base import BaseRepository
from app.database.dependencies import get_repository
from app.models.sentinel import (
    ContactAcknowledgeInput,
    ContactRelayData,
    LiveIncidentEvent,
    LocationUpdateRequest,
    SentinelSessionCreate,
    SentinelSessionResponse,
    SilentAssistTriggerInput,
    TimelineEventListResponse,
    VerificationResponseInput,
)
from app.notifications.service import NotificationService, get_notification_service
from app.safety.repository import BaseSafetyRepository, get_safety_repository
from app.sentinel.repository import BaseSentinelRepository, get_sentinel_repository
from app.sentinel.service import SentinelService

router = APIRouter(prefix="/api/v1", tags=["Sentinel & Live Response"])


def get_sentinel_service(
    sentinel_repo: BaseSentinelRepository = Depends(get_sentinel_repository),
    safety_repo: BaseSafetyRepository = Depends(get_safety_repository),
    core_repo: BaseRepository = Depends(get_repository),
    notif_service: NotificationService = Depends(get_notification_service),
) -> SentinelService:
    return SentinelService(
        sentinel_repo=sentinel_repo,
        safety_repo=safety_repo,
        core_repo=core_repo,
        notification_service=notif_service,
    )


# ---------------- Sessions ----------------

@router.post(
    "/sentinel/sessions",
    response_model=SentinelSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a Sentinel safety monitoring session",
)
async def start_sentinel_session(
    data: SentinelSessionCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SentinelService = Depends(get_sentinel_service),
) -> SentinelSessionResponse:
    return await service.start_session(current_user.id, data)


@router.get(
    "/sentinel/sessions/active",
    response_model=Optional[SentinelSessionResponse],
    summary="Get user's active Sentinel session",
)
async def get_active_sentinel_session(
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SentinelService = Depends(get_sentinel_service),
) -> Optional[SentinelSessionResponse]:
    return await service.get_active_session(current_user.id)


@router.post(
    "/sentinel/sessions/{session_id}/pause",
    response_model=SentinelSessionResponse,
    summary="Pause active Sentinel session",
)
async def pause_sentinel_session(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SentinelService = Depends(get_sentinel_service),
) -> SentinelSessionResponse:
    return await service.pause_session(current_user.id, session_id)


@router.post(
    "/sentinel/sessions/{session_id}/resume",
    response_model=SentinelSessionResponse,
    summary="Resume paused Sentinel session",
)
async def resume_sentinel_session(
    session_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SentinelService = Depends(get_sentinel_service),
) -> SentinelSessionResponse:
    return await service.resume_session(current_user.id, session_id)


@router.post(
    "/sentinel/sessions/{session_id}/stop",
    response_model=SentinelSessionResponse,
    summary="Conclude or cancel Sentinel session",
)
async def stop_sentinel_session(
    session_id: UUID,
    reason: str = "completed",
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SentinelService = Depends(get_sentinel_service),
) -> SentinelSessionResponse:
    return await service.stop_session(current_user.id, session_id, reason)


# ---------------- Location & Anomalies ----------------

@router.post(
    "/sentinel/sessions/{session_id}/location",
    summary="Ingest browser foreground location update and run anomaly evaluation",
)
async def ingest_sentinel_location(
    session_id: UUID,
    location: LocationUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SentinelService = Depends(get_sentinel_service),
) -> dict:
    return await service.ingest_location(current_user.id, session_id, location)


# ---------------- Verification ----------------

@router.post(
    "/sentinel/sessions/{session_id}/verifications/{verification_id}/respond",
    summary="Answer safety verification check ('safe', 'help_requested', or 'cannot_respond')",
)
async def respond_to_safety_verification(
    session_id: UUID,
    verification_id: UUID,
    data: VerificationResponseInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SentinelService = Depends(get_sentinel_service),
) -> dict:
    return await service.respond_to_verification(current_user.id, session_id, verification_id, data)


# ---------------- Silent Assist ----------------

@router.post(
    "/sentinel/silent-assist",
    summary="Trigger one-touch Silent Assist distress alert and escalate to contacts",
)
async def trigger_silent_assist(
    data: SilentAssistTriggerInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SentinelService = Depends(get_sentinel_service),
) -> dict:
    return await service.trigger_silent_assist(current_user.id, data)


# ---------------- Unified Incident Timeline ----------------

@router.get(
    "/sentinel/timeline",
    response_model=TimelineEventListResponse,
    summary="Retrieve unified chronological live events for an incident or session",
)
async def get_live_timeline(
    incident_id: Optional[UUID] = None,
    session_id: Optional[UUID] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: SentinelService = Depends(get_sentinel_service),
) -> TimelineEventListResponse:
    events = await service.get_timeline(current_user.id, incident_id, session_id)
    return TimelineEventListResponse(items=events)


# ---------------- Public Rescue Relay (Trusted Contacts) ----------------

relay_router = APIRouter(prefix="/api/v1", tags=["Rescue Relay"])


@relay_router.get(
    "/relay/{token}",
    response_model=ContactRelayData,
    summary="Public endpoint for trusted contacts to review an active safety alert",
)
async def get_contact_relay_details(
    token: str,
    sentinel_repo: BaseSentinelRepository = Depends(get_sentinel_repository),
) -> ContactRelayData:
    data = await sentinel_repo.get_relay_data(token)
    if not data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Alert link is expired or invalid.")
    return data


@relay_router.post(
    "/relay/{token}/acknowledge",
    response_model=ContactRelayData,
    summary="Acknowledge alert and confirm trusted contact is responding",
)
async def acknowledge_contact_relay(
    token: str,
    data: ContactAcknowledgeInput,
    service: SentinelService = Depends(get_sentinel_service),
) -> ContactRelayData:
    return await service.acknowledge_relay_alert(token, data)
