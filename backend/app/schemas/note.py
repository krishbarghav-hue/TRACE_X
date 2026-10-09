from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class NoteCreate(BaseModel):
    course_id: int = Field(..., description="Course ID this note belongs to")
    topic_id: int = Field(..., description="Topic ID this note belongs to")
    resource_id: Optional[int] = Field(None, description="Optional associated resource ID")
    study_session_id: Optional[int] = Field(None, description="Optional associated study session ID")
    content: str = Field(..., min_length=1, description="Note content")


class NoteUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1, description="Updated note content")
    resource_id: Optional[int] = Field(None, description="Updated associated resource ID")
    study_session_id: Optional[int] = Field(None, description="Updated associated study session ID")


class NoteResponse(BaseModel):
    note_id: int
    user_id: int
    course_id: int
    topic_id: int
    resource_id: Optional[int] = None
    study_session_id: Optional[int] = None
    content: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
