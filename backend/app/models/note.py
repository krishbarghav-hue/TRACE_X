from sqlalchemy import Column, BigInteger, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Note(Base):
    """
    Maps to the 'notes' table in the trace_x database.
    """
    __tablename__ = "notes"

    note_id          = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id          = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    course_id        = Column(BigInteger, nullable=False)
    topic_id         = Column(BigInteger, ForeignKey("topics.topic_id", ondelete="CASCADE"), nullable=False)
    resource_id      = Column(BigInteger, ForeignKey("resources.resource_id", ondelete="SET NULL"), nullable=True)
    study_session_id = Column(BigInteger, nullable=True)
    content          = Column(Text, nullable=False)
    created_at       = Column(TIMESTAMP, server_default=func.now())
    updated_at       = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
