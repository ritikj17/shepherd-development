from fastapi import APIRouter, HTTPException, Depends
from ..schemas.analyze import AnalyzeRequest
from ..schemas.analyze_response import AnalyzeResponse
from ..schemas.classify import ClassificationResult
from ..schemas.classify_request import ClassifyRequest
from ..schemas.classify_response import ClassifyResponse
from ..schemas.graph import GraphResponse
from ..ocr.ocr import perform_ocr
from ..classifiers.deterministic import classify_text
from ..graph.builder import build_incident_graph
from ..risk.compute import compute_risk
from ..dependencies import verify_service_token

router = APIRouter()

# All endpoints require server‑to‑server authentication
auth_dep = Depends(verify_service_token)

@router.get("/health", dependencies=[auth_dep])
async def health():
    return {"status": "ok", "service": "intelligence-api"}

@router.post("/analyze", response_model=AnalyzeResponse, dependencies=[auth_dep])
async def analyze(request: AnalyzeRequest):
    # Process OCR for each evidence item
    ocr_results = []
    for ev in request.evidence:
        try:
            ocr_res = perform_ocr(ev.mime_type, ev.content_base64)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "OCR_ERROR", "message": str(exc), "details": {}}}
            )
        ocr_results.append(ocr_res)
    # Concatenate all extracted text from successful OCRs
    combined_text = " ".join([r.get("extracted_text", "") for r in ocr_results if r.get("status") == "completed"])
    classification: ClassificationResult = classify_text(combined_text)
    # Compute risk factors based on description, OCR, classification, evidence count
    risk = compute_risk(request.description, request.evidence, ocr_results, classification)
    # Use first OCR result as contract‑required top‑level OCR field
    ocr_field = ocr_results[0] if ocr_results else {"status": "not_applicable"}
    return AnalyzeResponse(
        incident_id=request.incident_id,
        classification=classification,
        indicators=classification.indicators,
        ocr=ocr_field,
        risk=risk,
        limitations=[]
    )

@router.post("/classify-text", response_model=ClassifyResponse, dependencies=[auth_dep])
async def classify_endpoint(req: ClassifyRequest):
    result = classify_text(req.text)
    return ClassifyResponse(**result.dict())

@router.get("/graph/{incident_id}", response_model=GraphResponse, dependencies=[auth_dep])
async def get_graph(incident_id):
    # Core API will later supply authorized incident list; for now return empty graph
    graph = build_incident_graph([])
    return GraphResponse(incident_id=incident_id, nodes=graph["nodes"], edges=graph["edges"])
