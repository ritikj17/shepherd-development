from typing import List, Dict, Any, Optional

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
        "value": value if value is not None and available else 0,
        "explanation": explanation + (" (unavailable)" if not available else "")
    }

# Threat severity mapping – default baselines when explicit category indicators match
THREAT_SEVERITY_MAP = {
    "threat": 80,
    "cyberstalking": 75,
    "sextortion": 85,
    "impersonation": 60,
    "doxxing": 75,
    "image_based_abuse": 70,
    "general_harassment": 45,
    "other": 0,
}

WEIGHTS = {
    "T": 0.30,
    "F": 0.25,
    "E": 0.20,
    "D": 0.15,
    "P": 0.10,
}


def compute_risk(description: str | None,
                 evidence: List[Dict[str, Any]],
                 ocr_results: List[Dict[str, Any]],
                 classification: Any,
                 gemini_factors: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Compute the review‑priority risk score.

    Calculates scores across 5 core risk factors:
    - T: Threat Severity
    - F: Frequency / Recurrence
    - E: Evidence Strength
    - D: Digital Exposure
    - P: Pattern / Cross-channel Escalation

    When factors are grounded in Gemini analysis or incident/evidence data,
    a weighted composite review-priority score is produced.
    If no factors are available, returns insufficient_data.
    """
    gemini_factors = gemini_factors or {}

    combined_text = (description or "").lower()
    for ocr in ocr_results:
        txt = ocr.get("extracted_text", "")
        if txt:
            combined_text += " " + txt.lower()

    # ----- T: Threat Severity ---------------------------------------
    explicit_threat_keywords = [
        "threat", "intimidate", "harm", "violent", "attack",
        "kill", "danger", "stalk", "follow", "watch",
        "burner", "blackmail", "extort", "fear"
    ]
    t_available = False
    t_value = None
    t_expl = "Threat severity derived from classification label and indicators."

    g_t = gemini_factors.get("threat_severity")
    if g_t is not None and g_t > 0:
        t_value = int(g_t)
        t_available = True
        t_expl = f"Threat severity assessed at {t_value}/100 from model intelligence."
    elif getattr(classification, "label", None) in THREAT_SEVERITY_MAP and getattr(classification, "indicators", None):
        matched_threat = False
        for ind in classification.indicators:
            text = _indicator_text(ind)
            # Check for explicit threat keywords (whole word or clean match)
            if any(kw in text for kw in explicit_threat_keywords):
                matched_threat = True
                break
        if matched_threat:
            t_value = THREAT_SEVERITY_MAP[classification.label]
            t_available = True
            t_expl = f"Threat severity assessed at {t_value}/100 from explicit threat indicators."
        else:
            t_expl = "No explicit threat evidence found in classification indicators."
    else:
        t_expl = "Insufficient threat indicators to assess severity."

    # ----- F: Frequency / Recurrence -------------------------------
    f_available = False
    f_value = None
    f_expl = "Recurrence cannot be determined without historic incident data."

    g_f = gemini_factors.get("frequency")
    if g_f is not None and g_f > 0:
        f_value = int(g_f)
        f_available = True
        f_expl = f"Recurrence assessed at {f_value}/100 from reported temporal indicators."
    else:
        freq_keywords = [
            "repeated", "repeatedly", "daily", "every day", "past 10 days",
            "past few days", "multiple times", "several times", "regularly",
            "ongoing", "constant", "frequently", "again", "pattern"
        ]
        if any(kw in combined_text for kw in freq_keywords):
            f_value = 80 if any(kw in combined_text for kw in ["daily", "every day", "ongoing", "constant"]) else 65
            f_available = True
            f_expl = f"Recurrence assessed at {f_value}/100 based on temporal frequency indicators."

    # ----- E: Evidence Strength ------------------------------------
    e_available = False
    e_value = None
    e_expl = "Evidence strength cannot be inferred without authenticity metrics."

    g_e = gemini_factors.get("evidence_strength")
    if g_e is not None and g_e > 0:
        e_value = int(g_e)
        e_available = True
        e_expl = f"Evidence strength assessed at {e_value}/100 from corroborating artifacts."
    else:
        if evidence:
            e_value = min(95, 65 + len(evidence) * 15)
            e_available = True
            e_expl = f"Evidence strength assessed at {e_value}/100 from {len(evidence)} verified attachment(s)."
        elif any(ocr.get("status") == "completed" and ocr.get("extracted_text") for ocr in ocr_results):
            e_value = 80
            e_available = True
            e_expl = "Evidence strength assessed at 80/100 from transcribed OCR text."
        else:
            ev_terms = ["photo", "screenshot", "video", "recording", "direct message", "dm", "audio", "burner account"]
            if any(term in combined_text for term in ev_terms):
                e_value = 65
                e_available = True
                e_expl = "Evidence strength assessed at 65/100 from digital artifact references in report."

    # ----- D: Digital Exposure -------------------------------------
    d_available = False
    d_value = None
    d_expl = "Digital exposure requires explicit evidence in description or OCR results."

    g_d = gemini_factors.get("digital_exposure")
    if g_d is not None and g_d > 0:
        d_value = int(g_d)
        d_available = True
        d_expl = f"Digital exposure assessed at {d_value}/100 across digital channels."
    else:
        exposure_terms = [
            "instagram", "facebook", "twitter", "burner", "social media",
            "dm", "direct message", "photo", "profile", "online", "posted",
            "shared", "address", "phone", "email", "ssn", "personal data"
        ]
        exposure_context_verbs = ["posted", "shared", "published", "leaked", "disclosed", "exposed", "sent", "messaged"]
        if any(term in combined_text for term in exposure_terms) and any(v in combined_text for v in exposure_context_verbs):
            d_value = 70
            d_available = True
            d_expl = "Digital exposure indicators identified across digital channels and messages."

    # ----- P: Pattern / Context -----------------------------------
    p_available = False
    p_value = None
    p_expl = "Pattern cannot be assessed without related incident context from Core API."

    g_p = gemini_factors.get("pattern_escalation")
    if g_p is not None and g_p > 0:
        p_value = int(g_p)
        p_available = True
        p_expl = f"Pattern and escalation assessed at {p_value}/100."
    else:
        has_physical = any(w in combined_text for w in ["station", "street", "followed", "walk", "approached", "outside", "in person", "corner"])
        has_digital = any(w in combined_text for w in ["dm", "instagram", "burner", "message", "photo", "social media", "online"])
        if has_physical and has_digital:
            p_value = 80
            p_available = True
            p_expl = "Cross-channel pattern detected combining physical proximity and digital contact."
        elif any(w in combined_text for w in ["escalat", "worse", "intensif", "called out", "corner"]):
            p_value = 65
            p_available = True
            p_expl = "Escalation pattern identified from behavioral indicators."

    factors_data = [
        ("T", t_value, t_expl, t_available),
        ("F", f_value, f_expl, f_available),
        ("E", e_value, e_expl, e_available),
        ("D", d_value, d_expl, d_available),
        ("P", p_value, p_expl, p_available),
    ]

    active_factors = [(name, val, WEIGHTS[name]) for name, val, _, avail in factors_data if avail and val is not None]

    if active_factors:
        total_weight = sum(w for _, _, w in active_factors)
        score = int(round(sum(val * w for _, val, w in active_factors) / total_weight))
        score = max(0, min(100, score))
        if score >= 60:
            level = "high"
        elif score >= 30:
            level = "moderate"
        elif score > 0:
            level = "low"
        else:
            level = "insufficient_data"
        explanation = f"Review priority score {score}/100 computed from active factors ({', '.join(name for name, _, _ in active_factors)})."
    else:
        score = 0
        level = "insufficient_data"
        explanation = "Unable to compute a reliable review‑priority score because one or more required factors are unavailable. Score calculation with partial data is pending clarification from Shrey."

    factors = [
        _factor(name, val, expl, avail)
        for name, val, expl, avail in factors_data
    ]

    return {
        "score": score,
        "level": level,
        "label": "review_priority",
        "factors": factors,
        "explanation": explanation,
    }
