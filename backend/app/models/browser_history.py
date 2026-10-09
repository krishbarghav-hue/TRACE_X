from sqlalchemy import Column, BigInteger, String, Integer, DateTime, TIMESTAMP, ForeignKey, Index
from sqlalchemy.sql import func
from app.database import Base


class BrowserHistory(Base):
    """
    Maps to the 'browser_history' table.
    Stores Chrome historical browser visits pulled via chrome.history API.
    This is SEPARATE from live activity tracking (activity_logs).

    Live activity = what TraceX observed while tracking (activity_logs table).
    Browser history = Chrome's historical visit records (this table).
    """
    __tablename__ = "browser_history"

    history_id       = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id          = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    url              = Column(String(1000), nullable=False)
    domain           = Column(String(255), nullable=False)
    title            = Column(String(500), nullable=True)
    visit_count      = Column(Integer, default=1)
    first_visit_time = Column(DateTime, nullable=True)
    last_visit_time  = Column(DateTime, nullable=True)
    source           = Column(String(32), default="chrome_history")
    created_at       = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (
        Index("idx_browser_history_user_last_visit", "user_id", "last_visit_time"),
        Index("idx_browser_history_domain", "domain"),
    )
