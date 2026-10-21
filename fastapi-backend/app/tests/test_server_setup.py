import tempfile
import unittest
from pathlib import Path

from dotenv import dotenv_values, set_key
from sqlalchemy.engine import make_url

from scripts.setup_managed_server import prepare


class ManagedServerSetupTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        (self.root / "fastapi-backend").mkdir()
        self.backend = self.root / "fastapi-backend/.env"
        set_key(
            str(self.backend),
            "DATABASE_URL",
            "postgresql://cubesat:test%40pass%23@127.0.0.1:5432/cubesat",
        )
        set_key(str(self.backend), "JWT_SECRET", "a" * 48)
        set_key(str(self.backend), "MQTT_PASSWORD", "test-broker-only")
        set_key(str(self.root / ".env"), "TUNNEL_TOKEN", "test-token-only")

    def setup_env(self):
        return prepare(self.root, "pscubesat", 5173, True, "server-db")

    def test_preserves_credentials_and_project_across_repeated_setup(self):
        generated, _ = self.setup_env()
        self.assertFalse(generated)
        first = dotenv_values(self.root / ".env.server", interpolate=False)
        backend = dotenv_values(self.backend, interpolate=False)
        url = make_url(backend["DATABASE_URL"])
        self.assertEqual((url.host, url.port, url.password), ("postgres", 5432, "test@pass#"))
        self.assertEqual(first["POSTGRES_PASSWORD"], url.password)
        self.assertEqual(first["SERVER_PROJECT"], "pscubesat")
        self.assertEqual(first["FRONTEND_PORT"], "5173")
        self.assertEqual(backend["JWT_SECRET"], "a" * 48)
        self.assertEqual(backend["MQTT_PASSWORD"], "test-broker-only")
        self.setup_env()
        self.assertEqual(dotenv_values(self.root / ".env.server", interpolate=False), first)
        self.assertEqual(dotenv_values(self.backend, interpolate=False), backend)

    def test_missing_mqtt_credentials_blocks_before_any_file_is_modified(self):
        set_key(str(self.backend), "JWT_SECRET", "change_me")
        set_key(str(self.backend), "MQTT_PASSWORD", "")
        before = self.backend.read_bytes()
        with self.assertRaisesRegex(RuntimeError, "MQTT_PASSWORD"):
            self.setup_env()
        self.assertFalse((self.root / ".env.server").exists())
        self.assertEqual(self.backend.read_bytes(), before)

    def test_generates_weak_jwt_once_and_keeps_existing_managed_db_password(self):
        set_key(str(self.backend), "JWT_SECRET", "change_me")
        set_key(str(self.root / ".env.server"), "POSTGRES_PASSWORD", "test-managed-password")
        generated, reused = self.setup_env()
        self.assertTrue(generated)
        self.assertTrue(reused)
        first = dotenv_values(self.backend, interpolate=False)
        self.assertGreaterEqual(len(first["JWT_SECRET"]), 32)
        self.assertEqual(make_url(first["DATABASE_URL"]).password, "test-managed-password")
        self.assertFalse(self.setup_env()[0])
        self.assertEqual(
            dotenv_values(self.backend, interpolate=False)["JWT_SECRET"], first["JWT_SECRET"]
        )

    def test_missing_tunnel_token_does_not_edit_env(self):
        (self.root / ".env").unlink()
        before = self.backend.read_bytes()
        with self.assertRaisesRegex(RuntimeError, "TUNNEL_TOKEN"):
            self.setup_env()
        self.assertEqual(self.backend.read_bytes(), before)
        self.assertFalse((self.root / ".env.server").exists())

    def test_reuses_legacy_network_and_retains_it_on_subsequent_setup(self):
        prepare(self.root, "pscubesat", 5173, True, "server-db", "pscubesat_cubesat_net")
        server = dotenv_values(self.root / ".env.server", interpolate=False)
        self.assertEqual(server["SERVER_NETWORK_NAME"], "pscubesat_cubesat_net")
        self.assertEqual(server["SERVER_NETWORK_EXTERNAL"], "true")
        self.setup_env()
        self.assertEqual(dotenv_values(self.root / ".env.server", interpolate=False), server)
