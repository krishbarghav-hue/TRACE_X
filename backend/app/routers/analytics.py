from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, case, text

from app.database import get_db
from app.models.course import Course
from app.models.topic import Topic
from app.models.resource import Resource
from app.models.document import Document
from app.models.note import Note
from app.models.study_session import StudySession
from app.models.progress import Progress, ProgressStatus

TEST_USER_ID = 1

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


# ── 1. OVERVIEW ANALYTICS ─────────────────────────────────────────────────────
@router.get("/overview")
def get_analytics_overview(db: Session = Depends(get_db)):
    """
    Returns overall learning statistics for the current user.
    """
    # 1. Total courses
    total_courses = db.query(func.count(Course.course_id)).filter(Course.user_id == TEST_USER_ID).scalar() or 0

    # 2. Total topics
    total_topics = (
        db.query(func.count(Topic.topic_id))
        .join(Course, Topic.course_id == Course.course_id)
        .filter(Course.user_id == TEST_USER_ID)
        .scalar() or 0
    )

    # 3. Total resources
    total_resources = db.query(func.count(Resource.resource_id)).filter(Resource.user_id == TEST_USER_ID).scalar() or 0

    # 4. Total documents
    total_documents = (
        db.query(func.count(Document.document_id))
        .filter(Document.user_id == TEST_USER_ID, Document.is_deleted == False)
        .scalar() or 0
    )

    # 5. Total notes
    total_notes = db.query(func.count(Note.note_id)).filter(Note.user_id == TEST_USER_ID).scalar() or 0

    # 6. Total study sessions & study time
    sess_stats = (
        db.query(
            func.count(StudySession.session_id).label("total_sessions"),
            func.coalesce(func.sum(StudySession.duration_minutes), 0).label("total_study_minutes")
        )
        .filter(StudySession.user_id == TEST_USER_ID)
        .first()
    )
    total_sessions = sess_stats.total_sessions if sess_stats else 0
    total_study_minutes = int(sess_stats.total_study_minutes) if sess_stats else 0

    # Today's study time
    today = datetime.now().date()
    today_minutes_query = (
        db.query(func.coalesce(func.sum(StudySession.duration_minutes), 0))
        .filter(StudySession.user_id == TEST_USER_ID, func.date(StudySession.start_time) == today)
        .scalar() or 0
    )
    today_study_minutes = int(today_minutes_query)

    # 7. Completed topics & average progress
    prog_stats = (
        db.query(
            func.count(case((Progress.status == ProgressStatus.completed, 1))).label("completed_count"),
            func.coalesce(func.avg(Progress.percent_complete), 0.0).label("avg_progress")
        )
        .filter(Progress.user_id == TEST_USER_ID)
        .first()
    )
    completed_topics = prog_stats.completed_count if prog_stats else 0
    average_progress = round(float(prog_stats.avg_progress), 1) if prog_stats else 0.0

    # 8. Recently studied resources
    recent_studied_rows = (
        db.query(
            Resource.resource_id,
            Resource.title,
            Resource.resource_type,
            Course.course_name,
            Topic.topic_name,
            Resource.url,
            func.max(StudySession.start_time).label("last_studied")
        )
        .join(StudySession, Resource.resource_id == StudySession.resource_id)
        .join(Course, Resource.course_id == Course.course_id)
        .outerjoin(Topic, Resource.topic_id == Topic.topic_id)
        .filter(StudySession.user_id == TEST_USER_ID)
        .group_by(Resource.resource_id, Resource.title, Resource.resource_type, Course.course_name, Topic.topic_name, Resource.url)
        .order_by(text("last_studied DESC"))
        .limit(5)
        .all()
    )
    recently_studied = [
        {
            "resource_id": r.resource_id,
            "title": r.title,
            "resource_type": str(r.resource_type.value if hasattr(r.resource_type, "value") else r.resource_type),
            "course_name": r.course_name,
            "topic_name": r.topic_name,
            "url": r.url,
            "last_studied": r.last_studied.isoformat() if r.last_studied else None
        }
        for r in recent_studied_rows
    ]

    return {
        "total_courses": total_courses,
        "total_topics": total_topics,
        "total_resources": total_resources,
        "total_documents": total_documents,
        "total_notes": total_notes,
        "total_sessions": total_sessions,
        "total_study_minutes": total_study_minutes,
        "today_study_minutes": today_study_minutes,
        "completed_topics": completed_topics,
        "average_progress": average_progress,
        "recently_studied": recently_studied
    }


