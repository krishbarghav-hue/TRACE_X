import enum
from sqlalchemy import Column, BigInteger, Integer, TIMESTAMP, ForeignKey, Enum
from sqlalchemy.sql import func
from app.database import Base


class ProgressStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"


class Progress(Base):
    """
    Maps to the 'progress' table in the trace_x database.
    """
    __tablename__ = "progress"

    progress_id      = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id          = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    topic_id         = Column(BigInteger, ForeignKey("topics.topic_id", ondelete="CASCADE"), nullable=False)
    resource_id      = Column(BigInteger, ForeignKey("resources.resource_id", ondelete="CASCADE"), nullable=True)
    status           = Column(
        Enum(ProgressStatus, values_callable=lambda obj: [e.value for e in obj], native_enum=True),
        nullable=False,
        default=ProgressStatus.not_started
    )
    percent_complete = Column(Integer, default=0)
    last_updated     = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
