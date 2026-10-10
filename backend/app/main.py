
import io
import os
import zipfile

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import Base, engine, get_db, DB_NAME
import app.models  # Register all SQLAlchemy models

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
    version="1.0.0",
)

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")

origins = [
    frontend_url,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Remove empty origins
origins = [origin for origin in origins if origin]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create missing tables from registered SQLAlchemy models.
# This does NOT add missing columns to existing tables.
@app.on_event("startup")
def create_database_tables():
    Base.metadata.create_all(bind=engine)


# Validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    try:
        body = await request.body()
        body_str = body.decode("utf-8", errors="replace")
    except Exception:
        body_str = "<unreadable>"

    print(
        "\n==================== [FASTAPI 422 VALIDATION ERROR] ====================",
        flush=True,
    )
    print(f"URL: {request.method} {request.url}", flush=True)
    print(f"Raw Body: {body_str}", flush=True)
    print(f"Validation Errors: {exc.errors()}", flush=True)
    print(
        "========================================================================\n",
        flush=True,
    )

    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


# Register API routers
app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(topics.router)
app.include_router(resources.router)
app.include_router(documents.router)
app.include_router(notes.router)
app.include_router(study_sessions.router)
app.include_router(progress.router)
app.include_router(activity_logs.router)
app.include_router(analytics.router)
app.include_router(history_to_plan.router)


# Root endpoint
@app.get("/")
def root():
    return {
        "message": "TRACEX Backend is running!",
        "docs": "/docs",
        "health": "/api/health",
    }


# Database health check
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))

        return {
            "status": "ok",
            "database": "connected",
            "db_name": DB_NAME,
        }

    except Exception as exc:
        print(f"Database health check failed: {exc}", flush=True)

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "error",
                "database": "disconnected",
                "message": "Database connection failed",
            },
        )


# Download the Chrome extension as a ZIP file
@app.get("/api/extension/download")
def download_extension_zip():
    extension_dir = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "extension",
        )
    )

    if not os.path.isdir(extension_dir):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Extension directory not found on server",
        )

    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(
        zip_buffer,
        "w",
        zipfile.ZIP_DEFLATED,
    ) as zip_file:
        for root_dir, _, files in os.walk(extension_dir):
            for file_name in files:
                full_path = os.path.join(root_dir, file_name)
                relative_path = os.path.relpath(
                    full_path,
                    extension_dir,
                )
                zip_file.write(full_path, relative_path)

    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="tracex-extension.zip"'
        },
    )
