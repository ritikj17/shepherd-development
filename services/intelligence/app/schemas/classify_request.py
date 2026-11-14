from pydantic import BaseModel, Field

class ClassifyRequest(BaseModel):
    text: str = Field(..., description="Text to classify")
