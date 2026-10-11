from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.models.topic import Topic
from app.models.resource import Resource
from app.models.progress import Progress, ProgressStatus
from app.models.user import User
from app.schemas.progress import ProgressCreate, ProgressUpdate, ProgressResponse
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/progress", tags=["Progress"])


# ── CREATE PROGRESS ───────────────────────────────────────────────────────────
@router.post("", response_model=ProgressResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ProgressResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_progress(
    data: ProgressCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initialize progress tracking for a topic and optional resource.
    """
    # 1. Validate topic exists and belongs to current user's course
    topic = db.query(Topic).join(Course, Topic.course_id == Course.course_id).filter(
        Topic.topic_id == data.topic_id,
        Course.user_id == current_user.user_id
    ).first()
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found.")

    # 2. Validate resource if provided
    if data.resource_id is not None:
        resource = db.query(Resource).filter(
            Resource.resource_id == data.resource_id,
            Resource.user_id == current_user.user_id
        ).first()
        if not resource:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
        if resource.topic_id is not None and resource.topic_id != data.topic_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resource does not belong to this topic.")

    # 3. Check unique constraint (user_id, topic_id, resource_id)
    existing = db.query(Progress).filter(
        Progress.user_id == current_user.user_id,
        Progress.topic_id == data.topic_id,
        Progress.resource_id == data.resource_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Progress record already exists for this topic and resource. Use PUT to update."
        )

    # 4. Percent validation
    percent = data.percent_complete if data.percent_complete is not None else 0
    if percent < 0 or percent > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Percent complete must be between 0 and 100.")

    # Automatically synchronize status with percent if applicable
    prog_status = data.status or ProgressStatus.not_started
    if percent == 100 and prog_status != ProgressStatus.completed:
        prog_status = ProgressStatus.completed
    elif percent > 0 and prog_status == ProgressStatus.not_started:
        prog_status = ProgressStatus.in_progress

    new_prog = Progress(
        user_id=current_user.user_id,
        topic_id=data.topic_id,
        resource_id=data.resource_id,
        status=prog_status,
        percent_complete=percent
    )

    db.add(new_prog)
    db.commit()
    db.refresh(new_prog)
    return new_prog


# ── GET PROGRESS BY TOPIC ─────────────────────────────────────────────────────
@router.get("/topic/{topic_id}", response_model=List[ProgressResponse])
def get_progress_by_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all progress entries for a specific topic.
    """
    topic = db.query(Topic).join(Course, Topic.course_id == Course.course_id).filter(
        Topic.topic_id == topic_id,
        Course.user_id == current_user.user_id
    ).first()
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found.")

    records = db.query(Progress).filter(
        Progress.topic_id == topic_id,
        Progress.user_id == current_user.user_id
    ).all()
    return records


# ── GET PROGRESS BY COURSE ────────────────────────────────────────────────────
@router.get("/course/{course_id}", response_model=List[ProgressResponse])
def get_progress_by_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all progress entries for all topics in a given course.
    """
    course = db.query(Course).filter(Course.course_id == course_id, Course.user_id == current_user.user_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    records = (
        db.query(Progress)
        .join(Topic, Progress.topic_id == Topic.topic_id)
        .filter(Topic.course_id == course_id, Progress.user_id == current_user.user_id)
        .all()
    )
    return records


# ── UPDATE PROGRESS ───────────────────────────────────────────────────────────
@router.put("/{progress_id}", response_model=ProgressResponse)
def update_progress(
    progress_id: int,
    data: ProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update progress status and completion percentage.
    """
    record = db.query(Progress).filter(
        Progress.progress_id == progress_id,
        Progress.user_id == current_user.user_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progress record not found.")

    if data.percent_complete is not None:
        if data.percent_complete < 0 or data.percent_complete > 100:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Percent complete must be between 0 and 100.")
        record.percent_complete = data.percent_complete
        if record.percent_complete == 100 and (data.status is None or data.status == ProgressStatus.in_progress):
            record.status = ProgressStatus.completed
        elif record.percent_complete > 0 and record.status == ProgressStatus.not_started and data.status is None:
            record.status = ProgressStatus.in_progress

    if data.status is not None:
        record.status = data.status

    db.commit()
    db.refresh(record)
    return record

