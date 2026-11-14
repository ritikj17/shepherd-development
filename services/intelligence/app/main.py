import os
from pathlib import Path
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

def _load_env_file() -> None:
    """Load key-value pairs from .env if present without overriding existing env vars."""
    candidates = [
        Path(__file__).resolve().parent.parent / ".env",
        Path.cwd() / ".env",
    ]
    for candidate in candidates:
        if candidate.is_file():
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        k, _, v = line.partition("=")
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass
            break

_load_env_file()

from .api import router as intelligence_router

app = FastAPI(title="SHEPHERD Intelligence Service", version="0.1.0")

# Register router under the base path /api/v1
app.include_router(intelligence_router, prefix="/api/v1")

# Global error handlers to emit a flat error envelope (no nested "detail")
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # If the detail already follows our envelope format, return it directly
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    # Fallback generic envelope
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "UNKNOWN", "message": str(exc.detail), "details": {}}},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Produce a deterministic envelope for validation errors
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors(),
            }
        },
    )

# Health endpoint (no auth required)
@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "intelligence-api"}

if __name__ == "__main__":
    uvicorn.run("services.intelligence.app.main:app", host="0.0.0.0", port=8000, reload=True)
