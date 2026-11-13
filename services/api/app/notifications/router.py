from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser
from app.core.exceptions import NotFoundError
from app.notifications.models import AlertListResponse, AlertResponse, OverdueCheckResponse
from app.notifications.repository import BaseNotificationRepository, get_notification_repository
from app.notifications.service import NotificationService, get_notification_service
from app.safety.repository import BaseSafetyRepository, get_safety_repository

router = APIRouter(prefix="/api/v1", tags=["Notifications & Alerts"])


@router.get(
    "/alerts",
    response_model=AlertListResponse,
    status_code=status.HTTP_200_OK,
    summary="List notification alerts for authenticated user",
)
async def list_alerts(
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> AlertListResponse:
    alerts = await service.list_user_alerts(current_user.id)
    return AlertListResponse(items=alerts)


@router.get(
    "/alerts/{alert_id}",
    response_model=AlertResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single alert detail for authenticated user",
)
async def get_alert(
    alert_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repo: BaseNotificationRepository = Depends(get_notification_repository),
) -> AlertResponse:
    alert = await repo.get_alert(current_user.id, alert_id)
    if not alert:
        raise NotFoundError("Alert record not found.")
    return alert


@router.post(
    "/notifications/check-overdue",
    response_model=OverdueCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Check overdue safety sessions and dispatch reminders",
)
async def check_overdue_sessions(
    current_user: AuthenticatedUser = Depends(get_current_user),
    safety_repo: BaseSafetyRepository = Depends(get_safety_repository),
    service: NotificationService = Depends(get_notification_service),
) -> OverdueCheckResponse:
    overdue_sessions = await safety_repo.expire_overdue_sessions(user_id=current_user.id)
    reminders_sent = 0
    details = []

    for s in overdue_sessions:
        contact = await safety_repo.get_contact(current_user.id, s["trusted_contact_id"])
        if contact:
            alert = await service.dispatch_missed_checkin_reminder(
                user_id=current_user.id,
                session_id=s["id"],
                contact_id=contact["id"],
                contact_name=contact["name"],
                contact_method=contact["contact_method"],
                contact_value=contact["contact_value"],
                consent_confirmed=contact["consent_confirmed"],
                deadline=s["checkin_deadline"],
            )
            reminders_sent += 1
            details.append({"session_id": str(s["id"]), "alert_id": str(alert.id), "status": alert.status})

    return OverdueCheckResponse(
        expired_sessions_count=len(overdue_sessions),
        reminders_dispatched_count=reminders_sent,
        details=details,
    )
