import os
import json
import logging
from typing import Optional, Tuple, Dict, Any, List
from pathlib import Path

import httpx

from ..schemas.classify import ClassificationResult

logger = logging.getLogger(__name__)

VALID_LABELS = {
    "cyberstalking",
    "threat",
    "sextortion",
    "impersonation",
    "doxxing",
    "image_based_abuse",
    "general_harassment",
    "other",
}

GEMINI_MODELS = [
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-pro-latest",
]


def get_gemini_api_key() -> Optional[str]:
    """Retrieve Gemini API key from environment or local .env file."""
    key = os.getenv("GEMINI_API_KEY")
    if key and key.strip():
        return key.strip().strip("\"'")

    candidates = [
        Path(__file__).resolve().parent.parent.parent / ".env",
        Path.cwd() / ".env",
        Path.cwd() / "services" / "intelligence" / ".env",
    ]
    for p in candidates:
        if p.is_file():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("GEMINI_API_KEY=") and not line.startswith("#"):
                            val = line.split("=", 1)[1].strip().strip("\"'")
                            if val:
                                return val
            except Exception:
                pass
    return None


def classify_with_gemini(text: str) -> Optional[Tuple[ClassificationResult, Dict[str, Any], List[str]]]:
    """Call Google Gemini to classify incident text into SHEPHERD taxonomy.

    Returns (ClassificationResult, risk_factors_dict, limitations_list) or None if unavailable.
    """
    key = get_gemini_api_key()
    if not key or not text.strip():
        return None

    prompt = f"""You are an expert safety intelligence classifier for SHEPHERD.
Analyze this safety incident text (which may include user-written descriptions and OCR extracted text).

Incident text:
\"\"\"{text.strip()}\"\"\"

Respond ONLY with valid JSON following this exact schema:
{{
  "label": "cyberstalking" | "threat" | "sextortion" | "impersonation" | "doxxing" | "image_based_abuse" | "general_harassment" | "other",
  "confidence": float between 0.0 and 1.0,
  "explanation": "concise, explainable reason for choosing this classification",
  "indicators": [
    {{
      "name": "short indicator name (e.g. repeated_physical_following, burner_account_outreach, private_photo_surveillance, implied_threat)",
      "description": "evidence-grounded explanation of what was observed"
    }}
  ],
  "risk_factors": {{
    "threat_severity": integer 0-100,
    "frequency": integer 0-100,
    "evidence_strength": integer 0-100,
    "digital_exposure": integer 0-100,
    "pattern_escalation": integer 0-100
  }},
  "limitations": [
    "AI-assisted classification is informational and should not be treated as a definitive legal verdict.",
    "Assessments reflect reported details and cannot verify uncorroborated statements."
  ],
  "mitigations": [
    "string recommendation 1",
    "string recommendation 2"
  ]
}}"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }

    for model in GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if resp.status_code == 200:
                    data = resp.json()
                    raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    parsed = json.loads(raw_text)

                    label = parsed.get("label", "other").lower().strip()
                    if label not in VALID_LABELS:
                        label = "other"

                    confidence = float(parsed.get("confidence", 0.85))
                    confidence = max(0.0, min(1.0, confidence))

                    explanation = parsed.get("explanation", f"Classified as {label} based on contextual indicators.")
                    indicators = parsed.get("indicators", [])
                    clean_indicators = []
                    for ind in indicators:
                        if isinstance(ind, dict) and "name" in ind and "description" in ind:
                            clean_indicators.append({
                                "name": str(ind["name"]),
                                "description": str(ind["description"])
                            })

                    risk_factors = parsed.get("risk_factors", {})
                    limitations = parsed.get("limitations", [
                        "AI-assisted classification is informational and should not be treated as a definitive legal verdict.",
                        "Assessments reflect reported details and cannot verify uncorroborated statements."
                    ])

                    result = ClassificationResult(
                        label=label,
                        confidence=confidence,
                        explanation=explanation,
                        indicators=clean_indicators,
                    )
                    return result, risk_factors, limitations
                elif resp.status_code in (404, 503):
                    # Try next model if deprecated or unavailable
                    continue
                else:
                    logger.warning("Gemini API error %s: %s", resp.status_code, resp.text)
                    break
        except Exception as exc:
            logger.warning("Failed Gemini call to %s: %s", model, exc)
            continue

    return None
