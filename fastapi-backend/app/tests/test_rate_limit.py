import unittest
from unittest.mock import patch

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core import rate_limit
from app.core.config import Settings
from app.core.rate_limit import FixedWindowLimiter, RateLimitMiddleware, client_ip
from app.core.security import create_access_token


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


class FixedWindowLimiterTests(unittest.TestCase):
    def test_limit_retry_after_and_new_window(self):
        clock = Clock()
        limiter = FixedWindowLimiter(clock)
        self.assertTrue(all(limiter.hit("k", 3, 60) is None for _ in range(3)))
        clock.now += 20
        self.assertAlmostEqual(limiter.hit("k", 3, 60), 40)
        self.assertEqual(limiter.blocked("k", 3), 40)
        clock.now += 40
        self.assertIsNone(limiter.hit("k", 3, 60))
        self.assertIsNone(limiter.blocked("k", 3))

    def test_pruning_keeps_each_key_for_its_own_window(self):
        clock = Clock()
        limiter = FixedWindowLimiter(clock)
        limiter.hit("long", 1, 3600)
        limiter.hit("short", 1, 60)
        clock.now += 120
        with patch.object(rate_limit, "_MAX_KEYS", 2):
            limiter.hit("new", 1, 60)
        self.assertIsNotNone(limiter.hit("long", 1, 3600))  # still counted, not pruned
        self.assertIsNone(limiter.hit("short", 1, 60))


class MiddlewareTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        app = FastAPI()

        @app.post("/api/auth/register")
        async def register():
            return {"ok": True}

        @app.post("/api/compile")
        async def compile_code():
            return {"ok": True}

        @app.get("/api/curriculum/exercises")
        async def exercises():
            return {"ok": True}

        self.app = RateLimitMiddleware(app)
        self.client = AsyncClient(transport=ASGITransport(app=self.app), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_ip_rule_returns_structured_429_with_retry_after(self):
        for _ in range(30):
            self.assertEqual((await self.client.post("/api/auth/register")).status_code, 200)
        rejected = await self.client.post("/api/auth/register")
        self.assertEqual(rejected.status_code, 429)
        self.assertEqual(rejected.json()["code"], "RATE_LIMITED")
        self.assertEqual(rejected.json()["details"]["rule"], "register")
        self.assertGreater(int(rejected.headers["retry-after"]), 0)

    async def test_user_rule_counts_each_account_separately(self):
        alice = {"Authorization": f"Bearer {create_access_token({'sub': '1'})}"}
        bob = {"Authorization": f"Bearer {create_access_token({'sub': '2'})}"}
        for _ in range(10):
            self.assertEqual(
                (await self.client.post("/api/compile", headers=alice)).status_code, 200
            )
        self.assertEqual((await self.client.post("/api/compile", headers=alice)).status_code, 429)
        self.assertEqual((await self.client.post("/api/compile", headers=bob)).status_code, 200)

    async def test_bulk_content_reading_is_limited_and_logged_as_scraping(self):
        headers = {"Authorization": f"Bearer {create_access_token({'sub': '3'})}"}
        with patch.object(rate_limit.logger, "bind", wraps=rate_limit.logger.bind) as bind:
            statuses = [
                (await self.client.get("/api/curriculum/exercises", headers=headers)).status_code
                for _ in range(121)
            ]
        self.assertEqual(statuses.count(200), 120)
        self.assertEqual(statuses[-1], 429)
        self.assertEqual(bind.call_args.kwargs["action"], "content_scrape_suspected")

    async def test_forged_token_falls_back_to_the_ip_bucket(self):
        forged = {"Authorization": "Bearer not-a-valid-token"}
        for _ in range(10):
            await self.client.post("/api/compile", headers=forged)
        self.assertEqual((await self.client.post("/api/compile")).status_code, 429)


class ClientIpTests(unittest.TestCase):
    def test_trusted_header_is_used_only_when_configured(self):
        scope = {"client": ("10.0.0.5", 1234), "headers": [(b"cf-connecting-ip", b"203.0.113.7")]}
        with patch.object(rate_limit, "get_settings", return_value=Settings(_env_file=None)):
            self.assertEqual(client_ip(scope), "10.0.0.5")
        configured = Settings(_env_file=None, client_ip_header="CF-Connecting-IP")
        with patch.object(rate_limit, "get_settings", return_value=configured):
            self.assertEqual(client_ip(scope), "203.0.113.7")
