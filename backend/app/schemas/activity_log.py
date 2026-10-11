from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import Optional, Any


class ActivityLogCreate(BaseModel):
    """
    Schema for creating an activity log entry.

    event_id: Stable unique ID from the Chrome extension.
              Used to deduplicate retried/buffered events.
              If not provided, the backend stores the record without deduplication.
    source:   "chrome" (from Chrome extension) or "manual".
    """
    event_id: Optional[str] = Field(None, max_length=128, description="Unique event ID from extension (for deduplication)")
    source: Optional[str] = Field("chrome", max_length=32, description="Source of the activity: chrome, manual")
    url: str = Field(..., max_length=1000, description="Full webpage URL")
    domain: str = Field(..., max_length=255, description="Domain name (e.g. youtube.com)")
    tab_id: Optional[int] = Field(None, description="Browser tab ID")
    window_id: Optional[int] = Field(None, description="Browser window ID")
    title: Optional[str] = Field(None, description="Page title sent by extension")
    page_title: Optional[str] = Field(None, description="Database page title field")
    visit_time: Optional[datetime] = Field(None, description="Time the page was opened")
    exit_time: Optional[datetime] = Field(None, description="Time the page was closed or navigated away")
    started_at: Optional[datetime] = Field(None, description="Canonical start time")
    ended_at: Optional[datetime] = Field(None, description="Canonical end time")
    activity_type: Optional[str] = Field(None, description="browsing, coding, video, pdf")
    is_active: Optional[bool] = Field(None, description="Live activity status")
    duration_seconds: Optional[int] = Field(None, ge=0, description="Duration spent on page in seconds")
    course_id: Optional[int] = Field(None, description="Optional associated course ID")
    topic_id: Optional[int] = Field(None, description="Optional associated topic ID")
    resource_id: Optional[int] = Field(None, description="Optional associated resource ID")
    user_id: Optional[Any] = Field(None, description="Optional associated user ID (coerced safely)")
    is_classified: Optional[bool] = Field(False, description="Whether this activity was classified to a course/topic")

    @model_validator(mode="before")
    @classmethod
    def set_defaults_and_title(cls, values):
        if isinstance(values, dict):
            # 1. user_id: safely extract if client passed dict/object or string
            raw_user = values.get("user_id")
            if isinstance(raw_user, dict):
                values["user_id"] = raw_user.get("user_id") or raw_user.get("id") or None
            elif raw_user is not None:
                try:
                    values["user_id"] = int(raw_user)
                except (ValueError, TypeError):
                    values["user_id"] = None

            # 2. Canonical timestamps: bidirectionally map (started_at <-> visit_time) and (ended_at <-> exit_time)
            if values.get("started_at") and not values.get("visit_time"):
                values["visit_time"] = values["started_at"]
            elif values.get("visit_time") and not values.get("started_at"):
                values["started_at"] = values["visit_time"]

            if "ended_at" in values and values.get("ended_at") is not None and values.get("exit_time") is None:
                values["exit_time"] = values["ended_at"]
            elif "exit_time" in values and values.get("exit_time") is not None and values.get("ended_at") is None:
                values["ended_at"] = values["exit_time"]

            # If visit_time / started_at is still missing, default to now
            if not values.get("visit_time") and not values.get("started_at"):
                now = datetime.now()
                values["visit_time"] = now
                values["started_at"] = now

            # 3. duration_seconds validation: ensure non-negative int
            if values.get("duration_seconds") is not None:
                try:
                    values["duration_seconds"] = max(0, int(float(values["duration_seconds"])))
                except (ValueError, TypeError):
                    values["duration_seconds"] = 0

            # 4. Truncate / sanitize strings safely
            if values.get("title") and isinstance(values["title"], str):
                values["title"] = values["title"][:255]
            if values.get("page_title") and isinstance(values["page_title"], str):
                values["page_title"] = values["page_title"][:255]
            elif not values.get("page_title") and values.get("title"):
                values["page_title"] = values["title"]

            # Safe fallbacks for url & domain so invalid/empty tabs never trigger 422
            url_val = values.get("url")
            domain_val = values.get("domain")

            if not url_val and domain_val:
                values["url"] = f"https://{domain_val}"
            elif not url_val:
                values["url"] = "https://unknown.com"
            else:
                values["url"] = str(url_val)[:1000]

            if not domain_val:
                try:
                    from urllib.parse import urlparse
                    netloc = urlparse(values["url"]).netloc
                    if netloc.startswith("www."):
                        netloc = netloc[4:]
                    values["domain"] = (netloc or "unknown.com")[:255]
                except Exception:
                    values["domain"] = "unknown.com"
            else:
                values["domain"] = str(domain_val)[:255]

            # tab_id / window_id safe int coercion
            for fid in ("tab_id", "window_id"):
                if values.get(fid) is not None:
                    try:
                        values[fid] = int(values[fid])
                    except (ValueError, TypeError):
                        values[fid] = None

        return values


class ActivityLogResponse(BaseModel):
    activity_id: int
    event_id: Optional[str] = None
    source: Optional[str] = None
    user_id: int
    url: str
    domain: str
    page_title: Optional[str] = None
    visit_time: datetime
    exit_time: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    activity_type: Optional[str] = None
    is_active: Optional[bool] = None
    duration_seconds: Optional[int] = None
    course_id: Optional[int] = None
    topic_id: Optional[int] = None
    resource_id: Optional[int] = None
    is_classified: bool
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
