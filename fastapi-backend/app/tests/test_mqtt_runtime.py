import asyncio
import unittest
from unittest.mock import AsyncMock, patch

import aiomqtt
from fastapi import WebSocket

from app.core.config import Settings
from app.services import mqtt_consumer
from app.services.simulation.mqtt_publisher import SimulationMqttPublisher
from app.websocket.ws_manager import ConnectionManager


class Client:
    def __init__(self):
        self.disconnected = asyncio.Event()
        self.subscribe = AsyncMock(return_value=[1])
        self.publish = AsyncMock()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    @property
    def messages(self):
        async def stream():
            await self.disconnected.wait()
            raise aiomqtt.MqttError("test disconnect")
            yield  # async iterator; no synthetic telemetry

        return stream()


async def until(predicate):
    async def wait():
        while not predicate():
            await asyncio.sleep(0.005)

    await asyncio.wait_for(wait(), 3)


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_publisher_disconnect_clears_ready_and_reconnects(self):
        first, second = Client(), Client()
        with patch(
            "app.services.simulation.mqtt_publisher.aiomqtt.Client", side_effect=[first, second]
        ):
            publisher = SimulationMqttPublisher()
            publisher._settings = Settings(_env_file=None, mqtt_tls=False)
            await publisher.start()
            try:
                await until(lambda: publisher.connected)
                first.disconnected.set()
                await until(lambda: not publisher.connected)
                self.assertIsNone(publisher._client)
                await until(lambda: publisher._client is second)
                await publisher.publish({"device_id": "test-unit", "seq": 1})
                second.publish.assert_awaited_once()
                self.assertEqual(second.publish.call_args.kwargs["qos"], 1)
            finally:
                await publisher.stop()
            self.assertFalse(publisher.connected)
            self.assertIsNone(publisher._task)

    async def test_consumer_qos_health_disconnect_and_reconnect(self):
        first, second = Client(), Client()
        with (
            patch.object(
                mqtt_consumer, "get_settings", return_value=Settings(_env_file=None, mqtt_tls=False)
            ),
            patch.object(mqtt_consumer.aiomqtt, "Client", side_effect=[first, second]),
        ):
            task = asyncio.create_task(mqtt_consumer.start())
            try:
                await until(lambda: mqtt_consumer.connection_status()["connected"])
                first.subscribe.assert_awaited_once_with("sensors/#", qos=1)
                first.disconnected.set()
                await until(lambda: not mqtt_consumer.connection_status()["connected"])
                await until(lambda: second.subscribe.await_count == 1)
                self.assertTrue(mqtt_consumer.connection_status()["connected"])
            finally:
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
            self.assertFalse(mqtt_consumer.connection_status()["connected"])

    async def test_slow_socket_cannot_block_healthy_socket(self):
        manager = ConnectionManager()
        slow, fast = AsyncMock(spec=WebSocket), AsyncMock(spec=WebSocket)

        async def stalled(*args):
            await asyncio.Event().wait()

        slow.send_text.side_effect = stalled
        manager._connections["test"] = {slow, fast}
        with patch("app.websocket.ws_manager.SEND_TIMEOUT_SECONDS", 0.02):
            await asyncio.wait_for(manager.send_to_device("test", {"seq": 1}), 0.5)
        fast.send_text.assert_awaited_once()
        self.assertEqual(manager._connections["test"], {fast})
