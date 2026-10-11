from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.models.topic import Topic
from app.models.resource import Resource
from app.models.study_session import StudySession, StudyMode
from app.models.user import User
from app.schemas.study_session import StudySessionStart, StudySessionEnd, StudySessionResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/study-sessions", tags=["Study Sessions"])


# ── START STUDY SESSION ───────────────────────────────────────────────────────
@router.post("/start", response_model=StudySessionResponse, status_code=status.HTTP_201_CREATED)
def start_study_session(
    data: StudySessionStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start a deliberate study session for a course and optional topic/resource.
    """
    # 1. Validate course belongs to current user
    course = db.query(Course).filter(Course.course_id == data.course_id, Course.user_id == current_user.user_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    # 2. Validate topic if supplied
    if data.topic_id is not None:
        topic = db.query(Topic).filter(Topic.topic_id == data.topic_id, Topic.course_id == data.course_id).first()
        if not topic:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found or does not belong to this course.")

    # 3. Validate resource if supplied
    if data.resource_id is not None:
        res = db.query(Resource).filter(Resource.resource_id == data.resource_id, Resource.course_id == data.course_id, Resource.user_id == current_user.user_id).first()
        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found or does not belong to this course.")

    start_time = data.start_time or datetime.now()
    # The database schema enforces NOT NULL on end_time and CHECK (end_time > start_time).
    # We initialize end_time with a 1-second placeholder until the session is explicitly ended.
    initial_end_time = start_time + timedelta(seconds=1)

    session = StudySession(
        user_id=current_user.user_id,
        course_id=data.course_id,
        topic_id=data.topic_id,
        resource_id=data.resource_id,
        start_time=start_time,
        end_time=initial_end_time,
        study_mode=data.study_mode or StudyMode.other,
        session_notes=data.session_notes
    )

    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# ── END STUDY SESSION ─────────────────────────────────────────────────────────
@router.post("/{session_id}/end", response_model=StudySessionResponse)
def end_study_session(
    session_id: int,
    data: Optional[StudySessionEnd] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    End an active study session. Sets end_time, allowing MySQL to compute duration_minutes.
    """
    session = db.query(StudySession).filter(StudySession.session_id == session_id, StudySession.user_id == current_user.user_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found.")

    end_time = (data.end_time if data and data.end_time else None) or datetime.now()
    # Ensure end_time > start_time to respect database check constraint
    if end_time <= session.start_time:
        end_time = session.start_time + timedelta(minutes=1)

    session.end_time = end_time
    if data and data.session_notes:
        session.session_notes = data.session_notes

    db.commit()
    db.refresh(session)
    return session


# ── GET ALL SESSIONS ──────────────────────────────────────────────────────────
@router.get("", response_model=List[StudySessionResponse])
@router.get("/", response_model=List[StudySessionResponse], include_in_schema=False)
def get_all_study_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all study sessions for the authenticated user.
    """
    sessions = db.query(StudySession).filter(StudySession.user_id == current_user.user_id).order_by(StudySession.start_time.desc()).all()
    return sessions


# ── GET SESSIONS BY COURSE ────────────────────────────────────────────────────
@router.get("/course/{course_id}", response_model=List[StudySessionResponse])
def get_sessions_by_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all study sessions for a specific course.
    """
    course = db.query(Course).filter(Course.course_id == course_id, Course.user_id == current_user.user_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    sessions = (
        db.query(StudySession)
        .filter(StudySession.course_id == course_id, StudySession.user_id == current_user.user_id)
        .order_by(StudySession.start_time.desc())
        .all()
    )
    return sessions


# ── GET SINGLE SESSION ────────────────────────────────────────────────────────
@router.get("/{session_id}", response_model=StudySessionResponse)
def get_study_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve details of a specific study session.
    """
    session = db.query(StudySession).filter(StudySession.session_id == session_id, StudySession.user_id == current_user.user_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found.")
    return session

