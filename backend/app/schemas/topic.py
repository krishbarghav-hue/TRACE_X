from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class TopicCreate(BaseModel):
    course_id: int = Field(..., description="ID of the course this topic belongs to")
    parent_topic_id: Optional[int] = Field(None, description="Optional parent topic ID for subtopics")
    topic_name: str = Field(..., min_length=1, max_length=150, description="Name of the topic")
    description: Optional[str] = Field(None, description="Optional topic description")


class TopicUpdate(BaseModel):
    parent_topic_id: Optional[int] = Field(None, description="Updated parent topic ID")
    topic_name: Optional[str] = Field(None, min_length=1, max_length=150, description="Updated topic name")
    description: Optional[str] = Field(None, description="Updated topic description")


class TopicResponse(BaseModel):
    topic_id: int
    course_id: int
    parent_topic_id: Optional[int] = None
    topic_name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
