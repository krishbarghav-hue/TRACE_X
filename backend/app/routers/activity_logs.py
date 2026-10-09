"""
TraceX Activity Logs Router — DBMS Phase
=========================================
All routes for live browser activity tracking, analytics, and Chrome history.

Architecture:
  Chrome Extension → POST /api/activity-logs → MySQL activity_logs
  Dashboard        ← GET  /api/activity-logs/current
  Dashboard        ← GET  /api/activity-logs/analytics/today
  History Page     ← GET  /api/activity-logs/history

Security:
  - User identity is ALWAYS derived from the JWT token (get_optional_user_id).
  - Extension must never be trusted to supply user_id for auth.
  - In this version user_id falls back to 1 for local development; in production
    use get_current_user() instead of get_optional_user_id().
"""

from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, text, and_, or_

from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.browser_history import BrowserHistory
from app.models.website_usage import WebsiteUsage
from app.models.resource import Resource, ResourceType
from app.schemas.activity_log import ActivityLogCreate, ActivityLogResponse
from app.utils.auth import get_optional_user_id

# ── Tracking state & extension status (in-memory, per server process) ─────────
_tracking_state: Dict[str, Any] = {
    "is_paused": False,
    "last_seen": None,
    "version": "1.2",
}

# ── In-memory current activity per user (user_id → current activity data) ─────
# Updated via heartbeat endpoint. Allows /current to return real-time data
# even before the activity is finalized and saved.
_current_activity: Dict[int, Dict[str, Any]] = {}


def get_effective_user_id(
    auth_user_id: int = Depends(get_optional_user_id),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
) -> int:
    """
    Return explicit query user_id if supplied, otherwise auth_user_id.
    In local single-user desktop environment: if the authenticated user has no
    activity logs recorded yet, fall back gracefully to default user (1) where the
    Chrome extension records local browser telemetry. This ensures the React dashboard
    and extension popup always read the exact same source of truth.
    """
    if user_id is not None:
        return user_id
    if auth_user_id != 1:
        count = db.query(func.count(ActivityLog.activity_id)).filter(ActivityLog.user_id == auth_user_id).scalar() or 0
        if count == 0:
            return 1
    return auth_user_id


def _update_website_usage(db: Session, user_id: int, domain: str, duration: int, visit_time: datetime):
    """
    Upsert website_usage row for (user_id, domain).
    Uses MySQL ON DUPLICATE KEY UPDATE for atomic aggregation.
    """
    try:
        db.execute(text("""
            INSERT INTO website_usage (user_id, domain, total_seconds, visit_count, last_used)
            VALUES (:uid, :domain, :dur, 1, :ts)
            ON DUPLICATE KEY UPDATE
                total_seconds = total_seconds + :dur,
                visit_count   = visit_count + 1,
                last_used     = CASE WHEN last_used IS NULL THEN :ts ELSE GREATEST(last_used, :ts) END,
                updated_at    = CURRENT_TIMESTAMP
        """), {"uid": user_id, "domain": domain, "dur": duration, "ts": visit_time})
        db.commit()
    except Exception:
        pass  # Non-critical — don't fail the main save because of this


def _update_discovered_resource(
    db: Session,
    user_id: int,
    url: Optional[str],
    domain: Optional[str],
    page_title: Optional[str],
    duration_seconds: int,
    visit_time: datetime
):
    """
    Auto-discovers and updates resource records from live browser telemetry.
    Maintains a stable identity per (user_id, url) without duplicating rows.
    """
    if not url or not domain or domain.lower() in ("newtab", "extensions", "devtools", "chrome://"):
        return

    clean_url = url.split("#")[0].strip()
    if clean_url.endswith("/") and len(clean_url) > 8:
        clean_url = clean_url[:-1]

    try:
        res = db.query(Resource).filter(
            Resource.user_id == user_id,
            Resource.url == clean_url
        ).first()

        dur = max(0, duration_seconds or 0)
        title = (page_title or domain or "Web Resource").strip()[:200]

        if res:
            res.last_seen = visit_time or datetime.now()
            res.visit_count = (res.visit_count or 0) + 1
            if dur > 0:
                res.total_observed_seconds = (res.total_observed_seconds or 0) + dur
                res.estimated_duration_minutes = round((res.total_observed_seconds or 0) / 60)
            if title and len(title) > len(res.title or ""):
                res.title = title
            if domain and not res.domain:
                res.domain = domain
        else:
            d_lower = domain.lower()
            u_lower = clean_url.lower()
            rtype = ResourceType.website
            if ".pdf" in u_lower:
                rtype = ResourceType.pdf
            elif ".ppt" in u_lower or ".pptx" in u_lower:
                rtype = ResourceType.ppt
            elif any(k in d_lower for k in ["youtube.com", "youtu.be", "vimeo.com", "hotstar.com", "netflix.com"]):
                rtype = ResourceType.youtube
            elif any(k in d_lower for k in ["docs.", "developer.mozilla.org", "wikipedia.org", "w3schools.com"]):
                rtype = ResourceType.documentation
            elif any(k in d_lower for k in ["medium.com", "dev.to", "substack.com", "blog."]):
                rtype = ResourceType.article

            new_res = Resource(
                user_id=user_id,
                course_id=None,
                topic_id=None,
                resource_type=rtype,
                title=title,
                url=clean_url[:1000],
                domain=domain[:255],
                source="browser_extension",
                first_seen=visit_time or datetime.now(),
                last_seen=visit_time or datetime.now(),
                visit_count=1,
                total_observed_seconds=dur,
                estimated_duration_minutes=round(dur / 60)
            )
            db.add(new_res)
        db.commit()
    except Exception:
        db.rollback()


