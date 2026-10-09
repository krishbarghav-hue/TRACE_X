from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# ── Schema for creating a new course ──────────────────────────────────────────
class CourseCreate(BaseModel):
    course_name: str = Field(..., min_length=1, max_length=150, description="Name of the course")
    description: Optional[str] = Field(None, description="Optional course description")


# ── Schema for updating an existing course ────────────────────────────────────
class CourseUpdate(BaseModel):
    course_name: Optional[str] = Field(None, min_length=1, max_length=150, description="Updated course name")
    description: Optional[str] = Field(None, description="Updated course description")


# ── Schema for returning course details ───────────────────────────────────────
class CourseResponse(BaseModel):
    course_id: int
    user_id: int
    course_name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    # Allows Pydantic to read directly from SQLAlchemy models
    model_config = {"from_attributes": True}
