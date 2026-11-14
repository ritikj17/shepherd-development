"""Notification dispatch providers with live SMS integrations (Twilio, Fast2SMS) and mock defaults."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
import logging
from typing import Optional

import httpx

from app.core.config import Settings
from app.notifications.models import AlertChannel, AlertStatus

logger = logging.getLogger("shepherd.notifications")


@dataclass
class NotificationResult:
    status: AlertStatus
    provider_reference: Optional[str] = None
    error_message: Optional[str] = None


class BaseNotificationProvider(ABC):
    @abstractmethod
    async def dispatch(
        self,
        channel: AlertChannel,
        recipient: str,
        subject: str,
        body: str,
        message_type: str,
    ) -> NotificationResult:
        pass


class MockNotificationProvider(BaseNotificationProvider):
    """Safe, non-intrusive mock notification provider for testing and demos.

    Used when external carrier gateway credentials (Twilio or Fast2SMS) are absent.
    """

    async def dispatch(
        self,
        channel: AlertChannel,
        recipient: str,
        subject: str,
        body: str,
        message_type: str,
    ) -> NotificationResult:
        masked = recipient[:3] + "***" if len(recipient) > 3 else "***"
        logger.info(
            "[SIMULATED NOTIFICATION] Event: %s | Channel: %s | Recipient: %s | "
            "Note: Simulated delivery. To send real carrier SMS to Shrey's phone, "
            "configure TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN or FAST2SMS_API_KEY in .env.",
            message_type,
            channel,
            masked,
        )
        return NotificationResult(
            status="simulated",
            provider_reference=f"simulated-{channel}-{message_type}",
            error_message="Simulated mode active: No external SMS provider credentials configured in .env.",
        )


class TwilioNotificationProvider(BaseNotificationProvider):
    """Transmits real SMS via Twilio REST API."""

    def __init__(self, account_sid: str, auth_token: str, from_number: str) -> None:
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number

    async def dispatch(
        self,
        channel: AlertChannel,
        recipient: str,
        subject: str,
        body: str,
        message_type: str,
    ) -> NotificationResult:
        if channel != "sms":
            return NotificationResult(
                status="failed",
                error_message=f"Twilio provider only supports SMS channels, requested: {channel}",
            )

        # Standardize phone number format (+country code)
        phone = recipient.strip()
        if not phone.startswith("+"):
            phone = f"+91{phone}" if len(phone) == 10 else f"+{phone}"

        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        data = {
            "To": phone,
            "From": self.from_number,
            "Body": body,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, data=data, auth=(self.account_sid, self.auth_token))
                if res.status_code in (200, 201):
                    json_data = res.json()
                    msg_sid = json_data.get("sid", "twilio-ok")
                    logger.info("Twilio SMS dispatched successfully. SID: %s", msg_sid)
                    return NotificationResult(status="sent", provider_reference=msg_sid)
                else:
                    err_msg = f"Twilio HTTP {res.status_code}: {res.text}"
                    logger.error("Twilio SMS dispatch failed: %s", err_msg)
                    return NotificationResult(status="failed", error_message=err_msg)
        except Exception as exc:
            logger.error("Exception during Twilio dispatch: %s", exc)
            return NotificationResult(status="failed", error_message=str(exc))


class Fast2SMSNotificationProvider(BaseNotificationProvider):
    """Transmits real SMS in India via Fast2SMS Quick SMS API."""

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def dispatch(
        self,
        channel: AlertChannel,
        recipient: str,
        subject: str,
        body: str,
        message_type: str,
    ) -> NotificationResult:
        if channel != "sms":
            return NotificationResult(
                status="failed",
                error_message=f"Fast2SMS only supports SMS channels, requested: {channel}",
            )

        # Strip non-digit characters for Fast2SMS (10 digit mobile numbers)
        digits = "".join(filter(str.isdigit, recipient))
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]

        url = "https://www.fast2sms.com/dev/bulkV2"
        headers = {
            "authorization": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "route": "q",
            "message": body,
            "language": "english",
            "numbers": digits,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("return"):
                        ref = str(data.get("request_id", "fast2sms-ok"))
                        logger.info("Fast2SMS message dispatched successfully. Request ID: %s", ref)
                        return NotificationResult(status="sent", provider_reference=ref)
                    else:
                        err_msg = str(data.get("message", "Fast2SMS rejected request"))
                        logger.error("Fast2SMS error: %s", err_msg)
                        return NotificationResult(status="failed", error_message=err_msg)
                else:
                    err_msg = f"Fast2SMS HTTP {res.status_code}: {res.text}"
                    return NotificationResult(status="failed", error_message=err_msg)
        except Exception as exc:
            logger.error("Exception during Fast2SMS dispatch: %s", exc)
            return NotificationResult(status="failed", error_message=str(exc))


def get_notification_provider(settings: Settings) -> BaseNotificationProvider:
    """Return configured notification provider based on environment credentials."""
    if settings.twilio_account_sid and settings.twilio_auth_token:
        logger.info("Initializing Twilio SMS notification provider.")
        return TwilioNotificationProvider(
            account_sid=settings.twilio_account_sid,
            auth_token=settings.twilio_auth_token,
            from_number=settings.twilio_from_number or "SHEPHERD",
        )

    if settings.fast2sms_api_key:
        logger.info("Initializing Fast2SMS notification provider.")
        return Fast2SMSNotificationProvider(api_key=settings.fast2sms_api_key)

    return MockNotificationProvider()
