from sqlalchemy import Column, BigInteger, String, Date, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Goal(Base):
    """
    Maps to the 'goals' table in the trace_x database.
    """
    __tablename__ = "goals"

    goal_id          = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id          = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    course_id        = Column(BigInteger, ForeignKey("courses.course_id", ondelete="SET NULL"), nullable=True)
    topic_id         = Column(BigInteger, ForeignKey("topics.topic_id", ondelete="SET NULL"), nullable=True)
    goal_description = Column(String(300), nullable=False)
    target_date      = Column(Date, nullable=False)
    is_achieved      = Column(Boolean, default=False)
    created_at       = Column(TIMESTAMP, server_default=func.now())
