"""Provision local dev Redis/MQTT; never modify production broker accounts."""

import secrets
import subprocess
from pathlib import Path
from urllib.parse import urlparse

from dotenv import set_key

from app.core.config import get_settings

ROOT = Path(__file__).resolve().parent


def main():
    settings = get_settings()
    services = []
    redis = urlparse(settings.redis_url)
    if redis.hostname in ("localhost", "127.0.0.1") and redis.port == 6379:
        if redis.password:
            raise SystemExit(
                "Local Redis password configured; configure your own Redis service instead."
            )
        services.append("redis")
    if settings.mqtt_host in ("localhost", "127.0.0.1") and settings.mqtt_port == 1883:
        user = settings.mqtt_username
        if not user or any(c in user for c in ":\r\n"):
            raise SystemExit("Invalid local MQTT service username.")
        password = settings.mqtt_password
        if not password:
            password = secrets.token_urlsafe(32)
            set_key(ROOT / ".env", "MQTT_PASSWORD", password)
        if any(c in password for c in "\r\n"):
            raise SystemExit("Local MQTT password cannot contain line breaks.")
        config = ROOT / "data/local-services/config"
        config.mkdir(parents=True, exist_ok=True)
        password_file = config / "passwd"
        password_file.write_text(f"{user}:{password}\n", encoding="utf-8")
        try:
            # Plaintext exists only in the ignored local file during conversion,
            # never in process arguments, command output or committed config.
            subprocess.run(
                [
                    "docker",
                    "run",
                    "--rm",
                    "--entrypoint",
                    "mosquitto_passwd",
                    "-v",
                    f"{config.as_posix()}:/setup",
                    "eclipse-mosquitto:2",
                    "-U",
                    "/setup/passwd",
                ],
                check=True,
            )
        except BaseException:
            password_file.unlink(missing_ok=True)
            raise
        (config / "acl").write_text(
            f"user {user}\ntopic readwrite sensors/#\ntopic readwrite cmd/#\n", encoding="utf-8"
        )
        (config / "mosquitto.conf").write_text(
            "listener 1883\nallow_anonymous false\npassword_file /mosquitto/config/passwd\n"
            "acl_file /mosquitto/config/acl\nlog_dest stdout\npersistence false\n",
            encoding="utf-8",
        )
        services.append("mqtt")
    if services:
        compose = ["docker", "compose", "-f", str(ROOT.parent / "docker-compose.dev.yml")]
        subprocess.run([*compose, "up", "-d", "--wait", *services], check=True)
        if "mqtt" in services:
            # Reload credentials when an existing local broker is reused.
            subprocess.run([*compose, "kill", "-s", "HUP", "mqtt"], check=True)
        print("Local development services ready: " + ", ".join(services))
    else:
        print("External Redis/MQTT configured; no local services started.")


if __name__ == "__main__":
    main()
