import os
import uuid
import hashlib
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.models.topic import Topic
from app.models.resource import Resource
from app.models.document import Document
from app.schemas.document import DocumentResponse

TEST_USER_ID = 1

# Base directory for uploads: backend/uploads/
BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed extensions and max file size (50 MB)
ALLOWED_EXTENSIONS = {"pdf", "ppt", "pptx", "doc", "docx", "txt"}
MAX_FILE_SIZE = 50 * 1024 * 1024

router = APIRouter(prefix="/api/documents", tags=["Documents"])


# ── UPLOAD DOCUMENT ───────────────────────────────────────────────────────────
@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    course_id: int = Form(...),
    topic_id: Optional[int] = Form(None),
    resource_id: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a study document (PDF, PPT, DOC, TXT) and store its metadata.
    """
    # 1. Validate course exists
    course = db.query(Course).filter(Course.course_id == course_id, Course.user_id == TEST_USER_ID).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found."
        )

    # 2. Validate topic if supplied
    if topic_id is not None:
        topic = db.query(Topic).filter(Topic.topic_id == topic_id, Topic.course_id == course_id).first()
        if not topic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Topic not found or does not belong to this course."
            )

    # 3. Validate resource if supplied
    if resource_id is not None:
        res = db.query(Resource).filter(Resource.resource_id == resource_id, Resource.course_id == course_id).first()
        if not res:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or does not belong to this course."
            )

    # 4. Validate file extension
    original_filename = file.filename or "unknown"
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # 5. Read file contents & validate size
    content = await file.read()
    file_size = len(content)
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB."
        )

    # 6. Compute sha256 checksum
    checksum = hashlib.sha256(content).hexdigest()

    # 7. Generate unique stored file name and save to disk
    stored_name = f"{uuid.uuid4().hex}_{original_filename}"
    file_path = UPLOAD_DIR / stored_name
    with open(file_path, "wb") as f:
        f.write(content)

    # 8. Save metadata to MySQL
    new_doc = Document(
        user_id=TEST_USER_ID,
        course_id=course_id,
        topic_id=topic_id,
        resource_id=resource_id,
        file_name=original_filename,
        stored_file_name=stored_name,
        file_type=ext,
        file_size_bytes=file_size,
        storage_path=str(file_path),
        description=description,
        version=1,
        checksum_sha256=checksum,
        is_deleted=False
    )

    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc


# ── LIST DOCUMENTS BY COURSE ──────────────────────────────────────────────────
@router.get("/course/{course_id}", response_model=list)
def get_documents_by_course(course_id: int, db: Session = Depends(get_db)):
    """
    Retrieve all documents for a specific course (not deleted).
    """
    course = db.query(Course).filter(Course.course_id == course_id, Course.user_id == TEST_USER_ID).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    docs = (
        db.query(Document)
        .filter(Document.course_id == course_id, Document.user_id == TEST_USER_ID, Document.is_deleted == False)
        .order_by(Document.uploaded_at.desc())
        .all()
    )
    return [
        {
            "document_id": d.document_id,
            "file_name": d.file_name,
            "file_type": d.file_type,
            "file_size_bytes": d.file_size_bytes,
            "description": d.description,
            "course_id": d.course_id,
            "topic_id": d.topic_id,
            "version": d.version,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]


# ── LIST DOCUMENTS BY TOPIC ───────────────────────────────────────────────────
@router.get("/topic/{topic_id}", response_model=list)
def get_documents_by_topic(topic_id: int, db: Session = Depends(get_db)):
    """
    Retrieve all documents for a specific topic (not deleted).
    """
    docs = (
        db.query(Document)
        .filter(Document.topic_id == topic_id, Document.user_id == TEST_USER_ID, Document.is_deleted == False)
        .order_by(Document.uploaded_at.desc())
        .all()
    )
    return [
        {
            "document_id": d.document_id,
            "file_name": d.file_name,
            "file_type": d.file_type,
            "file_size_bytes": d.file_size_bytes,
            "description": d.description,
            "course_id": d.course_id,
            "topic_id": d.topic_id,
            "version": d.version,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]


# ── GET DOCUMENT METADATA ─────────────────────────────────────────────────────
@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    """
    Retrieve document metadata by document ID.
    """
    doc = (
        db.query(Document)
        .filter(Document.document_id == document_id, Document.user_id == TEST_USER_ID, Document.is_deleted == False)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )
    return doc


# ── DELETE DOCUMENT ───────────────────────────────────────────────────────────
@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    """
    Delete a document (marks is_deleted = True and removes stored file).
    """
    doc = (
        db.query(Document)
        .filter(Document.document_id == document_id, Document.user_id == TEST_USER_ID, Document.is_deleted == False)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    # Remove file from disk if present
    if os.path.exists(doc.storage_path):
        try:
            os.remove(doc.storage_path)
        except OSError:
            pass

    # Soft delete in database
    doc.is_deleted = True
    db.commit()

    return {"message": "Document deleted successfully", "document_id": document_id}
