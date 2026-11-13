from datetime import datetime, timezone
import logging
from typing import Optional
from uuid import UUID

from app.core.exceptions import BadRequestError, NotFoundError
from app.database.base import BaseRepository
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
from app.notifications.service import NotificationService
from app.safety.repository import BaseSafetyRepository

logger = logging.getLogger("shepherd.safety")


class SafetyService:
    """Business logic for SafeCircle contacts and sessions."""

    def __init__(
        self,
        safety_repo: BaseSafetyRepository,
        notification_service: NotificationService,
        core_repo: Optional[BaseRepository] = None,
    ) -> None:
        self.safety_repo = safety_repo
        self.notif_service = notification_service
        self.core_repo = core_repo

    # ---------------- Trusted Contacts ----------------

    async def add_trusted_contact(
        self, user_id: UUID, data: TrustedContactCreate
    ) -> TrustedContactResponse:
        if not data.consent_confirmed:
            raise BadRequestError("Consent confirmation is required.")

        return await self.safety_repo.create_contact(user_id, data)

    async def list_trusted_contacts(self, user_id: UUID) -> TrustedContactListResponse:
        contacts = await self.safety_repo.list_contacts(user_id)
        return TrustedContactListResponse(items=contacts)

    async def delete_trusted_contact(self, user_id: UUID, contact_id: UUID) -> None:
        contact = await self.safety_repo.get_contact(user_id, contact_id)
        if not contact:
            raise NotFoundError("Trusted contact not found.")

        # Check for active safety sessions using this contact
        has_active = await self.safety_repo.has_active_sessions_for_contact(user_id, contact_id)
        if has_active:
            raise BadRequestError(
                "Cannot delete trusted contact with active safety sessions.",
                details={"code": "CONTACT_IN_USE"},
            )

        await self.safety_repo.delete_contact(user_id, contact_id)

    # ---------------- Safety Sessions ----------------

    async def create_safety_session(
        self, user_id: UUID, data: SafetySessionCreate
    ) -> SafetySessionResponse:
        if not data.consent_confirmed:
            raise BadRequestError("Consent confirmation is required.")

        now = datetime.now(timezone.utc)
        # Ensure deadline is timezone-aware
        deadline = data.checkin_deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)

        if deadline <= now:
            raise BadRequestError("Check-in deadline must be in the future.")

        # Verify contact ownership
        contact = await self.safety_repo.get_contact(user_id, data.trusted_contact_id)
        if not contact:
            raise NotFoundError("Trusted contact not found.")

        # Verify incident ownership if specified
        if data.incident_id and self.core_repo:
            try:
                await self.core_repo.get_incident(user_id, data.incident_id)
            except NotFoundError:
                raise NotFoundError("Incident not found.")

        session_res = await self.safety_repo.create_session(user_id, data)

        # Dispatch session start notification
        try:
            await self.notif_service.dispatch_session_start(
                user_id=user_id,
                session_id=session_res.id,
                contact_id=contact["id"],
                contact_name=contact["name"],
                contact_method=contact["contact_method"],
                contact_value=contact["contact_value"],
                consent_confirmed=contact["consent_confirmed"],
                deadline=deadline,
            )
        except Exception as exc:
            logger.error("Failed to dispatch session start notification: %s", exc)

        return session_res

    async def list_safety_sessions(self, user_id: UUID) -> SafetySessionListResponse:
        sessions = await self.safety_repo.list_sessions(user_id)
        return SafetySessionListResponse(items=sessions)

    async def checkin(
        self, user_id: UUID, session_id: UUID, data: SafetySessionCheckinRequest
    ) -> SafetySessionCheckinResponse:
        session = await self.safety_repo.get_session(user_id, session_id)
        if not session:
            raise NotFoundError("Safety session not found.")

        if session["status"] == "cancelled":
            raise BadRequestError("Cannot check in to a cancelled safety session.")

        is_already_checked_in = session["status"] == "checked_in"
        res = await self.safety_repo.checkin_session(user_id, session_id, data.message)

        # Only notify once on first successful checkin
        if not is_already_checked_in:
            contact = await self.safety_repo.get_contact(user_id, session["trusted_contact_id"])
            if contact:
                try:
                    await self.notif_service.dispatch_checkin_received(
                        user_id=user_id,
                        session_id=session["id"],
                        contact_id=contact["id"],
                        contact_name=contact["name"],
                        contact_method=contact["contact_method"],
                        contact_value=contact["contact_value"],
                        consent_confirmed=contact["consent_confirmed"],
                        checked_in_at=res.checked_in_at,
                    )
                except Exception as exc:
                    logger.error("Failed to dispatch checkin notification: %s", exc)

        return res
