import enum
from sqlalchemy import Column, BigInteger, String, Integer, DateTime, TIMESTAMP, ForeignKey, Enum, FetchedValue
from sqlalchemy.sql import func
from app.database import Base


class StudyMode(str, enum.Enum):
    reading = "reading"
    video = "video"
    practice = "practice"
    revision = "revision"
    other = "other"


class StudySession(Base):
    """
    Maps to the 'study_sessions' table in the trace_x database.
    duration_minutes is a GENERATED STORED column in MySQL.
    """
    __tablename__ = "study_sessions"

    session_id       = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id          = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    course_id        = Column(BigInteger, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    topic_id         = Column(BigInteger, ForeignKey("topics.topic_id", ondelete="SET NULL"), nullable=True)
    resource_id      = Column(BigInteger, ForeignKey("resources.resource_id", ondelete="SET NULL"), nullable=True)
    start_time       = Column(DateTime, nullable=False)
    end_time         = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, FetchedValue(), nullable=True)
    study_mode       = Column(
        Enum(StudyMode, values_callable=lambda obj: [e.value for e in obj], native_enum=True),
        default=StudyMode.other
    )
    session_notes    = Column(String(500), nullable=True)
    created_at       = Column(TIMESTAMP, server_default=func.now())
