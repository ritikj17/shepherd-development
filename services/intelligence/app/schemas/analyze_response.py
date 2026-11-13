from pydantic import BaseModel, Field, UUID4
from typing import List, Optional
from ..schemas.ocr import OCRResult
from ..classifiers.deterministic import ClassificationResult

class AnalyzeResponse(BaseModel):
    incident_id: UUID4 = Field(..., description="Incident UUID")
    classification: ClassificationResult = Field(..., description="Classification result")
    indicators: List[dict] = Field(..., description="List of matched indicators")
    ocr: OCRResult = Field(..., description="OCR processing result for primary evidence")
    risk: dict = Field(..., description="Risk scoring object (placeholder)")
    limitations: List[str] = Field(..., description="Limitations messages")
