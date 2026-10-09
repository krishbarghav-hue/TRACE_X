from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from typing import List, Optional

from app.database import get_db
from app.models.course import Course
from app.models.topic import Topic
from app.models.resource import Resource, ResourceType
from app.models.activity_log import ActivityLog
from app.schemas.resource import ResourceCreate, ResourceUpdate, ResourceResponse
from app.routers.activity_logs import get_effective_user_id

router = APIRouter(prefix="/api/resources", tags=["Resources"])


# ── GET ALL DISCOVERED & STUDY RESOURCES ──────────────────────────────────────
@router.get("", response_model=List[ResourceResponse])
@router.get("/", response_model=List[ResourceResponse], include_in_schema=False)
def get_all_resources(
    search: Optional[str] = Query(None, description="Search term for title, domain, or URL"),
    domain: Optional[str] = Query(None, description="Filter by domain"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    sort_by: Optional[str] = Query("recent", description="Sort by: recent, duration, visits"),
    limit: Optional[int] = Query(100, ge=1, le=500),
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Retrieve auto-discovered and user resources for the effective user.
    Uses activity telemetry as primary source of discovered web resources.
    """
    query = db.query(Resource).filter(Resource.user_id == user_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Resource.title.ilike(term),
                Resource.domain.ilike(term),
                Resource.url.ilike(term)
            )
        )

    if domain and domain.strip():
        query = query.filter(Resource.domain.ilike(f"%{domain.strip()}%"))

    if resource_type and resource_type.strip() and resource_type != "all":
        query = query.filter(Resource.resource_type == resource_type.strip())

    if sort_by == "duration":
        query = query.order_by(desc(Resource.total_observed_seconds), desc(Resource.last_seen))
    elif sort_by == "visits":
        query = query.order_by(desc(Resource.visit_count), desc(Resource.last_seen))
    else: # "recent"
        query = query.order_by(desc(func.coalesce(Resource.last_seen, Resource.created_at)))

    resources = query.limit(limit).all()
    return resources


# ── CREATE RESOURCE (MANUAL OPTIONAL) ─────────────────────────────────────────
@router.post("", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_resource(
    data: ResourceCreate,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Create a new study resource (manual addition).
    """
    # 1. Validate course exists if provided
    if data.course_id:
        course = db.query(Course).filter(Course.course_id == data.course_id, Course.user_id == user_id).first()
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found."
            )

    # 2. Validate topic if supplied
    if data.topic_id is not None and data.course_id:
        topic = db.query(Topic).filter(Topic.topic_id == data.topic_id, Topic.course_id == data.course_id).first()
        if not topic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Topic not found or does not belong to this course."
            )

    domain = None
    if data.url:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(data.url)
            domain = parsed.netloc or None
        except Exception:
            pass

    new_resource = Resource(
        user_id=user_id,
        course_id=data.course_id,
        topic_id=data.topic_id,
        resource_type=data.resource_type,
        title=data.title,
        url=data.url,
        domain=domain,
        source="manual",
        estimated_duration_minutes=data.estimated_duration_minutes,
        total_observed_seconds=(data.estimated_duration_minutes or 0) * 60,
        visit_count=1
    )

    db.add(new_resource)
    db.commit()
    db.refresh(new_resource)
    return new_resource


# ── GET RESOURCES BY COURSE ───────────────────────────────────────────────────
@router.get("/course/{course_id}", response_model=List[ResourceResponse])
def get_resources_by_course(
    course_id: int,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Retrieve all resources under a specific course.
    """
    resources = db.query(Resource).filter(
        Resource.course_id == course_id,
        Resource.user_id == user_id
    ).all()
    return resources


# ── GET RESOURCES BY TOPIC ────────────────────────────────────────────────────
@router.get("/topic/{topic_id}", response_model=List[ResourceResponse])
def get_resources_by_topic(
    topic_id: int,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Retrieve all resources under a specific topic.
    """
    resources = db.query(Resource).filter(
        Resource.topic_id == topic_id,
        Resource.user_id == user_id
    ).all()
    return resources


# ── GET SINGLE RESOURCE ───────────────────────────────────────────────────────
@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(
    resource_id: int,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Retrieve a specific resource by ID.
    """
    resource = db.query(Resource).filter(
        Resource.resource_id == resource_id,
        Resource.user_id == user_id
    ).first()
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found."
        )
    return resource


# ── UPDATE RESOURCE ───────────────────────────────────────────────────────────
@router.put("/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: int,
    data: ResourceUpdate,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Update resource details.
    """
    resource = db.query(Resource).filter(
        Resource.resource_id == resource_id,
        Resource.user_id == user_id
    ).first()
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found."
        )

    if data.topic_id is not None and resource.course_id:
        topic = db.query(Topic).filter(Topic.topic_id == data.topic_id, Topic.course_id == resource.course_id).first()
        if not topic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Topic not found or does not belong to this course."
            )
        resource.topic_id = data.topic_id

    if data.resource_type is not None:
        resource.resource_type = data.resource_type
    if data.title is not None:
        resource.title = data.title
    if data.url is not None:
        resource.url = data.url
    if data.estimated_duration_minutes is not None:
        resource.estimated_duration_minutes = data.estimated_duration_minutes

    db.commit()
    db.refresh(resource)
    return resource


# ── DELETE RESOURCE ───────────────────────────────────────────────────────────
@router.delete("/{resource_id}")
def delete_resource(
    resource_id: int,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Delete a resource by ID.
    """
    resource = db.query(Resource).filter(
        Resource.resource_id == resource_id,
        Resource.user_id == user_id
    ).first()
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found."
        )

    db.delete(resource)
    db.commit()
    return {"message": "Resource deleted successfully", "resource_id": resource_id}
