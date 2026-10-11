from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.course import Course
from app.models.user import User
from app.schemas.course import CourseCreate, CourseUpdate, CourseResponse
from app.utils.auth import get_current_user

# Create router for all course-related endpoints
router = APIRouter(prefix="/api/courses", tags=["Courses"])


# ── CREATE COURSE ─────────────────────────────────────────────────────────────
@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_course(
    data: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new course for the authenticated user.
    """
    # Check if a course with the same name already exists for this user
    existing_course = (
        db.query(Course)
        .filter(Course.user_id == current_user.user_id, Course.course_name == data.course_name)
        .first()
    )
    if existing_course:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A course with this name already exists."
        )

    new_course = Course(
        user_id=current_user.user_id,
        course_name=data.course_name,
        description=data.description
    )

    db.add(new_course)
    db.commit()
    db.refresh(new_course)

    return new_course


# ── GET ALL COURSES ───────────────────────────────────────────────────────────
@router.get("", response_model=List[CourseResponse])
@router.get("/", response_model=List[CourseResponse], include_in_schema=False)
def get_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all courses for the authenticated user.
    """
    courses = db.query(Course).filter(Course.user_id == current_user.user_id).all()
    return courses


# ── GET SINGLE COURSE ─────────────────────────────────────────────────────────
@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve a specific course by its ID.
    """
    course = (
        db.query(Course)
        .filter(Course.course_id == course_id, Course.user_id == current_user.user_id)
        .first()
    )
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    return course


# ── UPDATE COURSE ─────────────────────────────────────────────────────────────
@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    data: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing course by ID.
    """
    course = (
        db.query(Course)
        .filter(Course.course_id == course_id, Course.user_id == current_user.user_id)
        .first()
    )
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )

    # If course_name is being updated, verify it doesn't conflict with another course
    if data.course_name is not None and data.course_name != course.course_name:
        conflict = (
            db.query(Course)
            .filter(
                Course.user_id == current_user.user_id,
                Course.course_name == data.course_name,
                Course.course_id != course_id
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A course with this name already exists."
            )
        course.course_name = data.course_name

    if data.description is not None:
        course.description = data.description

    db.commit()
    db.refresh(course)
    return course


# ── DELETE COURSE ─────────────────────────────────────────────────────────────
@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a course by ID.
    """
    course = (
        db.query(Course)
        .filter(Course.course_id == course_id, Course.user_id == current_user.user_id)
        .first()
    )
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )

    db.delete(course)
    db.commit()
    return {"message": "Course deleted successfully", "course_id": course_id}

