from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
from app.models.progress import ProgressStatus


class ProgressCreate(BaseModel):
    topic_id: int = Field(..., description="ID of the topic")
    resource_id: Optional[int] = Field(None, description="Optional ID of specific resource")
    status: Optional[ProgressStatus] = Field(ProgressStatus.not_started, description="not_started, in_progress, completed")
    percent_complete: Optional[int] = Field(0, ge=0, le=100, description="Completion percentage 0 to 100")

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            v_clean = v.strip().lower()
            return ProgressStatus(v_clean)
        return v


class ProgressUpdate(BaseModel):
    status: Optional[ProgressStatus] = Field(None, description="Updated status")
    percent_complete: Optional[int] = Field(None, ge=0, le=100, description="Updated completion percentage 0 to 100")

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if v is not None and isinstance(v, str):
            v_clean = v.strip().lower()
            return ProgressStatus(v_clean)
        return v


class ProgressResponse(BaseModel):
    progress_id: int
    user_id: int
    topic_id: int
    resource_id: Optional[int] = None
    status: str
    percent_complete: int
    last_updated: Optional[datetime] = None

    model_config = {"from_attributes": True}
