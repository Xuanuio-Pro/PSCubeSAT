"""Shared test setup."""

import pytest

from app.core.config import get_settings


@pytest.fixture(autouse=True)
def _no_real_smtp():
    """Tests must never send real mail or change flows because a local .env has SMTP set."""
    settings = get_settings()
    original = settings.smtp_host
    settings.smtp_host = ""
    yield
    settings.smtp_host = original
