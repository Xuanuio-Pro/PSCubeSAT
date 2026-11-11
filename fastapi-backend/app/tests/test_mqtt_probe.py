import asyncio
import json
import socket
import ssl
import unittest
from unittest.mock import AsyncMock, patch

from aiomqtt.exceptions import MqttConnectError

from app.core.config import Settings
from app.core.mqtt_transport import mqtt_error_detail
from scripts import mqtt_probe as probe


def config(**kwargs):
    return Settings(
        _env_file=None, mqtt_host="broker.example.test", mqtt_password="service-secret", **kwargs
    )


class FakeClient:
    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.published = []
        self.__class__.instances.append(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def subscribe(self, topic, **kwargs):
        return [1]

    async def publish(self, topic, payload, **kwargs):
        self.published.append((topic, payload, kwargs))


class ProbeTests(unittest.IsolatedAsyncioTestCase):
    async def run_probe(self, settings, address="192.0.2.1", receive=None):
        async def incoming(client, topic, predicate):
            if topic == probe.PROBE_TOPIC:
                return client.published[-1][1]
            if topic == "$SYS/broker/version":
                return b"mosquitto version 2.0.22"
            command = json.loads(client.published[-1][1])["commands"][0]
            value = json.dumps({"responses": [{**command, "data": {"clients": []}}]}).encode()
            self.assertTrue(predicate(value))
            self.assertFalse(predicate(b'{"responses": null}'))
            self.assertFalse(predicate(b'{"responses": []}'))
            return value

        FakeClient.instances = []
        with (
            patch.object(
                asyncio.get_running_loop(),
                "getaddrinfo",
                AsyncMock(
                    return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 1883))]
                ),
            ),
            patch.object(probe, "connect_tcp", AsyncMock()),
            patch.object(probe.aiomqtt, "Client", FakeClient),
            patch.object(probe, "receive", receive or incoming),
        ):
            return await probe.probe(settings)

    async def test_server_dynsec_gate_and_only_authorized_publishes(self):
        result = await self.run_probe(
            config(mqtt_admin_username="admin", mqtt_admin_password="admin-secret")
        )
        self.assertTrue(result.phase1_ready)
        self.assertEqual(result.broker, "mosquitto")
        sent = [p for c in FakeClient.instances for p in c.published]
        self.assertEqual([p[0] for p in sent], [probe.PROBE_TOPIC, probe.CONTROL_TOPIC])
        self.assertTrue(all(p[2]["retain"] is False for p in sent))
        admin_request = json.loads(sent[1][1])["commands"][0]
        self.assertEqual(admin_request["command"], "listClients")
        self.assertEqual(admin_request["count"], 1)

    async def test_loopback_does_not_satisfy_server_requirement(self):
        result = await self.run_probe(
            config(mqtt_admin_username="admin", mqtt_admin_password="secret"), address="127.0.0.1"
        )
        self.assertFalse(result.phase1_ready)

    async def test_missing_admin_stops_without_control_publish(self):
        result = await self.run_probe(config())
        self.assertFalse(result.phase1_ready)
        self.assertEqual(result.dynsec, "unknown")
        self.assertEqual(len(FakeClient.instances), 1)

    async def test_optional_loopback_timeout_does_not_fail_gate(self):
        async def incoming(client, topic, predicate):
            if topic == probe.PROBE_TOPIC:
                raise asyncio.TimeoutError("No authorized echo")
            if topic == "$SYS/broker/version":
                return b"mosquitto version 2"
            command = json.loads(client.published[-1][1])["commands"][0]
            return json.dumps({"responses": [{**command, "data": {"clients": []}}]}).encode()

        result = await self.run_probe(
            config(mqtt_admin_username="admin", mqtt_admin_password="secret"), receive=incoming
        )
        self.assertTrue(result.phase1_ready)
        self.assertEqual(
            next(s for s in result.steps if s.name == "Test loopback").status, "INCONCLUSIVE"
        )

    async def test_dns_failure_stops_before_network_mutation(self):
        with (
            patch.object(
                asyncio.get_running_loop(),
                "getaddrinfo",
                AsyncMock(side_effect=socket.gaierror("DNS failure")),
            ),
            patch.object(probe.aiomqtt, "Client") as client,
        ):
            result = await probe.probe(config())
        self.assertFalse(result.phase1_ready)
        self.assertEqual(result.steps[0].status, "FAIL")
        client.assert_not_called()

    async def test_suback_denial_is_not_success(self):
        client = AsyncMock()
        client.subscribe.return_value = [128]
        with self.assertRaises(PermissionError):
            await probe.subscribe(client, "sensors/#")

    async def test_tls_failure_stops_before_mqtt_connect(self):
        with (
            patch.object(
                asyncio.get_running_loop(),
                "getaddrinfo",
                AsyncMock(
                    return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.1", 8883))]
                ),
            ),
            patch.object(probe, "connect_tcp", AsyncMock()),
            patch.object(probe, "tls_context", side_effect=ssl.SSLError("Certificate invalid")),
            patch.object(probe.aiomqtt, "Client") as client,
        ):
            result = await probe.probe(config(mqtt_tls=True))
        self.assertFalse(result.phase1_ready)
        self.assertEqual(
            next(s.status for s in result.steps if s.name == "TLS verified handshake"), "FAIL"
        )
        client.assert_not_called()

    async def test_connect_denied_stops_without_publishing(self):
        class DeniedClient(FakeClient):
            async def __aenter__(self):
                raise MqttConnectError(5)

        with (
            patch.object(
                asyncio.get_running_loop(),
                "getaddrinfo",
                AsyncMock(
                    return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.1", 1883))]
                ),
            ),
            patch.object(probe, "connect_tcp", AsyncMock()),
            patch.object(probe.aiomqtt, "Client", DeniedClient),
        ):
            result = await probe.probe(config())
        self.assertFalse(result.phase1_ready)
        self.assertFalse(DeniedClient.instances[-1].published)
        self.assertIn(
            "Not authorized", next(s.detail for s in result.steps if s.name == "MQTT CONNECT")
        )

    async def test_dynsec_error_cannot_open_gate(self):
        async def incoming(client, topic, predicate):
            if topic == probe.PROBE_TOPIC:
                return client.published[-1][1]
            if topic == "$SYS/broker/version":
                return b"mosquitto version 2"
            command = json.loads(client.published[-1][1])["commands"][0]
            return json.dumps({"responses": [{**command, "error": "Access denied"}]}).encode()

        result = await self.run_probe(
            config(mqtt_admin_username="admin", mqtt_admin_password="secret"), receive=incoming
        )
        self.assertFalse(result.phase1_ready)
        self.assertIn(
            "Access denied",
            next(s.detail for s in result.steps if s.name == "Dynamic security listClients"),
        )

    def test_tls_validates_hostname_and_public_ca_without_port_heuristic(self):
        context = probe.tls_context(config(mqtt_tls=True, mqtt_port=1883))
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertIsNone(probe.tls_context(config(mqtt_tls=False, mqtt_port=8883)))

    def test_insecure_tls_is_explicit_and_ignores_untrusted_ca(self):
        context = probe.tls_context(
            config(mqtt_tls=True, mqtt_tls_verify=False, mqtt_ca_file="missing-ca.crt")
        )
        self.assertFalse(context.check_hostname)
        self.assertEqual(context.verify_mode, ssl.CERT_NONE)
        self.assertTrue(config().mqtt_tls_verify)

    def test_verified_tls_does_not_fall_back_if_ca_is_missing(self):
        with self.assertRaises(FileNotFoundError):
            probe.tls_context(config(mqtt_tls=True, mqtt_ca_file="missing-ca.crt"))

    def test_credentials_redacted_and_connack_preserved(self):
        settings = config(mqtt_admin_password="admin-secret")
        text = mqtt_error_detail(ValueError("service-secret admin-secret\n"), settings)
        self.assertNotIn("service-secret", text)
        self.assertNotIn("admin-secret", text)
        self.assertNotIn("\n", text)
        detail = mqtt_error_detail(MqttConnectError(5), settings)
        self.assertIn("5", detail)
        self.assertIn("authorized", detail.lower())
