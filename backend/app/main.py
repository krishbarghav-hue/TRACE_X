import io
import os
import zipfile
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.routers import (
    auth,
    courses,
    topics,
    resources,
    documents,
    notes,
    study_sessions,
    progress,
    activity_logs,
    analytics,
    history_to_plan,
)

# Create the FastAPI application
app = FastAPI(
    title="TRACEX API",
    description="Privacy-First Student Learning Intelligence Platform",
    version="1.0.0"
)

# CORS middleware: allows the React frontend (port 5173) and Chrome extension to call this API
frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
origins = [
    frontend_url,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    try:
        body = await request.body()
        body_str = body.decode("utf-8", errors="replace")
    except Exception:
        body_str = "<unreadable>"
    print(f"\n==================== [FASTAPI 422 VALIDATION ERROR] ====================", flush=True)
    print(f"URL: {request.method} {request.url}", flush=True)
    print(f"Raw Body: {body_str}", flush=True)
    print(f"Validation Errors: {exc.errors()}", flush=True)
    print(f"========================================================================\n", flush=True)
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


# ── Register routers ───────────────────────────────────────────────────────────
# Each router handles a specific feature area.
# As we build more stages, we add more routers here.
app.include_router(auth.router)                  # /api/auth
app.include_router(courses.router)               # /api/courses
app.include_router(topics.router)                # /api/topics
app.include_router(resources.router)             # /api/resources
app.include_router(documents.router)             # /api/documents
app.include_router(notes.router)                 # /api/notes
app.include_router(study_sessions.router)        # /api/study-sessions
app.include_router(progress.router)              # /api/progress
app.include_router(activity_logs.router)         # /api/activity-logs
app.include_router(analytics.router)             # /api/analytics
app.include_router(history_to_plan.router)       # /api/history-to-plan


# ── Root endpoint ──────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "message": "TRACEX Backend is running!",
        "docs": "/docs",
        "health": "/api/health"
    }


# ── Health check endpoint ──────────────────────────────────────────────────────
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """
    Verifies that FastAPI can connect to the MySQL trace_x database.
    """
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database": "connected",
            "db_name": "trace_x"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": "error",
                "database": "disconnected",
                "message": str(e)
            }
        )


# ── Extension 1-click Download Endpoint ───────────────────────────────────────
@app.get("/api/extension/download")
def download_extension_zip():
    """
    Directly packages the TraceX Chrome Extension folder into a ZIP file
    and streams it to the user for instant 1-click download.
    """
    extension_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "extension")
    )
    if not os.path.exists(extension_dir):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Extension directory not found on server"
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, _, files in os.walk(extension_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, extension_dir)
                zip_file.write(full_path, rel_path)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="tracex-extension.zip"'}
    )

