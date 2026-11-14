import base64
import logging
from typing import Any
from uuid import UUID

import httpx

from app.core.config import Settings, get_settings
from app.core.exceptions import ServiceUnavailableError, UpstreamServiceError

logger = logging.getLogger(__name__)


class IntelligenceClient:
    """Server-to-server HTTP client for communicating with the Member 3 Intelligence API."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.base_url = self.settings.ai_service_url.rstrip("/")
        self.token = self.settings.ai_service_token
        self.timeout = self.settings.ai_service_timeout_seconds

    def _get_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def analyze_incident(
        self,
        incident_id: UUID,
        description: str,
        evidence_items: list[dict[str, Any]],  # list of {evidence_id, mime_type, bytes}
    ) -> dict[str, Any]:
        """Send incident description and evidence to Member 3 Intelligence API /api/v1/analyze."""
        prepared_evidence = []
        for item in evidence_items:
            content_b64 = base64.b64encode(item["bytes"]).decode("ascii")
            prepared_evidence.append({
                "evidence_id": str(item["evidence_id"]),
                "mime_type": item["mime_type"],
                "content_base64": content_b64,
            })

        payload = {
            "incident_id": str(incident_id),
            "description": description,
            "evidence": prepared_evidence,
        }

        url = f"{self.base_url}/api/v1/analyze"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, json=payload, headers=self._get_headers())
        except httpx.ConnectError as exc:
            logger.warning("Intelligence API connection refused at %s: %s", url, exc)
            raise ServiceUnavailableError("Intelligence API service is currently unreachable.") from exc
        except httpx.TimeoutException as exc:
            logger.warning("Intelligence API timed out after %s seconds: %s", self.timeout, exc)
            raise ServiceUnavailableError("Intelligence API request timed out.") from exc
        except httpx.RequestError as exc:
            logger.warning("Intelligence API network error: %s", exc)
            raise ServiceUnavailableError(f"Network error contacting Intelligence API: {exc}") from exc

        if resp.status_code >= 500:
            logger.error("Intelligence API server error %s: %s", resp.status_code, resp.text)
            raise UpstreamServiceError("Intelligence API returned a server error.")
        if resp.status_code >= 400:
            logger.error("Intelligence API client error %s: %s", resp.status_code, resp.text)
            raise UpstreamServiceError(f"Intelligence API rejected request: {resp.text}")

        data = resp.json()
        if not isinstance(data, dict) or "classification" not in data:
            raise UpstreamServiceError("Intelligence API returned an invalid response schema.")

        return data

    async def get_graph(self, incident_id: UUID) -> dict[str, Any] | None:
        """Call Intelligence API /api/v1/graph/{incident_id} if available."""
        url = f"{self.base_url}/api/v1/graph/{incident_id}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, headers=self._get_headers())
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and "nodes" in data and "edges" in data:
                        return data
        except Exception as exc:
            logger.info("Intelligence API graph query unavailable (%s), falling back to repository graph.", exc)
        return None
