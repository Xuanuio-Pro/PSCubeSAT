import asyncio
import socket
import ssl
import traceback
import unittest
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError

from app.db.connection import connect_database, connection_error_message


class DatabaseConnectionTests(unittest.IsolatedAsyncioTestCase):
    def engine(self, host="postgres"):
        return MagicMock(url=make_url(f"postgresql+asyncpg://user:secret-password@{host}/cube"))

    async def test_refused_connection_reports_docker_hint_without_driver_secrets(self):
        engine = self.engine("localhost")
        engine.connect = AsyncMock(side_effect=ConnectionRefusedError("secret-password"))
        try:
            async with connect_database(engine):
                self.fail("A refused connection must fail startup")
        except RuntimeError as error:
            rendered = "".join(traceback.format_exception(error))
        else:
            self.fail("Expected a deployment error")
        self.assertIn("localhost:5432", rendered)
        self.assertIn("backend container", rendered)
        self.assertNotIn("secret-password", rendered)

    async def test_closes_connection_if_query_fails_without_reclassifying_query_error(self):
        engine = self.engine()
        connection = MagicMock(close=AsyncMock())
        engine.connect = AsyncMock(return_value=connection)
        with self.assertRaisesRegex(ValueError, "query failed"):
            async with connect_database(engine):
                raise ValueError("query failed")
        connection.close.assert_awaited_once()

    async def test_cancellation_is_not_converted_to_configuration_failure(self):
        engine = self.engine()
        engine.connect = AsyncMock(side_effect=asyncio.CancelledError)
        with self.assertRaises(asyncio.CancelledError):
            async with connect_database(engine):
                self.fail("Must not enter")

    def test_failure_classification_and_wrapped_driver_secret_redaction(self):
        auth_error = type("AuthError", (Exception,), {"sqlstate": "28P01"})("secret-password")
        missing_db = type("MissingDB", (Exception,), {"sqlstate": "3D000"})("secret-password")
        for error, expected in [
            (socket.gaierror("secret-password"), "hostname did not resolve"),
            (TimeoutError("secret-password"), "timed out"),
            (ssl.SSLError("secret-password"), "TLS negotiation failed"),
            (DBAPIError(None, None, auth_error), "authentication failed"),
            (missing_db, "does not exist"),
            (ValueError("secret-password"), "ValueError"),
        ]:
            with self.subTest(expected=expected):
                message = connection_error_message(self.engine(), error)
                self.assertIn(expected, message)
                self.assertNotIn("secret-password", message)
                self.assertNotIn("user:", message)
