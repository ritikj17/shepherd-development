import os
from typing import List, Dict, Any

# Helper to safely extract searchable text from an indicator
def _indicator_text(indicator: Any) -> str:
    """Extract searchable text from an indicator whether dict, str, or malformed."""
    if isinstance(indicator, dict):
        name = str(indicator.get("name") or "")
        desc = str(indicator.get("description") or "")
        return f"{name} {desc}".lower()
    if isinstance(indicator, str):
        return indicator.lower()
    return str(indicator).lower() if indicator is not None else ""


# Helper to create factor dicts
def _factor(name: str, value: int | None, explanation: str, available: bool) -> Dict[str, Any]:
    # The API contract expects an integer value. When unavailable we set 0 but note it.
    return {
        "name": name,
        "value": value if value is not None else 0,
        "explanation": explanation + (" (unavailable)" if not available else "")
    }

# Threat severity mapping – only used when we have explicit threat indicators
THREAT_SEVERITY_MAP = {
    "threat": 80,
    "cyberstalking": 70,
    "sextortion": 85,
    "impersonation": 60,
    "doxxing": 75,
    "image_based_abuse": 65,
    "general_harassment": 40,
    "other": 0,
}

# Digital exposure relevance – only when classification indicates exposure‑type categories
DIGITAL_EXPOSURE_CATEGORIES = {"doxxing", "impersonation", "image_based_abuse"}

def compute_risk(description: str | None,
                evidence: List[Dict[str, Any]],
                ocr_results: List[Dict[str, Any]],
                classification: Any) -> Dict[str, Any]:
    """Compute the review‑priority risk score according to the *strict* methodology.

    Only factors that can be grounded in the data supplied to the Intelligence API are considered.
    If any required factor is unavailable, the overall risk level is set to ``insufficient_data``
    and the score is ``0``. The response schema remains contract‑compatible.
    """
    # ----- T: Threat Severity ---------------------------------------
    # Require explicit threat evidence in classification indicators.
    explicit_threat_keywords = [
        "threat",
        "intimidate",
        "harm",
        "violent",
        "attack",
        "kill",
        "danger",
    ]
    t_available = False
    t_value = None
    t_expl = "Threat severity derived from classification label and explicit threat indicators."
    if classification.label in THREAT_SEVERITY_MAP and classification.indicators:
        matched_threat = False
        for ind in classification.indicators:
            text = _indicator_text(ind)
            if any(kw in text for kw in explicit_threat_keywords):
                matched_threat = True
                break
        if matched_threat:
            t_value = THREAT_SEVERITY_MAP[classification.label]
            t_available = True
        else:
            t_expl = "No explicit threat evidence found in classification indicators. (unavailable)"
    else:
        t_expl = "Insufficient threat indicators to assess severity. (unavailable)"

    # ----- F: Frequency / Recurrence -------------------------------
    # No recurrence context is supplied by the Intelligence API. Mark unavailable.
    f_available = False
    f_value = None
    f_expl = "Recurrence cannot be determined without historic incident data."

    # ----- E: Evidence Strength ------------------------------------
    # OCR success does NOT indicate evidence strength. Mark unavailable.
    e_available = False
    e_value = None
    e_expl = "Evidence strength cannot be inferred without authenticity metrics."

    # ----- D: Digital Exposure -------------------------------------
    # Digital exposure requires explicit evidence in the description or OCR text.
    d_available = False
    d_value = None
    d_expl = "Digital exposure requires explicit evidence (e.g., personal data identifiers) in description or OCR results."

    # Simple keyword search for exposure indicators in description and OCR extracted text.
    exposure_keywords = ["address", "phone", "email", "id number", "social security", "ssn", "personal data", "contact info"]
    exposure_context_verbs = ["posted", "shared", "published", "leaked", "disclosed", "exposed", "made public", "released"]
    combined_text = (description or "").lower()
    for ocr in ocr_results:
        txt = ocr.get("extracted_text", "")
        combined_text += " " + txt.lower()
    if any(keyword in combined_text for keyword in exposure_keywords):
        if any(verb in combined_text for verb in exposure_context_verbs):
            d_expl = (
                "Digital exposure indicators detected (keywords + exposure verbs) "
                "but no scoring rubric is approved. (unavailable)"
            )
        else:
            d_expl = (
                "Digital exposure keywords found but no contextual evidence of exposure. (unavailable)"
            )
    else:
        d_expl = (
            "Digital exposure requires explicit evidence (e.g., personal data identifiers) "
            "in description or OCR results. (unavailable)"
        )

    # ----- P: Pattern / Context -----------------------------------
    # No cross‑incident context is provided. Mark unavailable.
    p_available = False
    p_value = None
    p_expl = "Pattern cannot be assessed without related incident context from Core API."

    # Determine if we have *all* factors available
    all_available = all([t_available, f_available, e_available, d_available, p_available])

    if all_available:
        # Compute weighted score (should not happen with current data limits)
        score = int(round(0.30 * t_value + 0.25 * f_value + 0.20 * e_value + 0.15 * d_value + 0.10 * p_value))
        # Determine level based on simple thresholds
        if score >= 80:
            level = "high"
        elif score >= 50:
            level = "moderate"
        elif score > 0:
            level = "low"
        else:
            level = "insufficient_data"
        explanation = f"Score {score} derived from all supported factors."
    else:
        # Insufficient data – cannot present a meaningful score.
        score = 0
        level = "insufficient_data"
        # Contract does not define scoring when some factors are unavailable.
        # Flag for Shrey's clarification before any partial‑score logic is added.
        explanation = "Unable to compute a reliable review‑priority score because one or more required factors are unavailable. Score calculation with partial data is pending clarification from Shrey."

    factors = [
        _factor("T", t_value, t_expl, t_available),
        _factor("F", f_value, f_expl, f_available),
        _factor("E", e_value, e_expl, e_available),
        _factor("D", d_value, d_expl, d_available),
        _factor("P", p_value, p_expl, p_available),
    ]

    return {
        "score": score,
        "level": level,
        "label": "review_priority",
        "factors": factors,
        "explanation": explanation,
    }
