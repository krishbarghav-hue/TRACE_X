import os
import unittest
from unittest.mock import MagicMock, patch
from sqlalchemy.exc import OperationalError

class TestDatabaseRecovery(unittest.TestCase):
    def test_engine_pool_settings(self):
        """Verify engine keeps pool_pre_ping=True and pool_recycle=180."""
        from app.database import engine
        self.assertTrue(engine.pool._pre_ping)
        self.assertEqual(engine.pool._recycle, 180)

    def test_get_db_session_lifecycle_and_rollback_on_error(self):
        """Verify get_db rolls back on error and does NOT attempt to re-yield a second session."""
        from app.database import get_db

        mock_session = MagicMock()
        with patch("app.database.SessionLocal", return_value=mock_session):
            gen = get_db()
            session = next(gen)
            self.assertEqual(session, mock_session)

            # Simulate an OperationalError inside the request lifecycle
            with self.assertRaises(OperationalError):
                gen.throw(OperationalError("statement", {}, Exception("Connection lost")))

            # Ensure rollback and close were called once, and no second yield occurred
            mock_session.rollback.assert_called_once()
            mock_session.close.assert_called_once()


class TestAuthSecretKeySecurity(unittest.TestCase):
    def test_insecure_placeholder_rejected(self):
        """Verify predictable or insecure secret keys fail safely without printing the secret."""
        from app.utils.auth import get_secret_key

        with patch.dict(os.environ, {"SECRET_KEY": "fallback_secret_key", "ENVIRONMENT": "development"}, clear=True):
            with self.assertRaises(RuntimeError) as ctx:
                get_secret_key()
            self.assertIn("insecure placeholder", str(ctx.exception))
            self.assertNotIn("fallback_secret_key", str(ctx.exception))

    def test_missing_secret_fails_safely_in_production(self):
        """Verify missing secret key in production raises RuntimeError."""
        from app.utils.auth import get_secret_key

        with patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=True):
            with self.assertRaises(RuntimeError) as ctx:
                get_secret_key()
            self.assertIn("Missing required SECRET_KEY", str(ctx.exception))

    def test_short_secret_fails_in_production(self):
        """Verify secrets with <32 chars fail in production."""
        from app.utils.auth import get_secret_key

        with patch.dict(os.environ, {"SECRET_KEY": "too-short", "ENVIRONMENT": "production"}, clear=True):
            with self.assertRaises(RuntimeError) as ctx:
                get_secret_key()
            self.assertIn("too short", str(ctx.exception))
            self.assertNotIn("too-short", str(ctx.exception))

    def test_explicitly_configured_local_secret_accepted(self):
        """Verify local development works with an explicitly configured local secret."""
        from app.utils.auth import get_secret_key, create_access_token

        local_secret = "my-explicit-local-dev-secret-key-12345"
        with patch.dict(os.environ, {"SECRET_KEY": local_secret, "ENVIRONMENT": "development"}, clear=True):
            key = get_secret_key()
            self.assertEqual(key, local_secret)
            token = create_access_token(user_id=42, email="student@example.com")
            self.assertIsInstance(token, str)


class TestCrossUserBoundaryAndDefaults(unittest.TestCase):
    def test_get_optional_user_id_never_falls_back_to_user_1(self):
        """Verify get_optional_user_id returns None, never user 1, when header is missing or invalid."""
        from app.utils.auth import get_optional_user_id

        self.assertIsNone(get_optional_user_id(None))
        self.assertIsNone(get_optional_user_id(""))
        self.assertIsNone(get_optional_user_id("Bearer invalid.token.payload"))

    def test_activity_log_create_never_defaults_user_id_to_1(self):
        """Verify ActivityLogCreate schema does not substitute user ID 1."""
        from app.schemas.activity_log import ActivityLogCreate

        # Dict with missing user_id
        model = ActivityLogCreate(url="https://example.com", domain="example.com")
        self.assertIsNone(model.user_id)

        # Dict with empty user dict
        model2 = ActivityLogCreate(url="https://example.com", domain="example.com", user_id={})
        self.assertIsNone(model2.user_id)


if __name__ == "__main__":
    unittest.main()
