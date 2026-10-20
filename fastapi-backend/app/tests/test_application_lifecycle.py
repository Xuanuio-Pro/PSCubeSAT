"""Verify resource cleanup across startup failures, request errors and cancellation."""

import asyncio
import unittest
from contextlib import ExitStack
from importlib import import_module
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI

from app.core import redis

runtime = import_module("app.lifespan")


class LifecycleTests(unittest.IsolatedAsyncioTestCase):
    def resources(self, **overrides):
        stack = ExitStack()
        self.addCleanup(stack.close)
        functions = {
            name: AsyncMock() for name in ("init_db", "close_db", "init_redis", "close_redis")
        }
        functions.update(overrides)
        for name, value in functions.items():
            stack.enter_context(patch.object(runtime, name, value))
        stack.enter_context(patch.object(runtime, "configure_logging"))
        stack.enter_context(patch.object(runtime.compiler_svc, "init_all_caches"))
        publisher = MagicMock(start=AsyncMock(), stop=AsyncMock(), publish=AsyncMock())
        manager = MagicMock(shutdown=AsyncMock())
        stack.enter_context(patch.object(runtime, "simulation_mqtt_publisher", publisher))
        stack.enter_context(patch.object(runtime, "simulation_manager", manager))
        return functions, publisher, manager

    async def test_partial_startup_failure_closes_previously_opened_resources(self):
        resources, publisher, _ = self.resources(
            init_redis=AsyncMock(side_effect=RuntimeError("failed"))
        )
        with self.assertRaisesRegex(RuntimeError, "failed"):
            async with runtime.lifespan(FastAPI()):
                self.fail("Must not enter serving state")
        resources["close_redis"].assert_awaited_once()
        resources["close_db"].assert_awaited_once()
        publisher.start.assert_not_awaited()

    async def test_publisher_start_failure_is_cleaned_up(self):
        resources, publisher, _ = self.resources()
        publisher.start.side_effect = RuntimeError("publisher failed")
        with self.assertRaisesRegex(RuntimeError, "publisher failed"):
            async with runtime.lifespan(FastAPI()):
                self.fail("Must not enter serving state")
        publisher.stop.assert_awaited_once()
        resources["close_redis"].assert_awaited_once()
        resources["close_db"].assert_awaited_once()

    async def test_runtime_exception_cancels_background_task_and_closes_resources(self):
        resources, publisher, manager = self.resources()
        started, stopped = asyncio.Event(), asyncio.Event()

        async def consume():
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                stopped.set()

        with patch.object(runtime.mqtt_consumer, "start", consume):
            with self.assertRaisesRegex(RuntimeError, "request failed"):
                async with runtime.lifespan(FastAPI()):
                    await asyncio.wait_for(started.wait(), 1)
                    raise RuntimeError("request failed")
        self.assertTrue(stopped.is_set())
        manager.shutdown.assert_awaited_once()
        publisher.stop.assert_awaited_once()
        resources["close_redis"].assert_awaited_once()
        resources["close_db"].assert_awaited_once()

    async def test_redis_ping_failure_releases_client_without_exposing_url(self):
        client = MagicMock(
            ping=AsyncMock(side_effect=ConnectionError("unavailable")), aclose=AsyncMock()
        )
        with (
            patch.object(redis.aioredis, "from_url", return_value=client),
            patch.object(redis, "_redis_client", None),
        ):
            await redis.init_redis()
            self.assertIsNone(redis.get_redis())
        client.aclose.assert_awaited_once()

    async def test_redis_startup_cancellation_releases_client(self):
        client = MagicMock(ping=AsyncMock(side_effect=asyncio.CancelledError), aclose=AsyncMock())
        with patch.object(redis.aioredis, "from_url", return_value=client):
            with self.assertRaises(asyncio.CancelledError):
                await redis.init_redis()
        client.aclose.assert_awaited_once()
