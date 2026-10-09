from sqlalchemy import Column, BigInteger, String, Integer, DateTime, TIMESTAMP, ForeignKey, Index, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class WebsiteUsage(Base):
    """
    Maps to the 'website_usage' table.
    Aggregated per-domain usage stats per user.
    Updated whenever a new activity_log is finalized.

    Used for fast dashboard analytics without scanning all activity_logs.
    DBMS: demonstrates GROUP BY aggregation, UPSERT, INDEX usage.
    """
    __tablename__ = "website_usage"

    usage_id      = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id       = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    domain        = Column(String(255), nullable=False)
    total_seconds = Column(BigInteger, default=0)
    visit_count   = Column(Integer, default=0)
    last_used     = Column(DateTime, nullable=True)
    created_at    = Column(TIMESTAMP, server_default=func.now())
    updated_at    = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "domain", name="uq_website_usage_user_domain"),
        Index("idx_website_usage_user_domain", "user_id", "domain"),
    )
