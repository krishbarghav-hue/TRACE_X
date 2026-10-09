# This file marks 'models' as a Python package
# Import all models here so SQLAlchemy creates all tables on startup

from app.models.user import User
from app.models.activity_log import ActivityLog
from app.models.browser_history import BrowserHistory
from app.models.website_usage import WebsiteUsage
from app.models.course import Course
from app.models.topic import Topic
from app.models.resource import Resource
from app.models.document import Document
from app.models.note import Note
from app.models.study_session import StudySession
from app.models.progress import Progress
from app.models.goal import Goal
