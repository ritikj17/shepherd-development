from pydantic import BaseModel, Field
from typing import List, Dict, Literal

class ClassificationResult(BaseModel):
    label: str = Field(..., description="Taxonomy label")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Heuristic confidence (0‑1)")
    confidence_type: Literal["model_score_not_calibrated_probability"] = Field("model_score_not_calibrated_probability", description="Confidence type identifier")
    explanation: str = Field(..., description="Human‑readable explanation of the classification")
    indicators: List[Dict[str, str]] = Field(default_factory=list, description="Matched indicators with name and description")
