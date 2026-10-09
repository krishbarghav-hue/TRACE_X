from sqlalchemy import Column, BigInteger, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Course(Base):
    """
    Maps to the 'courses' table in the trace_x database.
    """
    __tablename__ = "courses"

    course_id   = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id     = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    course_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    created_at  = Column(TIMESTAMP, server_default=func.now())
