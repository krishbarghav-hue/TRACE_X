from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.course import Course
from app.models.topic import Topic
from app.models.resource import Resource
from app.models.note import Note
from app.models.user import User
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/notes", tags=["Notes"])


# ── CREATE NOTE ───────────────────────────────────────────────────────────────
@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_note(
    data: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new note attached to a course and topic.
    """
    # 1. Validate course belongs to current user
    course = db.query(Course).filter(Course.course_id == data.course_id, Course.user_id == current_user.user_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found."
        )

    # 2. Validate topic belongs to this course
    topic = db.query(Topic).filter(Topic.topic_id == data.topic_id, Topic.course_id == data.course_id).first()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found or does not belong to this course."
        )

    # 3. Validate resource if provided
    if data.resource_id is not None:
        res = db.query(Resource).filter(Resource.resource_id == data.resource_id, Resource.course_id == data.course_id).first()
        if not res:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or does not belong to this course."
            )

    new_note = Note(
        user_id=current_user.user_id,
        course_id=data.course_id,
        topic_id=data.topic_id,
        resource_id=data.resource_id,
        study_session_id=data.study_session_id,
        content=data.content
    )

    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note


# ── GET NOTES BY COURSE ───────────────────────────────────────────────────────
@router.get("/course/{course_id}", response_model=List[NoteResponse])
def get_notes_by_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all notes for a specific course.
    """
    course = db.query(Course).filter(Course.course_id == course_id, Course.user_id == current_user.user_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    notes = db.query(Note).filter(Note.course_id == course_id, Note.user_id == current_user.user_id).order_by(Note.created_at.desc()).all()
    return notes


# ── GET NOTES BY TOPIC ────────────────────────────────────────────────────────
@router.get("/topic/{topic_id}", response_model=List[NoteResponse])
def get_notes_by_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all notes for a specific topic.
    """
    topic = (
        db.query(Topic)
        .join(Course, Topic.course_id == Course.course_id)
        .filter(Topic.topic_id == topic_id, Course.user_id == current_user.user_id)
        .first()
    )
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found."
        )

    notes = db.query(Note).filter(Note.topic_id == topic_id, Note.user_id == current_user.user_id).all()
    return notes


# ── GET SINGLE NOTE ───────────────────────────────────────────────────────────
@router.get("/{note_id}", response_model=NoteResponse)
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve a specific note by ID.
    """
    note = db.query(Note).filter(Note.note_id == note_id, Note.user_id == current_user.user_id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found."
        )
    return note


# ── UPDATE NOTE ───────────────────────────────────────────────────────────────
@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: int,
    data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update note content or associated resource/session.
    """
    note = db.query(Note).filter(Note.note_id == note_id, Note.user_id == current_user.user_id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found."
        )

    if data.resource_id is not None:
        res = db.query(Resource).filter(Resource.resource_id == data.resource_id, Resource.course_id == note.course_id).first()
        if not res:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or does not belong to this course."
            )
        note.resource_id = data.resource_id

    if data.study_session_id is not None:
        note.study_session_id = data.study_session_id

    if data.content is not None:
        note.content = data.content

    db.commit()
    db.refresh(note)
    return note


# ── DELETE NOTE ───────────────────────────────────────────────────────────────
@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a note by ID.
    """
    note = db.query(Note).filter(Note.note_id == note_id, Note.user_id == current_user.user_id).first()
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found."
        )

    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully", "note_id": note_id}

