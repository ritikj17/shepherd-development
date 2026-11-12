import importlib
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analysis_router import router as analysis_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.evidence.router import router as evidence_router
from app.incidents.router import router as incidents_router

logger = logging.getLogger("shepherd.core")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    configure_logging()
    logger.info("SHEPHERD Core API starting up (environment: %s)", settings.app_env)
    yield
    logger.info("SHEPHERD Core API shutting down")


def create_app() -> FastAPI:
    """Build and configure the SHEPHERD Core FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="SHEPHERD Core API",
        description="Women's Safety Intelligence & Early Response Network — Core Backend Service",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # 1. Register structured error handlers (docs/API_CONTRACTS.md Section 2)
    register_exception_handlers(app)

    # 2. Configure CORS
    origins = settings.cors_origin_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 3. System health endpoint
    @app.get("/health", tags=["System"], summary="Core API Health Check")
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "service": "core-api"}

    # 4. Register Core Routers (Member 2 Ownership)
    app.include_router(incidents_router)
    app.include_router(evidence_router)
    app.include_router(analysis_router)

    # 5. Member 4 Extension Point (SafeCircle, Notifications, JusticeBridge)
    # Automatically registers Member 4 modules if they are present
    _register_member_4_routers(app)

    return app


def _register_member_4_routers(app: FastAPI) -> None:
    """Extension point for Member 4 feature modules.

    Member 4 coordinates with Member 2 to expose routers in:
    - app.safety.router
    - app.notifications.router
    - app.reports.router
    """
    optional_routers = [
        ("app.safety.router", "router"),
        ("app.notifications.router", "router"),
        ("app.reports.router", "router"),
    ]
    for module_path, router_name in optional_routers:
        try:
            mod = importlib.import_module(module_path)
            router = getattr(mod, router_name, None)
            if router:
                app.include_router(router)
                logger.info("Successfully registered Member 4 router from %s", module_path)
        except (ImportError, ModuleNotFoundError):
            # Module not yet implemented by Member 4; skip gracefully
            pass
        except Exception as exc:
            logger.warning("Failed to register optional router %s: %s", module_path, exc)


app = create_app()
