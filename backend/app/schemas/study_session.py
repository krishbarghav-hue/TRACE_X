from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.models.study_session import StudyMode


class StudySessionStart(BaseModel):
    course_id: int = Field(..., description="ID of the course being studied")
    topic_id: Optional[int] = Field(None, description="Optional topic ID")
    resource_id: Optional[int] = Field(None, description="Optional resource ID")
    start_time: Optional[datetime] = Field(None, description="Session start time (defaults to now)")
    study_mode: Optional[StudyMode] = Field(StudyMode.other, description="Mode of study (reading, video, practice, revision, other)")
    session_notes: Optional[str] = Field(None, max_length=500, description="Optional notes on the session")


class StudySessionEnd(BaseModel):
    end_time: Optional[datetime] = Field(None, description="Session end time (defaults to now)")
    session_notes: Optional[str] = Field(None, max_length=500, description="Optional notes update")


class StudySessionResponse(BaseModel):
    session_id: int
    user_id: int
    course_id: int
    topic_id: Optional[int] = None
    resource_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    duration_minutes: Optional[int] = None
    study_mode: Optional[str] = None
    session_notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
