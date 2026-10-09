from sqlalchemy import Column, BigInteger, String, Integer, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Document(Base):
    """
    Maps to the 'documents' table in the trace_x database.
    """
    __tablename__ = "documents"

    document_id      = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id          = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    course_id        = Column(BigInteger, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    topic_id         = Column(BigInteger, ForeignKey("topics.topic_id", ondelete="SET NULL"), nullable=True)
    resource_id      = Column(BigInteger, ForeignKey("resources.resource_id", ondelete="SET NULL"), nullable=True)
    file_name        = Column(String(255), nullable=False)
    stored_file_name = Column(String(255), nullable=False)
    file_type        = Column(String(20), nullable=False)
    file_size_bytes  = Column(BigInteger, nullable=False)
    storage_path     = Column(String(500), nullable=False)
    description      = Column(String(500), nullable=True)
    version          = Column(Integer, nullable=False, default=1)
    checksum_sha256  = Column(String(64), nullable=True)
    uploaded_at      = Column(TIMESTAMP, server_default=func.now())
    is_deleted       = Column(Boolean, default=False)
