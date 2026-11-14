import os
from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str = Field(..., env="SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(..., env="SUPABASE_SERVICE_ROLE_KEY")
    INTELLIGENCE_URL: str = Field(default="http://localhost:8000", env="INTELLIGENCE_URL")
    AI_SERVICE_TOKEN: str = Field(..., env="AI_SERVICE_TOKEN")

    class Config:
        env_file = ".env"
        case_sensitive = False
