from pydantic import BaseModel, Field
from typing import Literal
from .classify import ClassificationResult

class ClassifyResponse(BaseModel):
    label: str = Field(..., description="Taxonomy label")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Heuristic confidence (0‑1)")
    confidence_type: Literal["model_score_not_calibrated_probability"] = Field("model_score_not_calibrated_probability", description="Confidence type identifier")
    explanation: str = Field(..., description="Explanation of the classification")
    indicators: list = Field(default_factory=list, description="List of matched indicators")

    @classmethod
    def from_classification(cls, classification: ClassificationResult):
        return cls(
            label=classification.label,
            confidence=classification.confidence,
            explanation=classification.explanation,
            indicators=classification.indicators,
        )
