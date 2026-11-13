"""Notification dispatch providers with simulated mock defaults."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
import logging
from typing import Optional

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

    Never claims external delivery occurred. Always logs sanitized status.
    """

    async def dispatch(
        self,
        channel: AlertChannel,
        recipient: str,
        subject: str,
        body: str,
        message_type: str,
    ) -> NotificationResult:
        # Sanitize recipient for logging (mask email or phone)
        masked = recipient[:3] + "***" if len(recipient) > 3 else "***"
        logger.info(
            "[SIMULATED NOTIFICATION] Event: %s | Channel: %s | Recipient: %s | Note: No external transmission performed.",
            message_type,
            channel,
            masked,
        )
        return NotificationResult(
            status="simulated",
            provider_reference=f"demo-simulated-{channel}-{message_type}",
            error_message=None,
        )


def get_notification_provider(settings: Settings) -> BaseNotificationProvider:
    """Return configured notification provider.

    Defaults to safe MockNotificationProvider in hackathon/demo environments.
    """
    return MockNotificationProvider()
