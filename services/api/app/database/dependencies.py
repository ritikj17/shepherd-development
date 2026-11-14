from typing import Optional

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.database.base import BaseRepository
from app.database.in_memory import InMemoryRepository
from app.database.supabase_client import SupabasePostgrestRepository

_singleton_repo: Optional[BaseRepository] = None


def get_repository(settings: Settings = Depends(get_settings)) -> BaseRepository:
    """Dependency returning the configured repository."""
    global _singleton_repo
    if _singleton_repo is not None:
        return _singleton_repo

    if settings.use_in_memory_adapter or not settings.supabase_url or not settings.supabase_service_role_key:
        _singleton_repo = InMemoryRepository(max_upload_bytes=settings.max_evidence_upload_bytes)
        return _singleton_repo

    _singleton_repo = SupabasePostgrestRepository(settings)
    return _singleton_repo


def reset_repository() -> None:
    """Helper for test harness to reset singleton repository state."""
    global _singleton_repo
    _singleton_repo = None
