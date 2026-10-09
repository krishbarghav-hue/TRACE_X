from sqlalchemy import Column, BigInteger, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Topic(Base):
    """
    Maps to the 'topics' table in the trace_x database.
    Supports hierarchical topics (parent_topic_id -> topic_id).
    """
    __tablename__ = "topics"

    topic_id        = Column(BigInteger, primary_key=True, autoincrement=True)
    course_id       = Column(BigInteger, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    parent_topic_id = Column(BigInteger, ForeignKey("topics.topic_id", ondelete="SET NULL"), nullable=True)
    topic_name      = Column(String(150), nullable=False)
    description     = Column(Text, nullable=True)
    created_at      = Column(TIMESTAMP, server_default=func.now())