# ── 2. COURSE ANALYTICS ───────────────────────────────────────────────────────
@router.get("/course/{course_id}")
def get_course_analytics(course_id: int, db: Session = Depends(get_db)):
    """
    Returns detailed analytics for a specific course.
    """
    course = db.query(Course).filter(Course.course_id == course_id, Course.user_id == TEST_USER_ID).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    # Study time & session count
    sess_stats = (
        db.query(
            func.count(StudySession.session_id).label("total_sessions"),
            func.coalesce(func.sum(StudySession.duration_minutes), 0).label("total_minutes")
        )
        .filter(StudySession.course_id == course_id, StudySession.user_id == TEST_USER_ID)
        .first()
    )
    total_sessions = sess_stats.total_sessions if sess_stats else 0
    total_study_minutes = int(sess_stats.total_minutes) if sess_stats else 0

    # Topic count
    topic_count = db.query(func.count(Topic.topic_id)).filter(Topic.course_id == course_id).scalar() or 0

    # Resource count
    resource_count = db.query(func.count(Resource.resource_id)).filter(Resource.course_id == course_id, Resource.user_id == TEST_USER_ID).scalar() or 0

    # Average progress across topics in course
    avg_prog = (
        db.query(func.coalesce(func.avg(Progress.percent_complete), 0.0))
        .join(Topic, Progress.topic_id == Topic.topic_id)
        .filter(Topic.course_id == course_id, Progress.user_id == TEST_USER_ID)
        .scalar() or 0.0
    )

    # Most studied topics
    most_studied_rows = (
        db.query(
            Topic.topic_id,
            Topic.topic_name,
            func.coalesce(func.sum(StudySession.duration_minutes), 0).label("study_minutes"),
            func.count(StudySession.session_id).label("session_count")
        )
        .join(Topic, StudySession.topic_id == Topic.topic_id)
        .filter(StudySession.course_id == course_id, StudySession.user_id == TEST_USER_ID)
        .group_by(Topic.topic_id, Topic.topic_name)
        .order_by(text("study_minutes DESC"))
        .limit(5)
        .all()
    )

    most_studied_topics = [
        {
            "topic_id": row.topic_id,
            "topic_name": row.topic_name,
            "study_minutes": int(row.study_minutes),
            "session_count": row.session_count
        }
        for row in most_studied_rows
    ]

    return {
        "course_id": course.course_id,
        "course_name": course.course_name,
        "total_study_minutes": total_study_minutes,
        "total_sessions": total_sessions,
        "topic_count": topic_count,
        "resource_count": resource_count,
        "average_progress": round(float(avg_prog), 1),
        "most_studied_topics": most_studied_topics
    }


# ── 3. WEEKLY ANALYTICS ───────────────────────────────────────────────────────
@router.get("/weekly")
def get_weekly_analytics(days: int = 7, db: Session = Depends(get_db)):
    """
    Returns study minutes aggregated by date for graphing.
    """
    start_date = datetime.now().date() - timedelta(days=days - 1)

    daily_rows = (
        db.query(
            func.date(StudySession.start_time).label("study_date"),
            func.coalesce(func.sum(StudySession.duration_minutes), 0).label("total_minutes")
        )
        .filter(
            StudySession.user_id == TEST_USER_ID,
            func.date(StudySession.start_time) >= start_date
        )
        .group_by(func.date(StudySession.start_time))
        .order_by(func.date(StudySession.start_time).asc())
        .all()
    )

    result_map = {row.study_date.isoformat(): int(row.total_minutes) for row in daily_rows}

    # Fill in all days in range so the chart is continuous
    data = []
    for d in range(days):
        day_str = (start_date + timedelta(days=d)).isoformat()
        data.append({
            "date": day_str,
            "study_minutes": result_map.get(day_str, 0)
        })

    return {"data": data}


# ── 4. STUDY TIME ANALYTICS ───────────────────────────────────────────────────
@router.get("/study-time")
def get_study_time_breakdown(db: Session = Depends(get_db)):
    """
    Returns study time grouped by course, topic, and resource.
    """
    # By Course
    course_rows = (
        db.query(
            Course.course_id,
            Course.course_name,
            func.coalesce(func.sum(StudySession.duration_minutes), 0).label("study_minutes"),
            func.count(StudySession.session_id).label("session_count")
        )
        .join(Course, StudySession.course_id == Course.course_id)
        .filter(StudySession.user_id == TEST_USER_ID)
        .group_by(Course.course_id, Course.course_name)
        .order_by(text("study_minutes DESC"))
        .all()
    )
    by_course = [
        {
            "course_id": r.course_id,
            "course_name": r.course_name,
            "study_minutes": int(r.study_minutes),
            "session_count": r.session_count
        }
        for r in course_rows
    ]

    # By Topic
    topic_rows = (
        db.query(
            Topic.topic_id,
            Topic.topic_name,
            Course.course_id,
            Course.course_name,
            func.coalesce(func.sum(StudySession.duration_minutes), 0).label("study_minutes"),
            func.count(StudySession.session_id).label("session_count")
        )
        .join(Topic, StudySession.topic_id == Topic.topic_id)
        .join(Course, Topic.course_id == Course.course_id)
        .filter(StudySession.user_id == TEST_USER_ID)
        .group_by(Topic.topic_id, Topic.topic_name, Course.course_id, Course.course_name)
        .order_by(text("study_minutes DESC"))
        .all()
    )
    by_topic = [
        {
            "topic_id": r.topic_id,
            "topic_name": r.topic_name,
            "course_id": r.course_id,
            "course_name": r.course_name,
            "study_minutes": int(r.study_minutes),
            "session_count": r.session_count
        }
        for r in topic_rows
    ]

    # By Resource
    resource_rows = (
        db.query(
            Resource.resource_id,
            Resource.title,
            Course.course_name,
            func.coalesce(func.sum(StudySession.duration_minutes), 0).label("study_minutes"),
            func.count(StudySession.session_id).label("session_count")
        )
        .join(Resource, StudySession.resource_id == Resource.resource_id)
        .join(Course, Resource.course_id == Course.course_id)
        .filter(StudySession.user_id == TEST_USER_ID)
        .group_by(Resource.resource_id, Resource.title, Course.course_name)
        .order_by(text("study_minutes DESC"))
        .all()
    )
    by_resource = [
        {
            "resource_id": r.resource_id,
            "title": r.title,
            "course_name": r.course_name,
            "study_minutes": int(r.study_minutes),
            "session_count": r.session_count
        }
        for r in resource_rows
    ]

    return {
        "by_course": by_course,
        "by_topic": by_topic,
        "by_resource": by_resource
    }


