import re
from typing import List, Dict

from ..schemas.classify import ClassificationResult

# Helper: simple pattern collections for each category (synthetic, contextual)
PATTERNS = {
    "cyberstalking": [
        r"stalk(?:ing)?\s+online",
        r"monitor(?:ing)?\s+my\s+social\s+media",
        r"repeat(?:ed)?\s+emails?\s+threatening",
    ],
    "threat": [
        r"threaten(?:s|ed)?\s+.*\bkill\b",
        r"violent\s+action\b",
    ],
    "sextortion": [
        r"blackmail\s+with\s+explicit\s+photos",
        r"demand\s+payment\s+to\s+not\s+share",
    ],
    "impersonation": [
        r"pretend\s+to\s+be\s+me",
        r"using\s+my\s+identity",
    ],
    "doxxing": [
        r"share\s+my\s+personal\s+information",
        r"publish\s+address\s+phone",
    ],
    "image_based_abuse": [
        r"non\-consensual\s+image",
        r"deepfake",
    ],
    "general_harassment": [
        r"unwanted\s+contact",
        r"harassing\s+messages",
        r"abusive\s+language",
    ],
}

# Contextual rule: count matches, ensure they appear in a meaningful sentence
def _match_category(text: str, category: str) -> List[Dict[str, str]]:
    indicators = []
    for pattern in PATTERNS.get(category, []):
        for m in re.finditer(pattern, text, flags=re.IGNORECASE):
            # Basic contextual check: ensure at least 3 words around the match
            start, end = m.span()
            snippet = text[max(0, start - 30):min(len(text), end + 30)].strip()
            if len(snippet.split()) >= 3:
                indicators.append({
                    "name": category,
                    "description": f"Matched pattern '{pattern}' in context: '{snippet}'"
                })
    return indicators


def classify_text(text: str) -> ClassificationResult:
    """Deterministic rule‑based classifier.

    Returns a ``ClassificationResult`` (the shared response model).
    The heuristic confidence is the ratio of matched indicators to the total number
    of patterns for the winning category, capped between 0 and 1.
    """
    # Normalise text
    lowered = text.lower()
    best_category = "other"
    best_indicators: List[Dict[str, str]] = []
    best_score = 0.0

    for category, patterns in PATTERNS.items():
        inds = _match_category(lowered, category)
        if not inds:
            continue
        # Heuristic confidence: matched patterns / total patterns for this category
        confidence = min(1.0, len(inds) / len(patterns))
        if confidence > best_score:
            best_score = confidence
            best_category = category
            best_indicators = inds

    # If nothing matched, fall back to ``other`` with zero confidence
    if best_category == "other":
        explanation = "No rule‑based indicators matched; classification set to 'other'."
        confidence = 0.0
        indicators = []
    else:
        explanation = f"Detected evidence for category '{best_category}' via rule‑based matching."
        confidence = best_score
        indicators = best_indicators

    return ClassificationResult(
        label=best_category,
        confidence=confidence,
        explanation=explanation,
        indicators=indicators,
    )
