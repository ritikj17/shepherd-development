import os
import base64
import json
from typing import List, Optional
from fastapi import Depends, HTTPException, Header, APIRouter
from ...core.config import Settings
from ...auth.verifier import get_current_user
from ...core.intelligence_client import intelligence_analyze, intelligence_graph

import httpx

router = APIRouter()
settings = Settings()

@router.post("/incidents/{incident_id}/analysis", response_model=dict)
async def analyze_incident(
    incident_id: str,
    include_description: bool = True,
    evidence_ids: Optional[List[str]] = None,
    current_user: dict = Depends(get_current_user),
    token: str = Depends(lambda: None),  # placeholder, not used here
):
    """Perform threat analysis for an incident.
    Steps:
    1. Verify incident ownership.
    2. Retrieve evidence (or specific evidence_ids).
    3. Retrieve related incidents via incident_links.
    4. Build AnalyzeRequest and call Intelligence.
    5. Persist analysis.
    """
    user_id = current_user["user_id"]

    # 1. Verify ownership
    async with httpx.AsyncClient() as client:
        incident_resp = await client.get(
            f"{settings.SUPABASE_URL}/incidents",
            params={"incident_id": f"eq.{incident_id}", "owner_id": f"eq.{user_id}"},
            headers={"apikey": settings.SUPABASE_SERVICE_ROLE_KEY},
        )
    if incident_resp.status_code != 200:
        raise HTTPException(status_code=500, detail={"error": {"code": "SUPABASE_ERROR", "message": "Failed to fetch incident", "details": {}}})
    incidents = incident_resp.json()
    if not incidents:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Incident not found or not owned", "details": {}}})
    incident = incidents[0]

    # 2. Retrieve evidence
    async with httpx.AsyncClient() as client:
        ev_params = {"incident_id": f"eq.{incident_id}"}
        if evidence_ids:
            ev_params["evidence_id"] = f"in.({','.join(evidence_ids)})"
        ev_resp = await client.get(
            f"{settings.SUPABASE_URL}/evidence",
            params=ev_params,
            headers={"apikey": settings.SUPABASE_SERVICE_ROLE_KEY},
        )
    if ev_resp.status_code != 200:
        raise HTTPException(status_code=500, detail={"error": {"code": "SUPABASE_ERROR", "message": "Failed to fetch evidence", "details": {}}})
    evidence_items = ev_resp.json()
    if not evidence_items:
        raise HTTPException(status_code=400, detail={"error": {"code": "VALIDATION_ERROR", "message": "No evidence provided", "details": {}}})
    # Build evidence list for Intelligence
    from services.intelligence.app.schemas.analyze import EvidenceItem, AnalyzeRequest, RelatedIncident
    intel_evidence = []
    for ev in evidence_items:
        content = ev.get("content_base64")
        if not content:
            # In real scenario we'd pull from storage; here assume stored Base64 is present
            raise HTTPException(status_code=500, detail={"error": {"code": "CONFIG_ERROR", "message": "Missing evidence content", "details": {}}})
        intel_evidence.append(EvidenceItem(
            evidence_id=ev["evidence_id"],
            mime_type=ev["mime_type"],
            content_base64=content,
        ))

    # 3. Retrieve related incidents via incident_links
    async with httpx.AsyncClient() as client:
        links_resp = await client.get(
            f"{settings.SUPABASE_URL}/incident_links",
            params={"source_incident_id": f"eq.{incident_id}"},
            headers={"apikey": settings.SUPABASE_SERVICE_ROLE_KEY},
        )
    related = []
    if links_resp.status_code == 200:
        links = links_resp.json()
        target_ids = [ln["target_incident_id"] for ln in links]
        if target_ids:
            # fetch target incidents
            inc_resp = await client.get(
                f"{settings.SUPABASE_URL}/incidents",
                params={"incident_id": f"in.({','.join(target_ids)})"},
                headers={"apikey": settings.SUPABASE_SERVICE_ROLE_KEY},
            )
            if inc_resp.status_code == 200:
                for inc in inc_resp.json():
                    related.append(RelatedIncident(
                        incident_id=inc["incident_id"],
                        type=inc.get("category", ""),
                        severity=inc.get("severity", ""),
                        timestamp=inc.get("occurred_at"),
                        location=inc.get("location_description"),
                        status=inc.get("status"),
                    ))

    # 4. Build request and call Intelligence
    analyse_req = AnalyzeRequest(
        incident_id=incident_id,
        description=incident.get("description") if include_description else None,
        evidence=intel_evidence,
        related_incidents=related or None,
    )
    intel_resp = await intelligence_analyze(analyse_req, token=settings.AI_SERVICE_TOKEN)

    # 5. Persist analysis
    async with httpx.AsyncClient() as client:
        persist_resp = await client.post(
            f"{settings.SUPABASE_URL}/threat_analyses",
            json=intel_resp,
            headers={"apikey": settings.SUPABASE_SERVICE_ROLE_KEY},
        )
    if persist_resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail={"error": {"code": "PERSIST_ERROR", "message": "Failed to store analysis", "details": {}}})

    return intel_resp

@router.get("/graph/{incident_id}", response_model=dict)
async def get_graph(incident_id: str, current_user: dict = Depends(get_current_user), token: str = Depends(lambda: None)):
    user_id = current_user["user_id"]
    # Verify ownership similar to above
    async with httpx.AsyncClient() as client:
        inc_resp = await client.get(
            f"{settings.SUPABASE_URL}/incidents",
            params={"incident_id": f"eq.{incident_id}", "owner_id": f"eq.{user_id}"},
            headers={"apikey": settings.SUPABASE_SERVICE_ROLE_KEY},
        )
    if inc_resp.status_code != 200 or not inc_resp.json():
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Incident not found", "details": {}}})
    intel_resp = await intelligence_graph(incident_id, token=settings.AI_SERVICE_TOKEN)
    return intel_resp
