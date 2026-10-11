from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.course import Course
from app.models.topic import Topic
from app.models.progress import Progress
from app.models.activity_log import ActivityLog
from app.models.study_session import StudySession
from app.models.goal import Goal
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/history-to-plan", tags=["History-to-Plan"])


@router.get("")
@router.get("/", include_in_schema=False)
def get_history_to_plan_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Rule-based recommendation engine that prioritizes study topics based on:
    - Browser activity telemetry (browse_count, browse_minutes)
    - Learning progress (percent_complete)
    - Active learning goals (goal_urgency_bonus)
    - Deliberate study recency

    Formula:
    score = (2 * browse_count) + (0.5 * browse_minutes) + (0.3 * (100 - percent_complete)) + goal_urgency_bonus
    """
    user_id = current_user.user_id

    # 1. Fetch all topics for the authenticated user across courses
    topics = (
        db.query(Topic, Course)
        .join(Course, Topic.course_id == Course.course_id)
        .filter(Course.user_id == user_id)
        .all()
    )

    if not topics:
        return {"recommendations": []}

    recommendations = []
    now = datetime.now()
    today = now.date()

    for topic, course in topics:
        # ── 1. Calculate Browse Telemetry from ACTIVITY_LOGS ───────────────────
        act_stats = (
            db.query(
                func.count(ActivityLog.activity_id).label("browse_count"),
                func.coalesce(func.sum(ActivityLog.duration_seconds), 0).label("browse_seconds")
            )
            .filter(
                ActivityLog.user_id == user_id,
                ActivityLog.topic_id == topic.topic_id
            )
            .first()
        )
        browse_count = int(act_stats.browse_count) if act_stats and act_stats.browse_count else 0
        browse_seconds = float(act_stats.browse_seconds) if act_stats and act_stats.browse_seconds else 0.0
        browse_minutes = round(browse_seconds / 60.0, 1)

        # ── 2. Calculate Learning Completion from PROGRESS ────────────────────
        prog = (
            db.query(Progress)
            .filter(
                Progress.user_id == user_id,
                Progress.topic_id == topic.topic_id
            )
            .first()
        )
        percent_complete = prog.percent_complete if prog else 0

        # ── 3. Calculate Goal Urgency Bonus from GOALS ─────────────────────────
        active_goal = (
            db.query(Goal)
            .filter(
                Goal.user_id == user_id,
                Goal.topic_id == topic.topic_id,
                Goal.is_achieved == False
            )
            .first()
        )
        goal_urgency_bonus = 0.0
        if active_goal:
            days_left = (active_goal.target_date - today).days
            if days_left <= 7:
                goal_urgency_bonus = 10.0
            elif days_left <= 14:
                goal_urgency_bonus = 5.0
            else:
                goal_urgency_bonus = 5.0

        # ── 4. Calculate Final Score ──────────────────────────────────────────
        score = (
            (2.0 * browse_count)
            + (0.5 * browse_minutes)
            + (0.3 * (100.0 - percent_complete))
            + goal_urgency_bonus
        )
        score = round(score, 1)

        # ── 5. Generate Human-Readable Reasons ────────────────────────────────
        reasons = []
        if browse_count >= 5:
            reasons.append("Frequently visited")
        elif browse_count > 0:
            reasons.append("Recent browsing activity")

        if browse_minutes >= 30:
            reasons.append("High browser activity")

        if percent_complete < 50:
            reasons.append("Low completion")

        # Check last study session recency
        last_session = (
            db.query(StudySession)
            .filter(
                StudySession.user_id == user_id,
                StudySession.topic_id == topic.topic_id
            )
            .order_by(StudySession.end_time.desc())
            .first()
        )
        if not last_session:
            reasons.append("Not studied recently")
            if browse_count > 0:
                reasons.append("High study gap")
        else:
            days_since_study = (today - last_session.end_time.date()).days
            if days_since_study > 7:
                reasons.append("Not studied recently")

        if active_goal:
            reasons.append("Related goal is approaching")

        recommendations.append({
            "topic_id": topic.topic_id,
            "topic_name": topic.topic_name,
            "course_id": course.course_id,
            "course_name": course.course_name,
            "score": score,
            "browse_count": browse_count,
            "browse_minutes": browse_minutes,
            "percent_complete": percent_complete,
            "goal_urgency_bonus": goal_urgency_bonus,
            "reasons": reasons
        })

    # Sort recommendations by highest score first
    recommendations.sort(key=lambda x: x["score"], reverse=True)

    return {"recommendations": recommendations}