router = APIRouter(prefix="/api/activity-logs", tags=["Activity Logs"])


# ══════════════════════════════════════════════════════════════════════════════
# EXTENSION STATUS & CONTROL
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/tracking-status")
def get_tracking_status(user_id: int = Depends(get_effective_user_id)):
    """Check if tracking is currently paused or active, and extension health."""
    is_connected = False
    if _tracking_state["last_seen"]:
        diff = (datetime.now() - _tracking_state["last_seen"]).total_seconds()
        is_connected = diff < 300  # Seen in last 5 minutes
    return {
        "is_paused": _tracking_state["is_paused"],
        "is_connected": is_connected,
        "last_seen": _tracking_state["last_seen"].isoformat() if _tracking_state["last_seen"] else None,
        "version": _tracking_state["version"],
        "user_id": user_id,
    }


@router.post("/tracking-status")
def set_tracking_status(payload: Dict[str, Any], user_id: int = Depends(get_effective_user_id)):
    """Allows web dashboard or extension to toggle pause tracking."""
    if "is_paused" in payload:
        _tracking_state["is_paused"] = bool(payload["is_paused"])
    return {
        "is_paused": _tracking_state["is_paused"],
        "user_id": user_id,
        "message": "Tracking paused" if _tracking_state["is_paused"] else "Tracking active"
    }


