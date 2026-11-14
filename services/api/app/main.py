# services/api/app/main.py

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from .api.routes.incidents import router as incidents_router

app = FastAPI(title="SHEPHERD Core API", version="0.1.0")

# Health endpoint (no auth)
@app.get("/health")
async def health():
    return {"status": "ok", "service": "core-api"}

# Include incident routes
app.include_router(incidents_router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("services.api.app.main:app", host="0.0.0.0", port=8001, reload=True)
