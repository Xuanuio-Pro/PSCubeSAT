"""Exercise built release images against isolated legacy PostgreSQL, Redis and MQTT.

Only random test-prefixed containers/network/volumes are removed. No production
credentials, public domain, existing database or hardware are used.
"""

import argparse
import hashlib
import json
import subprocess
import time
from pathlib import Path
from uuid import uuid4

import httpx

ROOT = Path(__file__).resolve().parents[1]


def command(*args, check=True, input=None):
    return subprocess.run(
        args,
        cwd=ROOT,
        input=input,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=check,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database", choices=("external", "managed"), default="external"
    )
    args = parser.parse_args()
    managed = args.database == "managed"
    prefix = "pscubesat-release-test-" + uuid4().hex[:8]
    folder = ROOT / "scratch" / prefix
    folder.mkdir(parents=True)
    database, broker = prefix + "-db", prefix + "-mqtt"
    database_network = prefix + "-database"
    backend_env = folder / "backend.env"
    backend_env.write_text(
        (
            "DATABASE_URL=postgresql://unused:unused@127.0.0.1:1/unused\n"
            if managed
            else "DATABASE_URL=postgresql://test:test-only@db/test\n"
        )
        + "JWT_SECRET="
        + uuid4().hex
        + uuid4().hex
        + "\n"
        + "MQTT_HOST=mqtt\nMQTT_PORT=1883\nMQTT_USERNAME=test\nMQTT_PASSWORD=test-only\n"
        + "MQTT_TLS=false\nMQTT_TLS_VERIFY=true\nMQTT_TOPIC=sensors/#\n"
        + "GOOGLE_CLIENT_ID=\nCOMPILER_IMAGE=pscubesat-compiler:1\n",
        encoding="utf-8",
    )
    root_env = folder / "compose.env"
    root_env.write_text(
        f"SITE_DOMAIN=cubesat.p-tech.xyz\nRELEASE_TAG=server-review\nFRONTEND_PORT=0\nBACKEND_ENV_FILE={backend_env.as_posix()}\nDATABASE_NETWORK={database_network}\n"
        "POSTGRES_DB=test\nPOSTGRES_USER=test\nPOSTGRES_PASSWORD=test-only@:/?#%\n",
        encoding="utf-8",
    )
    (folder / "mosquitto.conf").write_text(
        "listener 1883\nallow_anonymous true\n", encoding="utf-8"
    )
    override = folder / "test.json"
    override.write_text(
        json.dumps({"networks": {"cubesat_net": {"external": True, "name": prefix}}}),
        encoding="utf-8",
    )
    compose = [
        "docker",
        "compose",
        "--project-directory",
        str(ROOT),
        "--env-file",
        str(root_env),
        "-p",
        prefix,
        "-f",
        "docker-compose.server.yml",
        "-f",
        "docker-compose.postgres.yml" if managed else "docker-compose.database.yml",
        "-f",
        str(override),
    ]
    try:
        command("docker", "network", "create", prefix)
        if managed:
            command(*compose, "up", "-d", "--wait", "postgres")
        else:
            command("docker", "network", "create", database_network)
            prepare_external_database(database, database_network)
        command(
            "docker",
            "run",
            "-d",
            "--name",
            broker,
            "--network",
            prefix,
            "--network-alias",
            "mqtt",
            "-v",
            f"{(folder / 'mosquitto.conf').as_posix()}:/mosquitto/config/mosquitto.conf:ro",
            "eclipse-mosquitto:2",
        )
        # Read-only probe before migration, on a separate external DB network or
        # on a fresh managed DB with a URL-sensitive password and stale env URL.
        command(
            *compose,
            "run",
            "--rm",
            "--no-deps",
            "migrate",
            "python",
            "server_preflight.py",
            "--database",
        )
        command(*compose, "up", "-d", "--no-build", "--wait", "--wait-timeout", "120")
        command(*compose, "run", "--rm", "--no-deps", "migrate")
        command(
            *compose,
            "run",
            "--rm",
            "--no-deps",
            "fastapi",
            "python",
            "server_preflight.py",
            "--live",
        )
        if not managed:
            kept = command(
                "docker",
                "exec",
                database,
                "psql",
                "-U",
                "test",
                "-d",
                "test",
                "-Atqc",
                "SELECT count(*) FROM users WHERE email='legacy@example.test'",
            ).stdout.strip()
            assert kept == "1"
        exercise_api(compose, broker, managed)
        print(
            f"PASS {args.database} DB: probe, migration/idempotency, health/start order, auth, MQTT->API, real compiler, artifact hashes, API restart"
        )
    finally:
        command(*compose, "down", "-v", "--remove-orphans", check=False)
        for name in [broker] if managed else [broker, database]:
            command("docker", "rm", "-f", "-v", name, check=False)
        command("docker", "network", "rm", prefix, check=False)
        if not managed:
            command("docker", "network", "rm", database_network, check=False)
        # Test secrets are no longer needed; keep no plaintext environment fixture.
        backend_env.unlink(missing_ok=True)


