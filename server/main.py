"""
RehabSmart FastAPI server.
Serves ML inference endpoints for knee (and future leg/elbow) rehabilitation.

Start with:
  uvicorn main:app --reload --port 8000
"""

import sys
import logging
from pathlib import Path

# Ensure server/ itself is importable (for relative imports inside routers/)
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import knee, leg, elbow

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)

app = FastAPI(
    title="RehabSmart API",
    version="1.0.0",
    description="ML inference API for knee/leg/elbow rehabilitation.",
)

# Allow the Vite dev server and production build to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(knee.router)
app.include_router(leg.router)
app.include_router(elbow.router)


@app.get("/api/health")
async def root_health():
    return {"status": "ok", "service": "RehabSmart API"}
