import os
import uuid
from typing import Any, Dict

import httpx
from fastapi import HTTPException

# Helper to write minimal request summary for debugging (no secrets).
def _write_debug_summary(data: Dict[str, Any]) -> None:
    try:
        # Write to a temporary file in the artifact directory.
        # The artifact directory path is available via the AGY environment variable if set.
        artifact_dir = os.getenv("AGY_ARTIFACT_DIR")
        if not artifact_dir:
            # Fallback to a generic temp path inside the repository.
            artifact_dir = os.path.join(os.getcwd(), "scratch")
        os.makedirs(artifact_dir, exist_ok=True)
        filename = os.path.join(artifact_dir, f"intelligence_request_{uuid.uuid4().hex[:8]}.json")
        # Do not include the AI token in the saved file.
        safe_data = {k: v for k, v in data.items() if k != "token"}
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(safe_data, f, indent=2)
    except Exception:
        # Silently ignore logging failures; they should not affect core functionality.
        pass

async def intelligence_analyze(request_obj: Any, token: str) -> Dict[str, Any]:
    """Send an analysis request to the Intelligence service.

    Parameters
    ----------
    request_obj: Any
        A pydantic model (AnalyzeRequest) instance that can be serialized to JSON.
    token: str
        AI service authentication token.

    Returns
    -------
    dict
        Parsed JSON response from the Intelligence service.
    """
    # Prepare payload
    payload = request_obj.dict() if hasattr(request_obj, "dict") else request_obj
    # Write a debug summary (excluding token) for sidecar visibility.
    _write_debug_summary({"endpoint": "analyze", "payload": payload})
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{os.getenv('INTELLIGENCE_URL', 'http://localhost:8000')}/analyze",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code != 200:
        # Propagate a flat error envelope expected by the Core API.
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "PROXY_ERROR",
                    "message": f"Intelligence service returned status {resp.status_code}",
                    "details": {},
                }
            },
        )
    return resp.json()

async def intelligence_graph(incident_id: str, token: str) -> Dict[str, Any]:
    """Request a graph for a given incident from the Intelligence service."""
    _write_debug_summary({"endpoint": "graph", "incident_id": incident_id})
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{os.getenv('INTELLIGENCE_URL', 'http://localhost:8000')}/graph/{incident_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "PROXY_ERROR",
                    "message": f"Intelligence graph endpoint returned status {resp.status_code}",
                    "details": {},
                }
            },
        )
    return resp.json()
