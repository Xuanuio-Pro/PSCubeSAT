import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.models.telemetry import TelemetryFrame, TelemetryPayload


class TelemetryWireTests(unittest.TestCase):
    def test_ws_init_and_live_use_the_canonical_contract(self):
        from app.main import app
        from app.websocket.ws_manager import ws_manager

        frame = TelemetryPayload(device_id="wire-test", acc_z=0, temperature=0).normalized()
        with (
            patch("app.websocket.routes.authorize_telemetry_socket", AsyncMock(return_value=True)),
            patch("app.websocket.routes.get_latest_state", return_value=frame),
        ):
            with TestClient(app).websocket_connect(
                "/ws/devices/wire-test?token=test-only"
            ) as socket:
                initial = socket.receive_json()
                self.assertEqual(initial["type"], "init")
                TelemetryFrame.model_validate(initial["device"])
                self.assertEqual(initial["device"]["temperatureC"], 0)
                socket.portal.call(ws_manager.send_to_device, "wire-test", frame)
                live = socket.receive_json()
                self.assertEqual(live, initial["device"])
                self.assertEqual(live["schema_version"], 1)
                self.assertIsNone(live["voltageV"])
