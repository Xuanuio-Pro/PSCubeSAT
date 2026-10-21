"""Bound connection attempts and report deployment failures without credentials."""

import socket
import ssl
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncEngine

CONNECT_TIMEOUT = 10


def connection_error_message(engine: AsyncEngine, error: Exception) -> str:
    endpoint = f"{engine.url.host or '<unset>'}:{engine.url.port or 5432}"
    cause = getattr(error, "orig", error)
    if isinstance(cause, socket.gaierror):
        hint = "DB hostname did not resolve. Check DATABASE_URL and the shared Docker network."
    elif isinstance(cause, ssl.SSLError):
        hint = "DB TLS negotiation failed. Check the database certificate and SSL settings."
    elif isinstance(cause, (ConnectionRefusedError, ConnectionResetError)):
        hint = (
            "DB refused/reset the connection. Check that PostgreSQL is running, listening "
            "on the container's internal port and reachable on the shared Docker network."
        )
    elif isinstance(cause, TimeoutError):
        hint = "DB connection timed out. Check Docker networking, DB readiness and firewall."
    elif getattr(cause, "sqlstate", "") in ("28P01", "28000"):
        hint = "DB authentication failed. Check credentials and pg_hba.conf."
    elif getattr(cause, "sqlstate", "") == "3D000":
        hint = "Configured database does not exist. Check the database name in DATABASE_URL."
    else:
        hint = f"DB connection failed ({type(cause).__name__}). Check PostgreSQL and DATABASE_URL."
    if engine.url.host in ("localhost", "127.0.0.1", "::1"):
        hint += " In Docker bridge mode, localhost refers to the backend container, not PostgreSQL."
    return f"PostgreSQL at {endpoint}: {hint}"


@asynccontextmanager
async def connect_database(engine: AsyncEngine):
    try:
        connection = await engine.connect()
    except Exception as error:
        # Driver messages/context can contain passwords or complete connection URLs.
        raise RuntimeError(connection_error_message(engine, error)) from None
    try:
        yield connection
    finally:
        await connection.close()
