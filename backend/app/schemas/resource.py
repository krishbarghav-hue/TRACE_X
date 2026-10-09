from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.resource import ResourceType


class ResourceCreate(BaseModel):
    course_id: int = Field(..., description="ID of the course this resource belongs to")
    topic_id: Optional[int] = Field(None, description="Optional topic ID")
    resource_type: ResourceType = Field(..., description="Type of resource (youtube, website, pdf, etc.)")
    title: str = Field(..., min_length=1, max_length=200, description="Resource title")
    url: Optional[str] = Field(None, max_length=1000, description="Resource URL")
    estimated_duration_minutes: Optional[int] = Field(None, ge=0, description="Estimated duration in minutes")


class ResourceUpdate(BaseModel):
    topic_id: Optional[int] = Field(None, description="Updated topic ID")
    resource_type: Optional[ResourceType] = Field(None, description="Updated resource type")
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="Updated title")
    url: Optional[str] = Field(None, max_length=1000, description="Updated URL")
    estimated_duration_minutes: Optional[int] = Field(None, ge=0, description="Updated duration in minutes")


class ResourceResponse(BaseModel):
    resource_id: int
    user_id: int
    course_id: Optional[int] = None
    topic_id: Optional[int] = None
    resource_type: str
    title: str
    url: Optional[str] = None
    domain: Optional[str] = None
    source: Optional[str] = "browser_extension"
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    visit_count: Optional[int] = 1
    total_observed_seconds: Optional[int] = 0
    estimated_duration_minutes: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