def prepare_external_database(database, database_network):
    command(
        "docker",
        "run",
        "-d",
        "--name",
        database,
        "--network",
        database_network,
        "--network-alias",
        "db",
        "-e",
        "POSTGRES_USER=test",
        "-e",
        "POSTGRES_PASSWORD=test-only",
        "-e",
        "POSTGRES_DB=test",
        "postgres:17-alpine",
    )
    for _ in range(40):
        if (
            command(
                "docker",
                "exec",
                database,
                "pg_isready",
                "-U",
                "test",
                "-d",
                "test",
                check=False,
            ).returncode
            == 0
        ):
            break
        time.sleep(0.5)
    # Rehearse adoption of an old, populated schema rather than only a blank DB.
    sql = (ROOT / "fastapi-backend/alembic/versions/0001_baseline.sql").read_text(
        encoding="utf-8"
    )
    sql += "\nINSERT INTO users(email,password_hash) VALUES ('legacy@example.test','test-only');\n"
    command(
        "docker",
        "exec",
        "-i",
        database,
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "test",
        "-d",
        "test",
        input=sql,
    )


def exercise_api(compose, broker, managed):
    port = command(*compose, "port", "frontend", "80").stdout.strip().rsplit(":", 1)[1]
    with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=90) as client:
        html = client.get("/lab1")
        assert (
            html.status_code == 200
            and html.headers["permissions-policy"] == "serial=(self)"
        )
        assert client.get("/assets/missing.js").status_code == 404
        assert client.get("/api/boards").status_code == 401
        registered = client.post(
            "/api/auth/register",
            json={"email": "release@example.com", "password": "test-password-123"},
        )
        assert registered.status_code == 201, registered.status_code
        headers = {"Authorization": "Bearer " + registered.json()["access_token"]}
        health = client.get("/api/health", headers=headers)
        assert health.status_code == 200 and health.json()["compiler_installed"]
        device = client.post(
            "/api/devices/register",
            headers=headers,
            json={"device_name": "Release test"},
        )
        assert device.status_code == 201
        uid = device.json()["device_uid"]
        payload = json.dumps(
            {
                "device_id": uid,
                "type": "telemetry",
                "temperature": 28.5,
                "voltage": 3.8,
            }
        )
        for _ in range(20):
            command(
                "docker",
                "exec",
                broker,
                "mosquitto_pub",
                "-t",
                f"sensors/{uid}/telemetry",
                "-m",
                payload,
            )
            time.sleep(0.3)
            latest = client.get(f"/api/telemetry/latest/{uid}", headers=headers)
            if latest.json().get("found"):
                break
        assert latest.json().get("found"), "MQTT sample did not reach the API"
        template = client.get(
            "/api/labs/1/template?board=esp32", headers=headers
        ).json()
        compiled = client.post(
            "/api/compile",
            headers=headers,
            json={
                "code": template["code"],
                "board": "esp32",
                "include_binary": False,
            },
        )
        assert compiled.status_code == 200 and compiled.json().get("success"), (
            "Real sandbox compile failed"
        )
        artifact = compiled.json()["artifact"]
        for image in artifact["flash"]["files"]:
            binary = client.get(image["download_url"], headers=headers)
            assert binary.status_code == 200
            assert hashlib.sha256(binary.content).hexdigest() == image["sha256"]
        if managed:
            # Recreate the DB container while preserving its named volume. The
            # registered user and password must survive and stale pools reconnect.
            command(*compose, "up", "-d", "--force-recreate", "--wait", "postgres")
            login = client.post(
                "/api/auth/login",
                json={"email": "release@example.com", "password": "test-password-123"},
            )
            assert login.status_code == 200, "Managed DB volume did not preserve user"
        command(*compose, "restart", "fastapi")
        for _ in range(50):
            time.sleep(0.4)
            try:
                if client.get("/api/boards", headers=headers).status_code == 200:
                    break
            except httpx.HTTPError:
                pass
        assert client.get("/api/boards", headers=headers).status_code == 200


if __name__ == "__main__":
    main()
