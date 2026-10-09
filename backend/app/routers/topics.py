from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.course import Course
from app.models.topic import Topic
from app.schemas.topic import TopicCreate, TopicUpdate, TopicResponse

TEST_USER_ID = 1

router = APIRouter(prefix="/api/topics", tags=["Topics"])


# ── CREATE TOPIC ──────────────────────────────────────────────────────────────
@router.post("", response_model=TopicResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=TopicResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_topic(data: TopicCreate, db: Session = Depends(get_db)):
    """
    Create a new topic or subtopic for a course.
    """
    # 1. Validate course exists and belongs to current user
    course = db.query(Course).filter(Course.course_id == data.course_id, Course.user_id == TEST_USER_ID).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found."
        )

    # 2. Validate parent topic if supplied
    if data.parent_topic_id is not None:
        parent = db.query(Topic).filter(Topic.topic_id == data.parent_topic_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent topic not found."
            )
        if parent.course_id != data.course_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent topic belongs to a different course."
            )

    # 3. Check unique topic_name per course constraint
    existing = db.query(Topic).filter(
        Topic.course_id == data.course_id,
        Topic.topic_name == data.topic_name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A topic with this name already exists in this course."
        )

    new_topic = Topic(
        course_id=data.course_id,
        parent_topic_id=data.parent_topic_id,
        topic_name=data.topic_name,
        description=data.description
    )

    db.add(new_topic)
    db.commit()
    db.refresh(new_topic)
    return new_topic


# ── GET TOPICS BY COURSE ──────────────────────────────────────────────────────
@router.get("/course/{course_id}", response_model=List[TopicResponse])
def get_topics_by_course(course_id: int, db: Session = Depends(get_db)):
    """
    Retrieve all topics and subtopics for a specific course.
    """
    course = db.query(Course).filter(Course.course_id == course_id, Course.user_id == TEST_USER_ID).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found."
        )

    topics = db.query(Topic).filter(Topic.course_id == course_id).all()
    return topics


# ── GET SINGLE TOPIC ──────────────────────────────────────────────────────────
@router.get("/{topic_id}", response_model=TopicResponse)
def get_topic(topic_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a specific topic by its ID.
    """
    topic = (
        db.query(Topic)
        .join(Course, Topic.course_id == Course.course_id)
        .filter(Topic.topic_id == topic_id, Course.user_id == TEST_USER_ID)
        .first()
    )
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found."
        )
    return topic


# ── UPDATE TOPIC ──────────────────────────────────────────────────────────────
@router.put("/{topic_id}", response_model=TopicResponse)
def update_topic(topic_id: int, data: TopicUpdate, db: Session = Depends(get_db)):
    """
    Update topic name, description, or parent topic.
    """
    topic = (
        db.query(Topic)
        .join(Course, Topic.course_id == Course.course_id)
        .filter(Topic.topic_id == topic_id, Course.user_id == TEST_USER_ID)
        .first()
    )
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found."
        )

    # Validate parent_topic_id
    if data.parent_topic_id is not None:
        if data.parent_topic_id == topic_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A topic cannot be its own parent."
            )
        parent = db.query(Topic).filter(Topic.topic_id == data.parent_topic_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent topic not found."
            )
        if parent.course_id != topic.course_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent topic belongs to a different course."
            )
        topic.parent_topic_id = data.parent_topic_id

    # Validate unique name
    if data.topic_name is not None and data.topic_name != topic.topic_name:
        conflict = db.query(Topic).filter(
            Topic.course_id == topic.course_id,
            Topic.topic_name == data.topic_name,
            Topic.topic_id != topic_id
        ).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A topic with this name already exists in this course."
            )
        topic.topic_name = data.topic_name

    if data.description is not None:
        topic.description = data.description

    db.commit()
    db.refresh(topic)
    return topic


# ── DELETE TOPIC ──────────────────────────────────────────────────────────────
@router.delete("/{topic_id}")
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    """
    Delete a topic by ID. Child subtopics have parent_topic_id SET NULL per database schema.
    """
    topic = (
        db.query(Topic)
        .join(Course, Topic.course_id == Course.course_id)
        .filter(Topic.topic_id == topic_id, Course.user_id == TEST_USER_ID)
        .first()
    )
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found."
        )

    db.delete(topic)
    db.commit()
    return {"message": "Topic deleted successfully", "topic_id": topic_id}