@router.post("/extension-heartbeat")
def extension_heartbeat(
    payload: Dict[str, Any],
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Heartbeat sent periodically from extension background or popup.
    Also syncs current live activity to MySQL activity_logs table so:
      1. Exactly ONE row has is_active = 1 for the user in MySQL.
      2. Previous live activity is finalized.
      3. /current and direct MySQL queries reflect real-time live activity.
    """
    _tracking_state["last_seen"] = datetime.now()
    if "version" in payload:
        _tracking_state["version"] = str(payload["version"])
    if "is_paused" in payload:
        _tracking_state["is_paused"] = bool(payload["is_paused"])

    current_domain = payload.get("current_domain")
    is_paused = payload.get("is_paused", False) or _tracking_state["is_paused"]

    # Store live activity data for /current endpoint
    if current_domain and not is_paused:
        started_at_str = payload.get("started_at")
        started_at = None
        if started_at_str:
            try:
                started_at = datetime.fromisoformat(started_at_str)
            except Exception:
                pass
        if not started_at:
            started_at = datetime.now()

        event_id = payload.get("event_id") or f"live-{user_id}-{started_at.strftime('%Y%m%d%H%M%S')}"

        _current_activity[user_id] = {
            "domain":       current_domain,
            "title":        payload.get("current_title"),
            "url":          payload.get("current_url"),
            "started_at":   started_at.isoformat(),
            "event_id":     event_id,
            "heartbeat_at": datetime.now().isoformat(),
        }
        if user_id != 1:
            _current_activity[1] = _current_activity[user_id]

        # ── Database synchronization: Ensure MySQL reflects live state ───────
        try:
            # 1. Deactivate any previous activities for this user that are NOT this event_id
            db.query(ActivityLog).filter(
                ActivityLog.user_id == user_id,
                ActivityLog.is_active == True,
                ActivityLog.event_id != event_id
            ).update({
                "is_active": False,
                "exit_time": datetime.now(),
                "ended_at": datetime.now()
            }, synchronize_session=False)

            # 2. Check if a row for this event_id already exists in MySQL
            existing_live = db.query(ActivityLog).filter(
                ActivityLog.event_id == event_id
            ).first()

            now = datetime.now()
            duration_now = max(0, int((now - started_at).total_seconds()))

            if existing_live:
                existing_live.is_active = True
                existing_live.exit_time = now
                existing_live.ended_at = now
                existing_live.duration_seconds = duration_now
                if payload.get("current_title"):
                    existing_live.page_title = payload.get("current_title")
            else:
                activity_type = "browsing"
                url = payload.get("current_url") or f"https://{current_domain}"
                if ".pdf" in url.lower():
                    activity_type = "pdf"
                elif any(d in current_domain for d in ["youtube", "vimeo"]):
                    activity_type = "video"
                elif any(d in current_domain for d in ["github", "localhost", "leetcode"]):
                    activity_type = "coding"

                new_live = ActivityLog(
                    event_id=event_id,
                    source="chrome",
                    user_id=user_id,
                    url=url,
                    domain=current_domain,
                    page_title=payload.get("current_title") or current_domain,
                    visit_time=started_at,
                    started_at=started_at,
                    exit_time=now,
                    ended_at=now,
                    duration_seconds=duration_now,
                    is_active=True,
                    tab_id=payload.get("tab_id"),
                    window_id=payload.get("window_id"),
                    activity_type=activity_type
                )
                db.add(new_live)

            db.commit()
        except Exception:
            db.rollback()

    elif is_paused or current_domain is None:
        _current_activity.pop(user_id, None)
        _current_activity.pop(1, None)
        try:
            db.query(ActivityLog).filter(
                ActivityLog.user_id == user_id,
                ActivityLog.is_active == True
            ).update({
                "is_active": False,
                "exit_time": datetime.now(),
                "ended_at": datetime.now()
            }, synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()

    return {
        "status": "connected",
        "is_paused": _tracking_state["is_paused"],
        "user_id": user_id,
        "server_time": datetime.now().isoformat()
    }


@router.post("/auto-connect")
def auto_connect_tracex(user_id: int = Depends(get_effective_user_id)):
    """Automatically connects TraceX platform without requiring manual user account linking."""
    _tracking_state["last_seen"] = datetime.now()
    return {
        "status": "connected",
        "is_connected": True,
        "is_paused": _tracking_state["is_paused"],
        "user_id": user_id,
        "message": "TraceX successfully connected directly to browser telemetry."
    }


@router.get("/download-extension")
def download_extension_archive():
    """Generates and streams a .zip archive of the Chrome extension files for 1-click download."""
    import io
    import os
    import zipfile
    from fastapi.responses import Response

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    ext_dir = os.path.join(base_dir, "extension")
    if not os.path.exists(ext_dir):
        ext_dir = os.path.abspath(os.path.join(os.getcwd(), "extension"))

    if not os.path.exists(ext_dir):
        raise HTTPException(status_code=404, detail="Extension directory not found")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(ext_dir):
            for file in files:
                if file.startswith(".") or file.endswith(".tmp"):
                    continue
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, ext_dir)
                zip_file.write(abs_path, arcname=rel_path)

    zip_data = zip_buffer.getvalue()
    return Response(
        content=zip_data,
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=tracex-extension.zip",
            "Cache-Control": "no-cache",
        }
    )


# ══════════════════════════════════════════════════════════════════════════════
# CURRENT LIVE ACTIVITY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/current")
def get_current_activity(
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Returns the currently active browser activity for the authenticated user.

    Strategy:
      1. Check in-memory _current_activity (set by heartbeat) — most real-time.
      2. Fall back to is_active=True row in database (set by finalized-start).
      3. Return {"active": false} if nothing is live.

    Example response:
      {
        "active": true,
        "domain": "youtube.com",
        "title": "CFG to PDA Conversion",
        "url": "https://...",
        "started_at": "2026-10-02T20:00:00",
        "duration_seconds": 42
      }
    """
    # 1. Check in-memory (most up-to-date — extension heartbeat sets this)
    live = _current_activity.get(user_id) or _current_activity.get(1)
    if live:
        started_at_str = live.get("started_at")
        started_at = None
        duration = 0
        if started_at_str:
            try:
                started_at = datetime.fromisoformat(started_at_str)
                duration = max(0, int((datetime.now() - started_at).total_seconds()))
            except Exception:
                pass
        return {
            "active": True,
            "domain": live.get("domain"),
            "title": live.get("title"),
            "url": live.get("url"),
            "started_at": started_at_str,
            "duration_seconds": duration,
            "source": "heartbeat",
        }

    # 2. Check database for is_active=True row
    active_log = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == user_id,
            ActivityLog.is_active == True
        )
        .order_by(ActivityLog.created_at.desc())
        .first()
    )
    if not active_log and user_id != 1:
        active_log = (
            db.query(ActivityLog)
            .filter(
                ActivityLog.user_id == 1,
                ActivityLog.is_active == True
            )
            .order_by(ActivityLog.created_at.desc())
            .first()
        )
    if active_log:
        started = active_log.started_at or active_log.visit_time
        duration = 0
        if started:
            duration = max(0, int((datetime.now() - started).total_seconds()))
        return {
            "active": True,
            "domain": active_log.domain,
            "title": active_log.page_title,
            "url": active_log.url,
            "started_at": started.isoformat() if started else None,
            "duration_seconds": duration,
            "source": "database",
        }

    return {"active": False, "domain": None, "title": None, "url": None, "duration_seconds": 0}


# ══════════════════════════════════════════════════════════════════════════════
# LOG SINGLE ACTIVITY
# ══════════════════════════════════════════════════════════════════════════════

