import time
from typing import Any, AsyncGenerator
from uuid import UUID, uuid4

import jwt
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.analysis_router import get_intelligence_client
from app.auth.models import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.core.intelligence_client import IntelligenceClient
from app.database.dependencies import get_repository, reset_repository
from app.database.in_memory import InMemoryRepository
from app.main import create_app

JWT_SECRET = "test-secret-key-at-least-32-bytes-long-for-hs256"
USER_1_ID = uuid4()
USER_2_ID = uuid4()


class DummyIntelligenceClient(IntelligenceClient):
    """Safe test default that never hangs on unlistening ports."""

    def __init__(self) -> None:
        pass

    async def analyze_incident(
        self,
        incident_id: Any,
        description: str,
        evidence_items: list[dict[str, Any]],
    ) -> dict[str, Any]:
        from app.core.exceptions import ServiceUnavailableError
        raise ServiceUnavailableError("Intelligence API service is currently unreachable.")

    async def get_graph(self, incident_id: Any) -> dict[str, Any] | None:
        return None


def create_test_jwt(
    user_id: UUID,
    role: str = "authenticated",
    expires_in: int = 3600,
    secret: str = JWT_SECRET,
    aud: str = "authenticated",
    iss: str = "https://test.supabase.co/auth/v1",
) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "aud": aud,
        "iss": iss,
        "role": role,
        "email": f"user-{user_id}@example.test",
        "iat": now,
        "exp": now + expires_in,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def test_settings() -> Settings:
    reset_repository()
    return Settings(
        app_env="test",
        use_in_memory_adapter=True,
        supabase_jwt_secret=JWT_SECRET,
        supabase_jwt_audience="authenticated",
        supabase_jwt_issuer="https://test.supabase.co/auth/v1",
        max_evidence_upload_bytes=10 * 1024 * 1024,
        ai_service_timeout_seconds=1.0,
    )


@pytest.fixture
def repo(test_settings: Settings) -> InMemoryRepository:
    return InMemoryRepository(max_upload_bytes=test_settings.max_evidence_upload_bytes)


@pytest_asyncio.fixture
async def client(test_settings: Settings, repo: InMemoryRepository) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_repository] = lambda: repo
    app.dependency_overrides[get_intelligence_client] = lambda: DummyIntelligenceClient()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def user_1_token() -> str:
    return create_test_jwt(USER_1_ID)


@pytest.fixture
def user_2_token() -> str:
    return create_test_jwt(USER_2_ID)


@pytest.fixture
def user_1_headers(user_1_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {user_1_token}"}


@pytest.fixture
def user_2_headers(user_2_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {user_2_token}"}
