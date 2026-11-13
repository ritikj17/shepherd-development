from datetime import datetime, timezone
import logging
from typing import Optional
from uuid import UUID

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.notifications.models import AlertChannel, AlertResponse
from app.notifications.provider import BaseNotificationProvider, get_notification_provider
from app.notifications.repository import BaseNotificationRepository, get_notification_repository

logger = logging.getLogger("shepherd.notifications")


class NotificationService:
    """Orchestrates consent-governed notifications and alert logging."""

    def __init__(
        self,
        repository: BaseNotificationRepository,
        provider: BaseNotificationProvider,
    ) -> None:
        self.repo = repository
        self.provider = provider

    async def dispatch_session_start(
        self,
        user_id: UUID,
        session_id: UUID,
        contact_id: UUID,
        contact_name: str,
        contact_method: str,
        contact_value: str,
        consent_confirmed: bool,
        deadline: datetime,
    ) -> AlertResponse:
        """Dispatch session start notification with consent enforcement."""
        channel: AlertChannel = "email" if contact_method == "email" else "sms"

        if not consent_confirmed:
            logger.warning("Consent not confirmed for contact %s; skipping notification", contact_id)
            return await self.repo.create_alert(
                user_id=user_id,
                channel=channel,
                status="failed",
                message_type="session_start",
                safety_session_id=session_id,
                trusted_contact_id=contact_id,
                error_message="Consent was not confirmed for this contact.",
            )

        subject = "SHEPHERD SafeCircle: Safety Check-In Scheduled"
        body = (
            f"Hello {contact_name},\n\n"
            f"A user has initiated a SHEPHERD SafeCircle safety check-in session with you as their trusted contact.\n"
            f"Check-in deadline: {deadline.isoformat()} (UTC).\n\n"
            "If they do not check in by this deadline, you will receive an informational reminder.\n"
            "DISCLAIMER: SHEPHERD is an informational documentation tool, NOT an emergency response service. "
            "No automatic police or emergency service dispatch will occur."
        )

        res = await self.provider.dispatch(
            channel=channel,
            recipient=contact_value,
            subject=subject,
            body=body,
            message_type="session_start",
        )

        return await self.repo.create_alert(
            user_id=user_id,
            channel=channel,
            status=res.status,
            message_type="session_start",
            safety_session_id=session_id,
            trusted_contact_id=contact_id,
            provider_reference=res.provider_reference,
            error_message=res.error_message,
        )

    async def dispatch_checkin_received(
        self,
        user_id: UUID,
        session_id: UUID,
        contact_id: UUID,
        contact_name: str,
        contact_method: str,
        contact_value: str,
        consent_confirmed: bool,
        checked_in_at: datetime,
    ) -> AlertResponse:
        """Dispatch safe check-in notification to trusted contact."""
        channel: AlertChannel = "email" if contact_method == "email" else "sms"

        if not consent_confirmed:
            return await self.repo.create_alert(
                user_id=user_id,
                channel=channel,
                status="failed",
                message_type="checkin_confirmed",
                safety_session_id=session_id,
                trusted_contact_id=contact_id,
                error_message="Consent was not confirmed for this contact.",
            )

        subject = "SHEPHERD SafeCircle: User Checked In Safely"
        body = (
            f"Hello {contact_name},\n\n"
            f"Good news! The user has successfully checked in to their SafeCircle session at {checked_in_at.isoformat()} (UTC).\n"
            "This safety session is now closed."
        )

        res = await self.provider.dispatch(
            channel=channel,
            recipient=contact_value,
            subject=subject,
            body=body,
            message_type="checkin_confirmed",
        )

        return await self.repo.create_alert(
            user_id=user_id,
            channel=channel,
            status=res.status,
            message_type="checkin_confirmed",
            safety_session_id=session_id,
            trusted_contact_id=contact_id,
            provider_reference=res.provider_reference,
            error_message=res.error_message,
        )

    async def dispatch_missed_checkin_reminder(
        self,
        user_id: UUID,
        session_id: UUID,
        contact_id: UUID,
        contact_name: str,
        contact_method: str,
        contact_value: str,
        consent_confirmed: bool,
        deadline: datetime,
    ) -> AlertResponse:
        """Dispatch informational missed check-in reminder to trusted contact."""
        channel: AlertChannel = "email" if contact_method == "email" else "sms"

        if not consent_confirmed:
            return await self.repo.create_alert(
                user_id=user_id,
                channel=channel,
                status="failed",
                message_type="missed_checkin_reminder",
                safety_session_id=session_id,
                trusted_contact_id=contact_id,
                error_message="Consent was not confirmed for this contact.",
            )

        subject = "SHEPHERD SafeCircle: Missed Check-In Reminder"
        body = (
            f"Hello {contact_name},\n\n"
            f"This is an informational reminder that the user has missed their SafeCircle check-in deadline ({deadline.isoformat()} UTC).\n\n"
            "Please attempt to reach out to them directly via your usual contact methods.\n\n"
            "IMPORTANT NOTICE: SHEPHERD does NOT notify or dispatch police, emergency responders, or legal authorities. "
            "If you believe there is an immediate emergency, please contact your local emergency services directly."
        )

        res = await self.provider.dispatch(
            channel=channel,
            recipient=contact_value,
            subject=subject,
            body=body,
            message_type="missed_checkin_reminder",
        )

        return await self.repo.create_alert(
            user_id=user_id,
            channel=channel,
            status=res.status,
            message_type="missed_checkin_reminder",
            safety_session_id=session_id,
            trusted_contact_id=contact_id,
            provider_reference=res.provider_reference,
            error_message=res.error_message,
        )

    async def list_user_alerts(self, user_id: UUID) -> list[AlertResponse]:
        return await self.repo.list_alerts(user_id)


def get_notification_service(
    settings: Settings = Depends(get_settings),
    repo: BaseNotificationRepository = Depends(get_notification_repository),
) -> NotificationService:
    if not isinstance(settings, Settings):
        settings = get_settings()
    if not isinstance(repo, BaseNotificationRepository):
        repo = get_notification_repository(settings)
    provider = get_notification_provider(settings)
    return NotificationService(repository=repo, provider=provider)
