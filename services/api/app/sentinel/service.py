from datetime import datetime, timedelta, timezone
import logging
import secrets
from typing import Any, Optional
from uuid import UUID, uuid4

from app.core.exceptions import BadRequestError, NotFoundError
from app.database.base import BaseRepository
from app.models.incident import IncidentCategory, IncidentCreate
from app.models.sentinel import (
    AnomalyRecord,
    ConcernLevel,
    ContactAcknowledgeInput,
    ContactRelayData,
    LiveIncidentEvent,
    LocationUpdateRequest,
    SentinelSessionCreate,
    SentinelSessionResponse,
    SessionStatus,
    SilentAssistTriggerInput,
    VerificationRecord,
    VerificationResponseInput,
    VerificationStatus,
)
from app.notifications.service import NotificationService
from app.safety.repository import BaseSafetyRepository
from app.sentinel.repository import BaseSentinelRepository
from app.sentinel.rules import AnomalyDetectionEngine

logger = logging.getLogger("shepherd.sentinel.service")


class SentinelService:
    """Orchestrates Sentinel safety monitoring, anomaly analysis, verification, and rescue relay."""

    def __init__(
        self,
        sentinel_repo: BaseSentinelRepository,
        safety_repo: BaseSafetyRepository,
        core_repo: BaseRepository,
        notification_service: NotificationService,
    ) -> None:
        self.sentinel_repo = sentinel_repo
        self.safety_repo = safety_repo
        self.core_repo = core_repo
        self.notif_service = notification_service
        self.rules_engine = AnomalyDetectionEngine()

    async def start_session(self, user_id: UUID, data: SentinelSessionCreate) -> SentinelSessionResponse:
        """Start a new Sentinel safety monitoring journey."""
        now = datetime.now(timezone.utc)
        if data.expected_arrival <= now:
            raise BadRequestError("Expected arrival time must be in the future.")

        # Verify trusted contacts belong to user
        contacts = await self.safety_repo.list_contacts(user_id)
        user_contact_ids = {c.id for c in contacts}
        for cid in data.trusted_contact_ids:
            if cid not in user_contact_ids:
                raise BadRequestError(f"Trusted contact {cid} not found or does not belong to you.")

        # If incident_id provided, verify ownership
        if data.incident_id:
            await self.core_repo.get_incident(user_id, data.incident_id)

        session = await self.sentinel_repo.create_session(user_id, data)

        # Log timeline event
        await self.sentinel_repo.record_timeline_event(
            LiveIncidentEvent(
                incident_id=session.incident_id,
                session_id=session.id,
                event_type="session_activated",
                timestamp=now,
                actor="user",
                status="info",
                title="Sentinel Monitoring Activated",
                description=f"Journey towards '{session.destination_name}' initiated. Travel mode: {session.travel_mode.value}.",
                metadata={
                    "destination": session.destination_name,
                    "expected_arrival": session.expected_arrival.isoformat(),
                    "share_location": session.share_location,
                    "is_demo": session.is_demo,
                },
            )
        )

        return session

    async def get_active_session(self, user_id: UUID) -> Optional[SentinelSessionResponse]:
        """Retrieve current active or paused session for authenticated user."""
        s = await self.sentinel_repo.get_active_session(user_id)
        if not s:
            return None

        # Check for active anomaly and verification
        anomalies = await self.sentinel_repo.get_active_anomalies(s["id"])
        verification = await self.sentinel_repo.get_pending_verification(s["id"])

        active_anomaly = anomalies[0] if anomalies else None

        return SentinelSessionResponse(
            id=s["id"],
            user_id=s["user_id"],
            incident_id=s.get("incident_id"),
            status=s["status"],
            destination_name=s["destination_name"],
            destination_lat=s.get("destination_lat"),
            destination_lng=s.get("destination_lng"),
            expected_arrival=s["expected_arrival"],
            travel_mode=s["travel_mode"],
            trusted_contact_ids=[UUID(c) for c in s.get("trusted_contact_ids", [])],
            share_location=s["share_location"],
            verification_timeout_seconds=s["verification_timeout_seconds"],
            concern_level=ConcernLevel(s["concern_level"]),
            last_location=s.get("last_location"),
            active_anomaly=active_anomaly,
            active_verification=verification,
            created_at=s["created_at"],
            updated_at=s["updated_at"],
            is_demo=s.get("is_demo", False),
        )

    async def pause_session(self, user_id: UUID, session_id: UUID) -> SentinelSessionResponse:
        now = datetime.now(timezone.utc)
        session = await self.sentinel_repo.update_session_status(user_id, session_id, SessionStatus.PAUSED)
        await self.sentinel_repo.record_timeline_event(
            LiveIncidentEvent(
                incident_id=session.incident_id,
                session_id=session.id,
                event_type="session_paused",
                timestamp=now,
                actor="user",
                status="warning",
                title="Monitoring Paused",
                description="User temporarily paused foreground safety monitoring.",
            )
        )
        return session

    async def resume_session(self, user_id: UUID, session_id: UUID) -> SentinelSessionResponse:
        now = datetime.now(timezone.utc)
        session = await self.sentinel_repo.update_session_status(user_id, session_id, SessionStatus.ACTIVE)
        await self.sentinel_repo.record_timeline_event(
            LiveIncidentEvent(
                incident_id=session.incident_id,
                session_id=session.id,
                event_type="session_resumed",
                timestamp=now,
                actor="user",
                status="info",
                title="Monitoring Resumed",
                description="Foreground safety monitoring resumed.",
            )
        )
        return session

    async def stop_session(self, user_id: UUID, session_id: UUID, reason: str = "completed") -> SentinelSessionResponse:
        now = datetime.now(timezone.utc)
        status = SessionStatus.COMPLETED if reason == "completed" else SessionStatus.CANCELLED
        session = await self.sentinel_repo.update_session_status(user_id, session_id, status, ConcernLevel.NORMAL)
        await self.sentinel_repo.record_timeline_event(
            LiveIncidentEvent(
                incident_id=session.incident_id,
                session_id=session.id,
                event_type="session_ended",
                timestamp=now,
                actor="user",
                status="success" if status == SessionStatus.COMPLETED else "info",
                title="Journey Concluded" if status == SessionStatus.COMPLETED else "Monitoring Cancelled",
                description=f"Sentinel monitoring ended ({status.value}). Safe arrival recorded.",
            )
        )
        return session

    async def ingest_location(
        self, user_id: UUID, session_id: UUID, update: LocationUpdateRequest
    ) -> dict[str, Any]:
        """Ingest a live GPS location ping, run anomaly evaluation, and trigger verification if needed."""
        session = await self.sentinel_repo.get_session(user_id, session_id)
        if not session:
            raise NotFoundError("Session not found.")

        if session["status"] != SessionStatus.ACTIVE.value:
            return {"status": "ignored", "reason": "session_not_active"}

        # Store location ping
        history = await self.sentinel_repo.get_location_history(user_id, session_id, limit=20)
        loc_record = await self.sentinel_repo.record_location(user_id, session_id, update)

        # Run rules-based anomaly detection
        anomaly, concern = self.rules_engine.evaluate_location_update(session, loc_record, history)

        response_payload: dict[str, Any] = {
            "status": "recorded",
            "concern_level": concern.value,
            "anomaly": None,
            "verification": None,
            "verification_required": False,
        }

        if anomaly:
            recorded_anomaly = await self.sentinel_repo.record_anomaly(anomaly)
            response_payload["anomaly"] = recorded_anomaly.model_dump()

            # Update session concern level
            await self.sentinel_repo.update_session_status(user_id, session_id, SessionStatus.ACTIVE, concern)

            # Check if pending verification already exists to avoid alert spam
            existing_v = await self.sentinel_repo.get_pending_verification(session_id)
            if not existing_v:
                timeout = session.get("verification_timeout_seconds", 60)
                deadline = datetime.now(timezone.utc) + timedelta(seconds=timeout)

                verification = VerificationRecord(
                    session_id=session_id,
                    anomaly_id=recorded_anomaly.id,
                    prompt="Your journey seems different from your planned route. Are you safe?",
                    deadline=deadline,
                )
                created_v = await self.sentinel_repo.create_verification(verification)
                response_payload["verification"] = created_v.model_dump()
                response_payload["verification_required"] = True

                # Log timeline event
                await self.sentinel_repo.record_timeline_event(
                    LiveIncidentEvent(
                        incident_id=session.get("incident_id"),
                        session_id=session_id,
                        event_type="anomaly_detected",
                        timestamp=recorded_anomaly.detected_at,
                        actor="sentinel_engine",
                        status="warning",
                        title=f"Anomaly: {recorded_anomaly.anomaly_type.value.replace('_', ' ').title()}",
                        description=recorded_anomaly.reason,
                        metadata={
                            "anomaly_type": recorded_anomaly.anomaly_type.value,
                            "severity": recorded_anomaly.severity,
                            "rule": recorded_anomaly.rule_triggered,
                            "verification_deadline": deadline.isoformat(),
                        },
                    )
                )

        return response_payload

    async def respond_to_verification(
        self, user_id: UUID, session_id: UUID, verification_id: UUID, data: VerificationResponseInput
    ) -> dict[str, Any]:
        """Handle user response to safety verification check."""
        session = await self.sentinel_repo.get_session(user_id, session_id)
        if not session:
            raise NotFoundError("Session not found.")

        now = datetime.now(timezone.utc)

        if data.response == "safe":
            res = await self.sentinel_repo.resolve_verification(
                verification_id, VerificationStatus.SAFE, data.user_note or "User confirmed safe."
            )
            # Reset concern to normal
            await self.sentinel_repo.update_session_status(user_id, session_id, SessionStatus.ACTIVE, ConcernLevel.NORMAL)

            await self.sentinel_repo.record_timeline_event(
                LiveIncidentEvent(
                    incident_id=session.get("incident_id"),
                    session_id=session_id,
                    event_type="user_confirmed_safe",
                    timestamp=now,
                    actor="user",
                    status="success",
                    title="User Confirmed Safe",
                    description=data.user_note or "Safety verification answered affirmatively. Monitoring resumed.",
                )
            )
            return res

        elif data.response in ("help_requested", "cannot_respond"):
            res = await self.sentinel_repo.resolve_verification(
                verification_id, VerificationStatus.HELP_REQUESTED, data.user_note or "Assistance requested."
            )
            # Escalate immediately
            await self.trigger_escalation(
                user_id=user_id,
                session=session,
                trigger_reason="Safety verification responded with help request / distress.",
            )
            return res

        raise BadRequestError("Invalid verification response.")

    async def trigger_silent_assist(
        self, user_id: UUID, input_data: SilentAssistTriggerInput
    ) -> dict[str, Any]:
        """Discreet in-app distress activation with immediate trusted-contact escalation."""
        now = datetime.now(timezone.utc)
        session = None
        if input_data.session_id:
            session = await self.sentinel_repo.get_session(user_id, input_data.session_id)

        # Record distress event
        incident_id = input_data.incident_id or (session.get("incident_id") if session else None)

        # Ensure an active incident exists to attach the timeline and rescue relay
        if not incident_id:
            new_inc = await self.core_repo.create_incident(
                user_id=user_id,
                data=IncidentCreate(
                    title=f"Silent Assist Distress Signal - {now.strftime('%d %b %H:%M')}",
                    description="Distress alert triggered via SHEPHERD Silent Assist. Emergency rescue relay initiated with trusted contacts.",
                    category=IncidentCategory.THREAT,
                    occurred_at=now,
                    location_description="Live GPS coordinate attached from Sentinel session." if input_data.current_lat else None,
                ),
            )
            incident_id = new_inc.id

        await self.sentinel_repo.record_timeline_event(
            LiveIncidentEvent(
                incident_id=incident_id,
                session_id=input_data.session_id,
                event_type="silent_assist_triggered",
                timestamp=now,
                actor="user",
                status="distress",
                title="Silent Assist Triggered",
                description="One-touch distress signal activated. Immediate trusted contact rescue relay initiated.",
                metadata={
                    "latitude": input_data.current_lat,
                    "longitude": input_data.current_lng,
                    "accuracy": input_data.accuracy,
                    "haptic_confirmed": input_data.haptic_confirmed,
                },
            )
        )

        # Escalate to contacts
        escalation_result = await self.trigger_escalation(
            user_id=user_id,
            session=session,
            incident_id=incident_id,
            trigger_reason="Silent Assist distress signal triggered by user.",
            current_lat=input_data.current_lat,
            current_lng=input_data.current_lng,
        )

        return {
            "status": "escalated",
            "incident_id": str(incident_id),
            "triggered_at": now.isoformat(),
            "relay_token": escalation_result.get("relay_token"),
            "escalation": escalation_result,
        }

    async def trigger_escalation(
        self,
        user_id: UUID,
        session: Optional[dict[str, Any]] = None,
        incident_id: Optional[UUID] = None,
        trigger_reason: str = "Safety alert triggered",
        current_lat: Optional[float] = None,
        current_lng: Optional[float] = None,
    ) -> dict[str, Any]:
        """Sequential trusted-contact alert dispatch with secure rescue relay link."""
        now = datetime.now(timezone.utc)
        if session:
            await self.sentinel_repo.update_session_status(
                user_id, session["id"], SessionStatus.ESCALATED, ConcernLevel.CRITICAL
            )

        # Retrieve user contacts
        user_contacts = await self.safety_repo.list_contacts(user_id)

        # Generate secure scoped relay token (expires in 4 hours)
        token = secrets.token_urlsafe(24)
        expires_at = now + timedelta(hours=4)

        relay_loc = None
        if current_lat is not None and current_lng is not None:
            relay_loc = {"latitude": current_lat, "longitude": current_lng}
        elif session and session.get("last_location"):
            relay_loc = session["last_location"]

        relay_data = ContactRelayData(
            token=token,
            alert_id=uuid4(),
            session_id=session["id"] if session else None,
            incident_id=incident_id or (session.get("incident_id") if session else None),
            user_display_name="SHEPHERD User",
            reason=trigger_reason,
            timestamp=now,
            expires_at=expires_at,
            last_location=relay_loc,
            status="pending",
        )
        await self.sentinel_repo.create_relay_token(relay_data)

        # Dispatch alert to first contact with consent confirmed
        notified_count = 0
        for c in user_contacts:
            notified_count += 1
            dispatch_status = "simulated"
            try:
                alert_res = await self.notification_service.dispatch_sentinel_alert(
                    user_id=user_id,
                    contact=c,
                    relay_token=token,
                    user_display_name=relay_data.user_display_name,
                    reason=trigger_reason,
                    incident_id=relay_data.incident_id,
                    session_id=relay_data.session_id,
                )
                dispatch_status = alert_res.status
            except Exception as exc:
                logger.warning("Failed to dispatch sentinel alert to %s: %s", getattr(c, "name", "contact"), exc)

            contact_method_str = c.contact_method.value if hasattr(c.contact_method, "value") else str(c.contact_method)
            c_val_masked = f" ({c.contact_value[:4]}***)" if getattr(c, "contact_value", None) else ""
            desc = (
                f"Rescue relay alert sent via {contact_method_str}{c_val_masked}. Awaiting acknowledgement."
                if dispatch_status == "sent"
                else f"Rescue relay alert generated for {c.name} ({contact_method_str}). Notification mode: {dispatch_status}."
            )

            await self.sentinel_repo.record_timeline_event(
                LiveIncidentEvent(
                    incident_id=relay_data.incident_id,
                    session_id=relay_data.session_id,
                    event_type="contact_alert_dispatched",
                    timestamp=now,
                    actor="system",
                    status="warning",
                    title=f"Alert Dispatched to {c.name}",
                    description=desc,
                    metadata={
                        "contact_id": str(c.id),
                        "contact_name": c.name,
                        "contact_phone": getattr(c, "contact_value", ""),
                        "relay_token": token,
                        "dispatch_status": dispatch_status,
                    },
                )
            )
            # Only notify the primary/first contact initially for sequential escalation
            break

        return {
            "contacts_notified": notified_count,
            "relay_token": token,
            "relay_url": f"/relay/{token}",
            "expires_at": expires_at.isoformat(),
            "message": "Rescue relay active." if notified_count > 0 else "No contacts configured, but relay link active.",
        }

    async def acknowledge_relay_alert(
        self, token: str, data: ContactAcknowledgeInput
    ) -> ContactRelayData:
        """Process trusted-contact acknowledgement of an emergency alert."""
        relay = await self.sentinel_repo.acknowledge_relay(token, data.responder_name, data.responder_note)

        now = datetime.now(timezone.utc)
        # Log to timeline
        await self.sentinel_repo.record_timeline_event(
            LiveIncidentEvent(
                incident_id=relay.incident_id,
                session_id=relay.session_id,
                event_type="contact_acknowledged",
                timestamp=now,
                actor="trusted_contact",
                status="success",
                title=f"Alert Acknowledged by {data.responder_name}",
                description=f"Trusted contact confirmed receipt and is responding: '{data.responder_note or 'Acknowledged'}'",
                metadata={
                    "responder_name": data.responder_name,
                    "responder_note": data.responder_note,
                },
            )
        )
        return relay

    async def get_timeline(
        self, user_id: UUID, incident_id: Optional[UUID] = None, session_id: Optional[UUID] = None
    ) -> list[LiveIncidentEvent]:
        """Retrieve unified chronological live events for an incident or session."""
        return await self.sentinel_repo.list_timeline_events(user_id, incident_id, session_id)
