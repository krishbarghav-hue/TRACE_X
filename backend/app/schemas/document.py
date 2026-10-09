from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DocumentResponse(BaseModel):
    document_id: int
    user_id: int
    course_id: int
    topic_id: Optional[int] = None
    resource_id: Optional[int] = None
    file_name: str
    stored_file_name: str
    file_type: str
    file_size_bytes: int
    storage_path: str
    description: Optional[str] = None
    version: int
    checksum_sha256: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    is_deleted: bool

    model_config = {"from_attributes": True}