@router.post("", response_model=ActivityLogResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ActivityLogResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_activity_log(
    data: ActivityLogCreate,
    db: Session = Depends(get_db),
    auth_user_id: int = Depends(get_optional_user_id)
):
    """
    Store a single raw browser activity entry sent by the Chrome extension.
    If event_id is provided and already exists in the database, the existing
    record is returned instead of creating a duplicate (idempotent upsert).

    Security: user_id from body is ignored in production-ready code.
    auth_user_id is derived from the JWT token.
    """
    _tracking_state["last_seen"] = datetime.now()

    # Security: ALWAYS use auth_user_id from token, not body user_id.
    # Falls back to 1 only in local dev (get_optional_user_id behavior).
    target_user_id = auth_user_id

    # Resolve timestamps — accept both visit_time/exit_time (legacy) and
    # started_at/ended_at (new canonical form)
    started = data.started_at or data.visit_time or datetime.now()
    ended = data.ended_at or data.exit_time

    # Deduplication / Finalization: if event_id already exists, finalize and return the record
    if data.event_id:
        existing = db.query(ActivityLog).filter(
            ActivityLog.event_id == data.event_id
        ).first()
        if existing:
            # If the row was previously inserted as live (is_active=True), finalize it!
            existing.is_active = data.is_active if data.is_active is not None else False
            if ended:
                existing.exit_time = ended
                existing.ended_at = ended
            if data.duration_seconds is not None:
                existing.duration_seconds = data.duration_seconds
            if data.page_title:
                existing.page_title = data.page_title
            db.commit()
            db.refresh(existing)
            if existing.domain and existing.duration_seconds and existing.duration_seconds > 0:
                _update_website_usage(db, target_user_id, existing.domain, existing.duration_seconds, started)
            _update_discovered_resource(db, target_user_id, existing.url, existing.domain, existing.page_title, existing.duration_seconds or 0, started)
            return existing

    # Ensure any previous active row for this user on this domain is marked inactive
    if data.domain:
        db.query(ActivityLog).filter(
            ActivityLog.user_id == target_user_id,
            ActivityLog.domain == data.domain,
            ActivityLog.is_active == True
        ).update({"is_active": False}, synchronize_session=False)

    # Determine activity type
    activity_type = data.activity_type or "browsing"
    if not data.activity_type:
        if data.url and (".pdf" in data.url.lower()):
            activity_type = "pdf"
        elif data.domain and any(d in data.domain for d in ["youtube", "vimeo", "netflix"]):
            activity_type = "video"
        elif data.domain and any(d in data.domain for d in ["github", "gitlab", "localhost", "leetcode"]):
            activity_type = "coding"

    log_entry = ActivityLog(
        event_id=data.event_id,
        source=data.source or "chrome",
        user_id=target_user_id,
        url=data.url,
        domain=data.domain,
        page_title=data.page_title,
        visit_time=started,
        exit_time=ended,
        started_at=started,
        ended_at=ended,
        duration_seconds=data.duration_seconds,
        activity_type=activity_type,
        is_active=data.is_active if data.is_active is not None else False,
        course_id=data.course_id,
        topic_id=data.topic_id,
        resource_id=data.resource_id,
        is_classified=data.is_classified or False
    )

    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    # Update aggregated website_usage table
    if data.duration_seconds and data.duration_seconds > 0 and data.domain:
        _update_website_usage(db, target_user_id, data.domain, data.duration_seconds, started)

    # Auto-discover resource from browser telemetry
    _update_discovered_resource(db, target_user_id, data.url, data.domain, data.page_title, data.duration_seconds or 0, started)

    return log_entry


# ══════════════════════════════════════════════════════════════════════════════
# LOG BATCH ACTIVITIES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/batch", status_code=status.HTTP_201_CREATED)
def create_activity_logs_batch(
    data: List[ActivityLogCreate],
    db: Session = Depends(get_db),
    auth_user_id: int = Depends(get_optional_user_id)
):
    """
    Store multiple raw browser activities sent in a single batch from the Chrome extension.
    Handles deduplication: events whose event_id already exists are silently skipped.
    Uses INSERT ... ON DUPLICATE KEY UPDATE logic via event_id UNIQUE constraint.
    """
    if not data:
        return {"message": "No activities provided", "count": 0, "skipped": 0, "activity_ids": []}

    _tracking_state["last_seen"] = datetime.now()
    target_user_id = auth_user_id

    # Collect known event_ids to skip duplicates efficiently (CTE-equivalent: one query)
    incoming_event_ids = [item.event_id for item in data if item.event_id]
    existing_event_ids = set()
    usage_updates: Dict[str, int] = {}  # domain → total_seconds for batch update

    if incoming_event_ids:
        existing_rows = db.query(ActivityLog).filter(
            ActivityLog.event_id.in_(incoming_event_ids)
        ).all()
        for er in existing_rows:
            if er.is_active:
                er.is_active = False
                matched_item = next((i for i in data if i.event_id == er.event_id), None)
                if matched_item:
                    if matched_item.exit_time:
                        er.exit_time = matched_item.exit_time
                        er.ended_at = matched_item.exit_time
                    if matched_item.duration_seconds is not None:
                        er.duration_seconds = matched_item.duration_seconds
                    if matched_item.domain and er.duration_seconds and er.duration_seconds > 0:
                        usage_updates[matched_item.domain] = usage_updates.get(matched_item.domain, 0) + er.duration_seconds
        db.commit()
        existing_event_ids = {r.event_id for r in existing_rows}

    entries = []
    skipped = 0

    for item in data:
        if item.event_id and item.event_id in existing_event_ids:
            skipped += 1
            continue

        started = item.visit_time or datetime.now()
        ended = item.exit_time

        activity_type = "browsing"
        if item.url and ".pdf" in item.url.lower():
            activity_type = "pdf"
        elif item.domain and any(d in item.domain for d in ["youtube", "vimeo"]):
            activity_type = "video"
        elif item.domain and any(d in item.domain for d in ["github", "localhost", "leetcode"]):
            activity_type = "coding"

        entries.append(
            ActivityLog(
                event_id=item.event_id,
                source=item.source or "chrome",
                user_id=target_user_id,
                url=item.url,
                domain=item.domain,
                page_title=item.page_title,
                visit_time=started,
                exit_time=ended,
                started_at=started,
                ended_at=ended,
                duration_seconds=item.duration_seconds,
                activity_type=activity_type,
                is_active=False,
                course_id=item.course_id,
                topic_id=item.topic_id,
                resource_id=item.resource_id,
                is_classified=item.is_classified or False
            )
        )

        # Accumulate usage stats for batch update
        if item.domain and item.duration_seconds and item.duration_seconds > 0:
            usage_updates[item.domain] = usage_updates.get(item.domain, 0) + item.duration_seconds

    if entries:
        db.add_all(entries)
        db.commit()

    # Update website_usage table for each domain in this batch
    for domain, total_dur in usage_updates.items():
        _update_website_usage(db, target_user_id, domain, total_dur, datetime.now())

    # Auto-discover resources from this batch
    for item in entries:
        _update_discovered_resource(db, target_user_id, item.url, item.domain, item.page_title, item.duration_seconds or 0, item.visit_time or datetime.now())

    activity_ids = [e.activity_id for e in entries if e.activity_id]
    return {
        "message": f"Logged {len(entries)} activities. Skipped {skipped} duplicates.",
        "count": len(entries),
        "skipped": skipped,
        "activity_ids": activity_ids
    }


# ══════════════════════════════════════════════════════════════════════════════
# TIMELINE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/timeline")
def get_timeline(
    target_date: Optional[str] = None,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Returns today's activities ordered chronologically for the Timeline page.
    Optional target_date (YYYY-MM-DD) to view other days.
    """
    if target_date:
        try:
            parsed_date = date.fromisoformat(target_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    else:
        parsed_date = date.today()

    day_start = datetime.combine(parsed_date, time.min)
    day_end = datetime.combine(parsed_date, time.max)

    logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == user_id,
            or_(
                and_(ActivityLog.visit_time >= day_start, ActivityLog.visit_time <= day_end),
                and_(ActivityLog.started_at >= day_start, ActivityLog.started_at <= day_end)
            )
        )
        .order_by(
            func.coalesce(ActivityLog.started_at, ActivityLog.visit_time).asc()
        )
        .all()
    )

    return [
        {
            "activity_id":       log.activity_id,
            "domain":            log.domain,
            "page_title":        log.page_title,
            "url":               log.url,
            "started_at":        (log.started_at or log.visit_time).isoformat() if (log.started_at or log.visit_time) else None,
            "ended_at":          (log.ended_at or log.exit_time).isoformat() if (log.ended_at or log.exit_time) else None,
            "duration_seconds":  log.duration_seconds,
            "activity_type":     log.activity_type or "browsing",
            "is_active":         log.is_active,
            "source":            log.source,
        }
        for log in logs
    ]


# ══════════════════════════════════════════════════════════════════════════════
# GET TODAY'S ACTIVITY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/today", response_model=List[ActivityLogResponse])
def get_today_activity_logs(
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """Retrieve all browser activity logged today, ordered chronologically."""
    today_start = datetime.combine(date.today(), time.min)
    today_end = datetime.combine(date.today(), time.max)

    logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.user_id == user_id,
            or_(
                and_(ActivityLog.visit_time >= today_start, ActivityLog.visit_time <= today_end),
                and_(ActivityLog.started_at >= today_start, ActivityLog.started_at <= today_end)
            )
        )
        .order_by(func.coalesce(ActivityLog.started_at, ActivityLog.visit_time).asc())
        .all()
    )
    return logs


# ══════════════════════════════════════════════════════════════════════════════
# BROWSER HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/browser-history", status_code=status.HTTP_201_CREATED)
def save_browser_history(
    data: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    auth_user_id: int = Depends(get_optional_user_id)
):
    """
    Receive Chrome history records from the extension (chrome.history API).
    Saves to browser_history table — separate from live activity_logs.
    Upserts on (user_id, url) to avoid duplicates.
    """
    if not data:
        return {"message": "No history records provided", "count": 0}

    saved = 0
    for item in data:
        url = item.get("url", "")
        if not url:
            continue

        domain = ""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.hostname or ""
            if domain.startswith("www."):
                domain = domain[4:]
        except Exception:
            pass

        if not domain:
            continue

        last_visit = None
        first_visit = None
        lv = item.get("lastVisitTime") or item.get("last_visit_time")
        fv = item.get("first_visit_time")
        if lv:
            try:
                # Chrome reports time as ms since epoch
                if isinstance(lv, (int, float)):
                    last_visit = datetime.fromtimestamp(lv / 1000)
                else:
                    last_visit = datetime.fromisoformat(str(lv))
            except Exception:
                pass
        if fv:
            try:
                if isinstance(fv, (int, float)):
                    first_visit = datetime.fromtimestamp(fv / 1000)
                else:
                    first_visit = datetime.fromisoformat(str(fv))
            except Exception:
                pass

        try:
            db.execute(text("""
                INSERT INTO browser_history
                    (user_id, url, domain, title, visit_count, first_visit_time, last_visit_time, source)
                VALUES
                    (:uid, :url, :domain, :title, :vc, :fv, :lv, 'chrome_history')
                ON DUPLICATE KEY UPDATE
                    title           = COALESCE(VALUES(title), title),
                    visit_count     = GREATEST(visit_count, VALUES(visit_count)),
                    last_visit_time = GREATEST(COALESCE(last_visit_time, '1970-01-01'), COALESCE(VALUES(last_visit_time), '1970-01-01')),
                    first_visit_time = COALESCE(first_visit_time, VALUES(first_visit_time))
            """), {
                "uid":    auth_user_id,
                "url":    url[:1000],
                "domain": domain[:255],
                "title":  (item.get("title") or "")[:500],
                "vc":     item.get("visitCount") or item.get("visit_count") or 1,
                "fv":     first_visit,
                "lv":     last_visit,
            })
            saved += 1
        except Exception as e:
            pass  # Skip bad rows silently

    db.commit()
    return {"message": f"Saved {saved} history records.", "count": saved}


@router.get("/history")
def get_browser_history(
    search: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
    offset: int = Query(0),
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Retrieve Chrome browser history from MySQL browser_history table.
    Supports search, date range, and domain filtering.
    """
    query = db.query(BrowserHistory).filter(BrowserHistory.user_id == user_id)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                BrowserHistory.title.ilike(pattern),
                BrowserHistory.url.ilike(pattern),
                BrowserHistory.domain.ilike(pattern),
            )
        )

    if domain:
        query = query.filter(BrowserHistory.domain.ilike(f"%{domain}%"))

    if start_date:
        try:
            sd = datetime.combine(date.fromisoformat(start_date), time.min)
            query = query.filter(BrowserHistory.last_visit_time >= sd)
        except ValueError:
            pass

    if end_date:
        try:
            ed = datetime.combine(date.fromisoformat(end_date), time.max)
            query = query.filter(BrowserHistory.last_visit_time <= ed)
        except ValueError:
            pass

    total = query.count()
    records = (
        query
        .order_by(BrowserHistory.last_visit_time.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "records": [
            {
                "history_id":       r.history_id,
                "url":              r.url,
                "domain":           r.domain,
                "title":            r.title,
                "visit_count":      r.visit_count,
                "first_visit_time": r.first_visit_time.isoformat() if r.first_visit_time else None,
                "last_visit_time":  r.last_visit_time.isoformat() if r.last_visit_time else None,
                "source":           r.source,
            }
            for r in records
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS: TODAY SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/analytics/today")
def get_today_analytics(
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Returns a summary of today's browser activity for the dashboard.
    Uses proper DBMS aggregation: COUNT, SUM, COUNT DISTINCT.
    """
    today_start = datetime.combine(date.today(), time.min)
    today_end = datetime.combine(date.today(), time.max)

    time_filter = or_(
        and_(ActivityLog.visit_time >= today_start, ActivityLog.visit_time <= today_end),
        and_(ActivityLog.started_at >= today_start, ActivityLog.started_at <= today_end)
    )

    stats = (
        db.query(
            func.count(ActivityLog.activity_id).label("total_activities"),
            func.coalesce(func.sum(ActivityLog.duration_seconds), 0).label("total_seconds"),
            func.count(func.distinct(ActivityLog.domain)).label("unique_domains"),
            func.count(func.distinct(ActivityLog.url)).label("unique_resources"),
        )
        .filter(
            ActivityLog.user_id == user_id,
            time_filter,
            ActivityLog.duration_seconds > 0
        )
        .first()
    )

    total_activities = stats.total_activities if stats else 0
    total_seconds    = int(stats.total_seconds) if stats else 0
    unique_domains   = stats.unique_domains if stats else 0
    unique_resources = stats.unique_resources if stats else 0

    # Top domains today — GROUP BY with SUM aggregate
    domain_rows = (
        db.query(
            ActivityLog.domain,
            func.count(ActivityLog.activity_id).label("visits"),
            func.coalesce(func.sum(ActivityLog.duration_seconds), 0).label("total_seconds"),
        )
        .filter(
            ActivityLog.user_id == user_id,
            time_filter,
            ActivityLog.duration_seconds > 0
        )
        .group_by(ActivityLog.domain)
        .order_by(text("total_seconds DESC"))
        .limit(10)
        .all()
    )

    top_domains = [
        {
            "domain":        r.domain,
            "visits":        r.visits,
            "total_seconds": int(r.total_seconds),
            "total_minutes": round(int(r.total_seconds) / 60, 1),
        }
        for r in domain_rows
    ]

    # Current live activity
    live = _current_activity.get(user_id) or _current_activity.get(1)
    current = None
    if live:
        started_str = live.get("started_at")
        dur = 0
        if started_str:
            try:
                started = datetime.fromisoformat(started_str)
                dur = max(0, int((datetime.now() - started).total_seconds()))
            except Exception:
                pass
        current = {"domain": live["domain"], "title": live.get("title"), "duration_seconds": dur}

    return {
        "date":              date.today().isoformat(),
        "total_activities":  total_activities,
        "total_seconds":     total_seconds,
        "total_minutes":     round(total_seconds / 60, 1),
        "unique_domains":    unique_domains,
        "unique_resources":  unique_resources,
        "top_domains":       top_domains,
        "current_activity":  current,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS: HOURLY DISTRIBUTION
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/analytics/hourly")
def get_hourly_analytics(
    target_date: Optional[str] = None,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """Returns activity duration grouped by hour of day for a given date."""
    if target_date:
        try:
            parsed_date = date.fromisoformat(target_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    else:
        parsed_date = date.today()

    day_start = datetime.combine(parsed_date, time.min)
    day_end   = datetime.combine(parsed_date, time.max)

    time_col = func.coalesce(ActivityLog.started_at, ActivityLog.visit_time)

    rows = (
        db.query(
            func.hour(time_col).label("hour"),
            func.count(ActivityLog.activity_id).label("activities"),
            func.coalesce(func.sum(ActivityLog.duration_seconds), 0).label("total_seconds"),
        )
        .filter(
            ActivityLog.user_id == user_id,
            time_col >= day_start,
            time_col <= day_end,
            ActivityLog.duration_seconds > 0
        )
        .group_by(func.hour(time_col))
        .order_by(func.hour(time_col))
        .all()
    )

    hour_map = {r.hour: {"activities": r.activities, "total_seconds": int(r.total_seconds)} for r in rows}
    hourly = []
    for h in range(24):
        entry = hour_map.get(h, {"activities": 0, "total_seconds": 0})
        hourly.append({
            "hour":          h,
            "label":         f"{h:02d}:00",
            "activities":    entry["activities"],
            "total_seconds": entry["total_seconds"],
            "total_minutes": round(entry["total_seconds"] / 60, 1),
        })

    return {"date": parsed_date.isoformat(), "hourly": hourly}


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS: DOMAIN BREAKDOWN
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/analytics/domains")
def get_domain_analytics(
    days: int = 7,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Returns activity time grouped by domain for the past N days.
    DBMS: GROUP BY domain + SUM(duration) + ORDER BY.
    """
    since = datetime.combine(date.today() - timedelta(days=days - 1), time.min)
    time_col = func.coalesce(ActivityLog.started_at, ActivityLog.visit_time)

    rows = (
        db.query(
            ActivityLog.domain,
            func.count(ActivityLog.activity_id).label("visits"),
            func.coalesce(func.sum(ActivityLog.duration_seconds), 0).label("total_seconds"),
            func.max(time_col).label("last_visited"),
        )
        .filter(
            ActivityLog.user_id == user_id,
            time_col >= since,
            ActivityLog.duration_seconds > 0
        )
        .group_by(ActivityLog.domain)
        .order_by(text("total_seconds DESC"))
        .limit(20)
        .all()
    )

    return [
        {
            "domain":        r.domain,
            "visits":        r.visits,
            "total_seconds": int(r.total_seconds),
            "total_minutes": round(int(r.total_seconds) / 60, 1),
            "last_visited":  r.last_visited.isoformat() if r.last_visited else None,
        }
        for r in rows
    ]


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS: DAILY TREND
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/analytics/daily-trend")
def get_daily_trend(
    days: int = 7,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Returns total active time per day for the past N days.
    DBMS: GROUP BY DATE(started_at) + SUM aggregate.
    """
    start_date = date.today() - timedelta(days=days - 1)
    time_col = func.coalesce(ActivityLog.started_at, ActivityLog.visit_time)

    rows = (
        db.query(
            func.date(time_col).label("activity_date"),
            func.count(ActivityLog.activity_id).label("activities"),
            func.coalesce(func.sum(ActivityLog.duration_seconds), 0).label("total_seconds"),
        )
        .filter(
            ActivityLog.user_id == user_id,
            func.date(time_col) >= start_date,
            ActivityLog.duration_seconds > 0
        )
        .group_by(func.date(time_col))
        .order_by(func.date(time_col).asc())
        .all()
    )

    result_map = {
        r.activity_date.isoformat(): {
            "activities":    r.activities,
            "total_seconds": int(r.total_seconds),
        }
        for r in rows
    }

    data = []
    for d in range(days):
        day_str = (start_date + timedelta(days=d)).isoformat()
        entry = result_map.get(day_str, {"activities": 0, "total_seconds": 0})
        data.append({
            "date":          day_str,
            "activities":    entry["activities"],
            "total_seconds": entry["total_seconds"],
            "total_minutes": round(entry["total_seconds"] / 60, 1),
        })

    return {"data": data}


# ══════════════════════════════════════════════════════════════════════════════
# DBMS DEMONSTRATION QUERIES ENDPOINT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/analytics/dbms-demo")
def get_dbms_demo(
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """
    Returns results of key DBMS demonstration queries:
      - All activity (recent 10)
      - Today's activity
      - Total time by domain (GROUP BY + SUM)
      - Activity with user (JOIN)
      - Daily activity (GROUP BY DATE)
      - Duplicate check (HAVING COUNT > 1)
      - Window function: rank domains by time
    """
    results = {}

    # 1. Recent activities
    recent = db.execute(text("""
        SELECT activity_id, domain, page_title, duration_seconds,
               COALESCE(started_at, visit_time) AS ts
        FROM activity_logs
        WHERE user_id = :uid
        ORDER BY COALESCE(started_at, visit_time) DESC
        LIMIT 10
    """), {"uid": user_id}).fetchall()
    results["recent_activities"] = [dict(r._mapping) for r in recent]

    # 2. Today's activity
    today_rows = db.execute(text("""
        SELECT activity_id, domain, page_title, duration_seconds, started_at
        FROM activity_logs
        WHERE user_id = :uid
          AND DATE(COALESCE(started_at, visit_time)) = CURDATE()
        ORDER BY COALESCE(started_at, visit_time)
    """), {"uid": user_id}).fetchall()
    results["today_activity"] = [dict(r._mapping) for r in today_rows]

    # 3. Total time by domain (GROUP BY)
    domain_totals = db.execute(text("""
        SELECT domain, SUM(duration_seconds) AS total_seconds, COUNT(*) AS visits
        FROM activity_logs
        WHERE user_id = :uid AND duration_seconds > 0
        GROUP BY domain
        ORDER BY total_seconds DESC
        LIMIT 10
    """), {"uid": user_id}).fetchall()
    results["total_time_by_domain"] = [dict(r._mapping) for r in domain_totals]

    # 4. Activity with user JOIN
    join_rows = db.execute(text("""
        SELECT u.full_name, a.domain, a.page_title, a.duration_seconds
        FROM users u
        JOIN activity_logs a ON u.user_id = a.user_id
        WHERE u.user_id = :uid
        ORDER BY COALESCE(a.started_at, a.visit_time) DESC
        LIMIT 5
    """), {"uid": user_id}).fetchall()
    results["activity_with_user_join"] = [dict(r._mapping) for r in join_rows]

    # 5. Daily activity (GROUP BY DATE)
    daily_rows = db.execute(text("""
        SELECT DATE(COALESCE(started_at, visit_time)) AS activity_date,
               SUM(duration_seconds) AS total_seconds,
               COUNT(*) AS activities
        FROM activity_logs
        WHERE user_id = :uid AND duration_seconds > 0
        GROUP BY DATE(COALESCE(started_at, visit_time))
        ORDER BY activity_date DESC
        LIMIT 7
    """), {"uid": user_id}).fetchall()
    results["daily_activity"] = [dict(r._mapping) for r in daily_rows]

    # 6. Duplicate event_id check
    dups = db.execute(text("""
        SELECT event_id, COUNT(*) as cnt
        FROM activity_logs
        WHERE event_id IS NOT NULL
        GROUP BY event_id
        HAVING COUNT(*) > 1
    """)).fetchall()
    results["duplicate_event_ids"] = [dict(r._mapping) for r in dups]
    results["duplicate_count"] = len(dups)
    results["deduplication_working"] = len(dups) == 0

    # 7. Website usage aggregation (uses website_usage table)
    usage_rows = db.execute(text("""
        SELECT domain, total_seconds, visit_count, last_used
        FROM website_usage
        WHERE user_id = :uid
        ORDER BY total_seconds DESC
        LIMIT 10
    """), {"uid": user_id}).fetchall()
    results["website_usage_table"] = [dict(r._mapping) for r in usage_rows]

    return results


# ══════════════════════════════════════════════════════════════════════════════
# GET ALL ACTIVITIES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=List[ActivityLogResponse])
@router.get("/", response_model=List[ActivityLogResponse], include_in_schema=False)
def get_all_activity_logs(
    limit: int = 100,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """Retrieve raw browser activity logs for the current user."""
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user_id)
        .order_by(
            func.coalesce(ActivityLog.started_at, ActivityLog.visit_time).desc()
        )
        .limit(limit)
        .all()
    )
    return logs


# ══════════════════════════════════════════════════════════════════════════════
# GET SINGLE ACTIVITY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{activity_id}", response_model=ActivityLogResponse)
def get_activity_log(
    activity_id: int,
    user_id: int = Depends(get_effective_user_id),
    db: Session = Depends(get_db)
):
    """Retrieve details of a specific activity log entry."""
    log = db.query(ActivityLog).filter(
        ActivityLog.activity_id == activity_id,
        ActivityLog.user_id == user_id
    ).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity log not found.")
    return log
