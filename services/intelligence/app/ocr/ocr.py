import base64
import io
from typing import Dict

from PIL import Image, UnidentifiedImageError

# Supported mime types and Pillow format mapping
SUPPORTED_MIME_TYPES = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
}

# Maximum accepted image size (bytes). Adjust as needed; here 5 MB.
MAX_IMAGE_SIZE = 5 * 1024 * 1024


def perform_ocr(mime_type: str, content_base64: str) -> Dict:
    """Run OCR on a base64‑encoded image.

    Returns a dict matching the API contract:
        {"status": "completed"|"failed"|"not_applicable",
         "extracted_text": "..."}  # optional when status == "completed"

    * If the mime type is unsupported → status ``not_applicable``.
    * If the image exceeds the size limit → status ``failed``.
    * If Pillow cannot open the image → status ``failed``.
    * If Tesseract is not installed or raises an error → status ``failed``.
    * On success the extracted text is returned and status is ``completed``.
    """
    # 1️⃣ Validate MIME type
    if mime_type not in SUPPORTED_MIME_TYPES:
        return {"status": "not_applicable"}

    # 2️⃣ Decode Base64
    try:
        raw_bytes = base64.b64decode(content_base64)
    except Exception:
        return {"status": "failed"}

    # 3️⃣ Enforce size limit
    if len(raw_bytes) > MAX_IMAGE_SIZE:
        return {"status": "failed"}

    # 4️⃣ Load image with Pillow
    try:
        image_stream = io.BytesIO(raw_bytes)
        img = Image.open(image_stream)
        # Verify format matches MIME (defensive)
        if img.format != SUPPORTED_MIME_TYPES[mime_type]:
            # Pillow may still open it, but we treat a mismatch as not applicable
            return {"status": "not_applicable"}
    except UnidentifiedImageError:
        return {"status": "failed"}
    except Exception:
        return {"status": "failed"}

    # 5️⃣ Run pytesseract – handle missing Tesseract binary
    try:
        import pytesseract
        # pytesseract will raise an error if the binary cannot be found
        extracted = pytesseract.image_to_string(img, lang="eng+hin")
        extracted = extracted.strip()
        return {"status": "completed", "extracted_text": extracted}
    except (ImportError, pytesseract.pytesseract.TesseractNotFoundError, OSError):
        # Missing Tesseract or binary not found
        return {"status": "failed"}
    except Exception:
        return {"status": "failed"}
