import enum
from sqlalchemy import Column, BigInteger, String, Integer, TIMESTAMP, ForeignKey, Enum
from sqlalchemy.sql import func
from app.database import Base


class ResourceType(str, enum.Enum):
    youtube = "youtube"
    website = "website"
    article = "article"
    documentation = "documentation"
    pdf = "pdf"
    ppt = "ppt"
    note = "note"
    other = "other"


class Resource(Base):
    """
    Maps to the 'resources' table in the trace_x database.
    """
    __tablename__ = "resources"

    resource_id                = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id                    = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    course_id                  = Column(BigInteger, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=True)
    topic_id                   = Column(BigInteger, ForeignKey("topics.topic_id", ondelete="SET NULL"), nullable=True)
    resource_type              = Column(
        Enum(
            ResourceType,
            values_callable=lambda obj: [e.value for e in obj],
            native_enum=True
        ),
        nullable=False,
        default=ResourceType.website
    )
    title                      = Column(String(200), nullable=False)
    url                        = Column(String(1000), nullable=True)
    domain                     = Column(String(255), nullable=True)
    source                     = Column(String(50), default="browser_extension")
    first_seen                 = Column(TIMESTAMP, server_default=func.now())
    last_seen                  = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    visit_count                = Column(Integer, default=1)
    total_observed_seconds     = Column(Integer, default=0)
    estimated_duration_minutes = Column(Integer, nullable=True)
    created_at                 = Column(TIMESTAMP, server_default=func.now())
