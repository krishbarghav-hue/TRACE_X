import os
import unittest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure test secret key is configured
os.environ["SECRET_KEY"] = "test-secret-key-for-testclient-isolation-32chars!"
os.environ["ENVIRONMENT"] = "test"

from app.database import Base, get_db
from app.main import app

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.types import BigInteger


@compiles(BigInteger, "sqlite")
def compile_bigint_sqlite(type_, compiler, **kw):
    return "INTEGER"


# Set up an isolated in-memory SQLite database
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


class TestTwoAccountIsolation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=test_engine)
        cls.client = TestClient(app)

        # 1. Register Account A
        res_a = cls.client.post(
            "/api/auth/register",
            json={"full_name": "Student A", "email": "account_a@test.com", "password": "PasswordA123!"},
        )
        assert res_a.status_code == 201, res_a.text
        login_a = cls.client.post(
            "/api/auth/login",
            json={"email": "account_a@test.com", "password": "PasswordA123!"},
        )
        assert login_a.status_code == 200, login_a.text
        cls.token_a = login_a.json()["access_token"]
        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.user_a_id = login_a.json()["user"]["user_id"]

        # 2. Register Account B
        res_b = cls.client.post(
            "/api/auth/register",
            json={"full_name": "Student B", "email": "account_b@test.com", "password": "PasswordB123!"},
        )
        assert res_b.status_code == 201, res_b.text
        login_b = cls.client.post(
            "/api/auth/login",
            json={"email": "account_b@test.com", "password": "PasswordB123!"},
        )
        assert login_b.status_code == 200, login_b.text
        cls.token_b = login_b.json()["access_token"]
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}
        cls.user_b_id = login_b.json()["user"]["user_id"]

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=test_engine)

    def test_01_unauthenticated_requests_are_rejected(self):
        """Verify endpoints reject requests without valid authentication."""
        resp = self.client.get("/api/courses")
        self.assertEqual(resp.status_code, 401)

        resp2 = self.client.get("/api/activity-logs/today")
        self.assertEqual(resp2.status_code, 401)

        resp3 = self.client.get("/api/analytics/overview")
        self.assertEqual(resp3.status_code, 401)

    def test_02_account_a_creates_data_and_account_b_cannot_access(self):
        """Account A creates course, topic, note, and resource. Account B cannot access or modify them."""
        # Account A creates a course
        c_res = self.client.post(
            "/api/courses",
            headers=self.headers_a,
            json={"course_name": "Distributed Systems", "description": "CS 401"},
        )
        self.assertEqual(c_res.status_code, 201)
        course_a_id = c_res.json()["course_id"]

        # Account A creates a topic
        t_res = self.client.post(
            "/api/topics",
            headers=self.headers_a,
            json={"course_id": course_a_id, "topic_name": "Raft Consensus"},
        )
        self.assertEqual(t_res.status_code, 201)
        topic_a_id = t_res.json()["topic_id"]

        # Account A creates a note
        n_res = self.client.post(
            "/api/notes",
            headers=self.headers_a,
            json={"course_id": course_a_id, "topic_id": topic_a_id, "content": "Raft leader election notes"},
        )
        self.assertEqual(n_res.status_code, 201)
        note_a_id = n_res.json()["note_id"]

        # Account B attempts to read Account A's course by ID
        b_get_course = self.client.get(f"/api/courses/{course_a_id}", headers=self.headers_b)
        self.assertEqual(b_get_course.status_code, 404)

        # Account B attempts to update Account A's course
        b_put_course = self.client.put(
            f"/api/courses/{course_a_id}",
            headers=self.headers_b,
            json={"course_name": "Hacked Course"},
        )
        self.assertEqual(b_put_course.status_code, 404)

        # Account B attempts to delete Account A's course
        b_del_course = self.client.delete(f"/api/courses/{course_a_id}", headers=self.headers_b)
        self.assertEqual(b_del_course.status_code, 404)

        # Account B attempts to read Account A's topic by ID
        b_get_topic = self.client.get(f"/api/topics/{topic_a_id}", headers=self.headers_b)
        self.assertEqual(b_get_topic.status_code, 404)

        # Account B attempts to read Account A's note by ID
        b_get_note = self.client.get(f"/api/notes/{note_a_id}", headers=self.headers_b)
        self.assertEqual(b_get_note.status_code, 404)

        # Account B attempts to update Account A's note
        b_put_note = self.client.put(
            f"/api/notes/{note_a_id}",
            headers=self.headers_b,
            json={"content": "Malicious modification"},
        )
        self.assertEqual(b_put_note.status_code, 404)

        # Account B attempts to delete Account A's note
        b_del_note = self.client.delete(f"/api/notes/{note_a_id}", headers=self.headers_b)
        self.assertEqual(b_del_note.status_code, 404)

        # Normal read by Account A still succeeds
        a_get_course = self.client.get(f"/api/courses/{course_a_id}", headers=self.headers_a)
        self.assertEqual(a_get_course.status_code, 200)
        self.assertEqual(a_get_course.json()["course_name"], "Distributed Systems")

    def test_03_activity_telemetry_isolation(self):
        """Account A submits activity logs and heartbeat. Account B cannot see Account A's activity."""
        # Account A sends heartbeat
        hb_a = self.client.post(
            "/api/activity-logs/extension-heartbeat",
            headers=self.headers_a,
            json={
                "current_domain": "raft.github.io",
                "current_title": "Raft Consensus Algorithm",
                "current_url": "https://raft.github.io/",
                "event_id": "event-a-100",
                "is_paused": False,
            },
        )
        self.assertEqual(hb_a.status_code, 200)

        # Account A checks current activity -> Should see raft.github.io
        curr_a = self.client.get("/api/activity-logs/current", headers=self.headers_a)
        self.assertEqual(curr_a.status_code, 200)
        self.assertTrue(curr_a.json()["active"])
        self.assertEqual(curr_a.json()["domain"], "raft.github.io")

        # Account B checks current activity -> Should NOT see Account A's activity
        curr_b = self.client.get("/api/activity-logs/current", headers=self.headers_b)
        self.assertEqual(curr_b.status_code, 200)
        self.assertFalse(curr_b.json()["active"])

        # Account A logs a completed activity
        log_res = self.client.post(
            "/api/activity-logs",
            headers=self.headers_a,
            json={
                "url": "https://raft.github.io/paper.pdf",
                "domain": "raft.github.io",
                "page_title": "In Search of an Understandable Consensus Algorithm",
                "duration_seconds": 120,
                "event_id": "event-a-pdf-101",
            },
        )
        self.assertEqual(log_res.status_code, 201)
        activity_a_id = log_res.json()["activity_id"]

        # Account B attempts to query Account A's single activity
        b_act = self.client.get(f"/api/activity-logs/{activity_a_id}", headers=self.headers_b)
        self.assertEqual(b_act.status_code, 404)

        # Account B queries today's activities -> Must be empty
        today_b = self.client.get("/api/activity-logs/today", headers=self.headers_b)
        self.assertEqual(today_b.status_code, 200)
        self.assertEqual(len(today_b.json()), 0)

        # Account B queries timeline -> Must be empty
        timeline_b = self.client.get("/api/activity-logs/timeline", headers=self.headers_b)
        self.assertEqual(timeline_b.status_code, 200)
        self.assertEqual(len(timeline_b.json()), 0)

    def test_04_arbitrary_user_id_in_request_body_is_not_trusted(self):
        """Account B attempts to inject user_id=Account A's id in activity creation. Backend forces user_id=Account B."""
        injection_res = self.client.post(
            "/api/activity-logs",
            headers=self.headers_b,
            json={
                "url": "https://spoofed.com",
                "domain": "spoofed.com",
                "user_id": self.user_a_id,  # Attempting to attribute to User A
                "duration_seconds": 60,
                "event_id": "spoof-event-999",
            },
        )
        self.assertEqual(injection_res.status_code, 201)
        # Verify the record was assigned to User B, NOT User A
        self.assertEqual(injection_res.json()["user_id"], self.user_b_id)

    def test_05_study_sessions_and_resources_isolation(self):
        """Account A creates resources and study sessions. Account B cannot read, update, or end them."""
        # 1. Account A creates a course and resource
        c_res = self.client.post(
            "/api/courses",
            headers=self.headers_a,
            json={"course_name": "Operating Systems", "description": "CS 301"},
        )
        course_id = c_res.json()["course_id"]

        r_res = self.client.post(
            "/api/resources",
            headers=self.headers_a,
            json={
                "course_id": course_id,
                "title": "OS Three Easy Pieces",
                "url": "https://pages.cs.wisc.edu/~remzi/OSTEP/",
                "resource_type": "website",
            },
        )
        self.assertEqual(r_res.status_code, 201)
        resource_id = r_res.json()["resource_id"]

        # 2. Account A starts a study session
        s_res = self.client.post(
            "/api/study-sessions/start",
            headers=self.headers_a,
            json={"course_id": course_id, "resource_id": resource_id, "session_notes": "Virtual Memory"},
        )
        self.assertEqual(s_res.status_code, 201)
        session_id = s_res.json()["session_id"]

        # Account B attempts to read resource
        b_get_res = self.client.get(f"/api/resources/{resource_id}", headers=self.headers_b)
        self.assertEqual(b_get_res.status_code, 404)

        # Account B attempts to update resource
        b_put_res = self.client.put(
            f"/api/resources/{resource_id}",
            headers=self.headers_b,
            json={"title": "Hacked Resource"},
        )
        self.assertEqual(b_put_res.status_code, 404)

        # Account B attempts to delete resource
        b_del_res = self.client.delete(f"/api/resources/{resource_id}", headers=self.headers_b)
        self.assertEqual(b_del_res.status_code, 404)

        # Account B attempts to read study session
        b_get_sess = self.client.get(f"/api/study-sessions/{session_id}", headers=self.headers_b)
        self.assertEqual(b_get_sess.status_code, 404)

        # Account B attempts to end study session
        b_end_sess = self.client.post(
            f"/api/study-sessions/{session_id}/end",
            headers=self.headers_b,
            json={"session_notes": "Unauthorized end"},
        )
        self.assertEqual(b_end_sess.status_code, 404)

        # Account B lists all study sessions -> None of Account A's sessions are listed
        b_list_sess = self.client.get("/api/study-sessions", headers=self.headers_b)
        self.assertEqual(b_list_sess.status_code, 200)
        self.assertEqual(len(b_list_sess.json()), 0)

    def test_06_analytics_and_recommendations_isolation(self):
        """Account B's analytics and recommendations do not expose Account A's activity."""
        # Account B checks overview analytics
        b_overview = self.client.get("/api/analytics/overview", headers=self.headers_b)
        self.assertEqual(b_overview.status_code, 200)
        data = b_overview.json()
        self.assertEqual(data["total_courses"], 0)
        self.assertEqual(data["total_topics"], 0)
        self.assertEqual(data["total_notes"], 0)
        self.assertEqual(data["total_sessions"], 0)
        self.assertEqual(data["completed_topics"], 0)

        # Account B checks history-to-plan recommendations
        b_rec = self.client.get("/api/history-to-plan", headers=self.headers_b)
        self.assertEqual(b_rec.status_code, 200)
        self.assertEqual(len(b_rec.json()["recommendations"]), 0)

    def test_07_browser_history_isolation(self):
        """Account A logs browser history; Account B cannot read Account A's browser history."""
        # Account A submits browser history
        hist_res = self.client.post(
            "/api/activity-logs/browser-history",
            headers=self.headers_a,
            json=[
                {
                    "url": "https://cs.stanford.edu/private",
                    "title": "Private Research",
                    "visit_count": 5,
                    "lastVisitTime": 1700000000000,
                }
            ],
        )
        self.assertEqual(hist_res.status_code, 201)

        # Account B queries browser history
        b_hist = self.client.get("/api/activity-logs/history", headers=self.headers_b)
        self.assertEqual(b_hist.status_code, 200)
        self.assertEqual(b_hist.json()["total"], 0)
        self.assertEqual(len(b_hist.json()["records"]), 0)

        # Account A queries browser history -> Sees their own record
        a_hist = self.client.get("/api/activity-logs/history", headers=self.headers_a)
        self.assertEqual(a_hist.status_code, 200)
        self.assertEqual(a_hist.json()["total"], 1)
        self.assertEqual(a_hist.json()["records"][0]["domain"], "cs.stanford.edu")


if __name__ == "__main__":
    unittest.main()
