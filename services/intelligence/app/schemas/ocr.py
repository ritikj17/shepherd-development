from pydantic import BaseModel, Field, UUID4
from typing import List, Optional

class OCRResult(BaseModel):
    status: str = Field(..., description="OCR processing status: completed, failed, or not_applicable")
    extracted_text: Optional[str] = Field(None, description="Extracted text when status is completed")