# ── 5. PROGRESS ANALYTICS ─────────────────────────────────────────────────────
@router.get("/progress")
def get_progress_analytics(db: Session = Depends(get_db)):
    """
    Returns progress analytics across courses and topics.
    """
    # Course progress
    course_prog_rows = (
        db.query(
            Course.course_id,
            Course.course_name,
            func.coalesce(func.avg(Progress.percent_complete), 0.0).label("avg_percent"),
            func.count(Progress.progress_id).label("tracked_items")
        )
        .join(Topic, Topic.course_id == Course.course_id)
        .outerjoin(Progress, Progress.topic_id == Topic.topic_id)
        .filter(Course.user_id == TEST_USER_ID)
        .group_by(Course.course_id, Course.course_name)
        .all()
    )
    course_progress = [
        {
            "course_id": r.course_id,
            "course_name": r.course_name,
            "average_percent": round(float(r.avg_percent), 1),
            "tracked_items": r.tracked_items
        }
        for r in course_prog_rows
    ]

    # Topic progress
    topic_prog_rows = (
        db.query(
            Topic.topic_id,
            Topic.topic_name,
            Course.course_name,
            func.coalesce(Progress.status, ProgressStatus.not_started).label("status"),
            func.coalesce(Progress.percent_complete, 0).label("percent_complete")
        )
        .join(Course, Topic.course_id == Course.course_id)
        .outerjoin(Progress, Progress.topic_id == Topic.topic_id)
        .filter(Course.user_id == TEST_USER_ID)
        .all()
    )

    topic_progress = []
    completed_topics = 0
    in_progress_topics = 0
    not_started_topics = 0

    for r in topic_prog_rows:
        status_val = str(r.status.value if hasattr(r.status, "value") else r.status)
        pct = int(r.percent_complete)
        if status_val == "completed" or pct == 100:
            completed_topics += 1
        elif status_val == "in_progress" or pct > 0:
            in_progress_topics += 1
        else:
            not_started_topics += 1

        topic_progress.append({
            "topic_id": r.topic_id,
            "topic_name": r.topic_name,
            "course_name": r.course_name,
            "status": status_val,
            "percent_complete": pct
        })

    return {
        "course_progress": course_progress,
        "topic_progress": topic_progress,
        "completed_topics": completed_topics,
        "in_progress_topics": in_progress_topics,
        "not_started_topics": not_started_topics
    }


# ── 6. UNSTUDIED RESOURCES ────────────────────────────────────────────────────
@router.get("/unstudied-resources")
def get_unstudied_resources(db: Session = Depends(get_db)):
    """
    Finds resources that exist but have never been associated with a study session.
    """
    # Subquery of resource IDs that have at least one study session
    studied_resource_ids = (
        db.query(StudySession.resource_id)
        .filter(StudySession.user_id == TEST_USER_ID, StudySession.resource_id != None)
        .distinct()
    )

    # Query resources not in studied_resource_ids
    unstudied = (
        db.query(
            Resource.resource_id,
            Resource.title,
            Resource.resource_type,
            Course.course_name,
            Topic.topic_name,
            Resource.url
        )
        .join(Course, Resource.course_id == Course.course_id)
        .outerjoin(Topic, Resource.topic_id == Topic.topic_id)
        .filter(
            Resource.user_id == TEST_USER_ID,
            Resource.resource_id.not_in(studied_resource_ids)
        )
        .all()
    )

    return [
        {
            "resource_id": r.resource_id,
            "title": r.title,
            "resource_type": str(r.resource_type.value if hasattr(r.resource_type, "value") else r.resource_type),
            "course_name": r.course_name,
            "topic_name": r.topic_name,
            "url": r.url
        }
        for r in unstudied
    ]
