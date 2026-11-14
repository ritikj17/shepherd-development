import base64
import io
import logging
from typing import Dict, Optional

from PIL import Image, UnidentifiedImageError
import httpx

from ..classifiers.gemini_classifier import get_gemini_api_key, GEMINI_MODELS

logger = logging.getLogger(__name__)

# Supported mime types and Pillow format mapping
SUPPORTED_MIME_TYPES = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
}

# Maximum accepted image size (bytes). 5 MB limit.
MAX_IMAGE_SIZE = 5 * 1024 * 1024


def _gemini_vision_ocr(mime_type: str, content_base64: str) -> Optional[str]:
    """Fallback OCR using Google Gemini Vision API."""
    key = get_gemini_api_key()
    if not key:
        return None

    # Normalize mime type (jpg -> jpeg for Gemini inline_data)
    norm_mime = "image/jpeg" if mime_type == "image/jpg" else mime_type

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": (
                            "Extract all readable text from this evidence image accurately and verbatim. "
                            "Return only the extracted text. If the image contains no readable text, return nothing."
                        )
                    },
                    {
                        "inline_data": {
                            "mime_type": norm_mime,
                            "data": content_base64,
                        }
                    },
                ]
            }
        ]
    }

    for model in GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            return parts[0].get("text", "").strip()
                    return ""
                elif resp.status_code in (404, 503):
                    continue
                else:
                    logger.warning("Gemini Vision OCR returned %s: %s", resp.status_code, resp.text)
                    break
        except Exception as exc:
            logger.warning("Failed Gemini Vision call to %s: %s", model, exc)
            continue

    return None


def perform_ocr(mime_type: str, content_base64: str) -> Dict:
    """Run OCR on a base64‑encoded image.

    Returns a dict matching the API contract:
        {"status": "completed"|"failed"|"not_applicable",
         "extracted_text": "...",
         "text_available": bool}

    * If the mime type is unsupported → raises Exception.
    * If base64 content is invalid → raises Exception.
    * If the image exceeds the size limit → status ``failed``.
    * If Pillow cannot open the image → status ``failed``.
    * Attempts pytesseract first; if unavailable/failed, uses Gemini Vision.
    * On success, extracted text is returned and status is ``completed``.
    """
    # 1. Validate MIME type
    if mime_type not in SUPPORTED_MIME_TYPES:
        raise Exception("Unsupported MIME type")

    # 2. Decode Base64
    try:
        raw_bytes = base64.b64decode(content_base64)
    except Exception:
        raise Exception("Invalid base64 content")

    # 3. Enforce size limit
    if len(raw_bytes) > MAX_IMAGE_SIZE:
        return {"status": "failed", "text_available": False}

    # 4. Load image with Pillow
    try:
        image_stream = io.BytesIO(raw_bytes)
        img = Image.open(image_stream)
        # Verify format matches MIME (defensive)
        if img.format != SUPPORTED_MIME_TYPES[mime_type]:
            return {"status": "not_applicable", "text_available": False}
    except UnidentifiedImageError:
        return {"status": "failed", "text_available": False}
    except Exception:
        return {"status": "failed", "text_available": False}

    # 5. Run pytesseract first if installed
    try:
        import pytesseract
        extracted = pytesseract.image_to_string(img, lang="eng+hin").strip()
        return {
            "status": "completed",
            "extracted_text": extracted,
            "text_available": bool(extracted),
        }
    except Exception:
        # Fallback: Use Gemini Vision
        vision_text = _gemini_vision_ocr(mime_type, content_base64)
        if vision_text is not None:
            return {
                "status": "completed",
                "extracted_text": vision_text,
                "text_available": bool(vision_text),
            }
        return {"status": "failed", "text_available": False}
