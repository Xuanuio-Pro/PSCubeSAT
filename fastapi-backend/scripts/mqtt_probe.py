"""Phase 0 diagnostics. No broker configuration or existing client is changed.

Run from any directory: python fastapi-backend/scripts/mqtt_probe.py
Only publishes a non-retained nonce to test/codex/probe, and, if admin
credentials exist, a read-only listClients request to the dynsec API.
Exit 0: server + Mosquitto dynsec gate passed; 2: stop before Phase 1.
"""

from __future__ import annotations

import argparse
import asyncio
import ipaddress
import json
import secrets
import socket
import ssl
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import aiomqtt
from aiomqtt.exceptions import MqttConnectError

from app.core.config import Settings, get_settings
from app.core.mqtt_transport import mqtt_tls_context

TIMEOUT = 5.0
PROBE_TOPIC = "test/codex/probe"
CONTROL_TOPIC = "$CONTROL/dynamic-security/v1"
RESPONSE_TOPIC = CONTROL_TOPIC + "/response"


@dataclass
class Step:
    name: str
    status: str
    detail: str


@dataclass
class Report:
    host: str
    port: int
    username: str
    tls: bool
    broker: str = "unknown"
    version: str = "unknown"
    dynsec: str = "unknown"
    phase1_ready: bool = False
    tls_verified: bool = False
    steps: list[Step] = field(default_factory=list)


def redact(text: str, settings: Settings) -> str:
    for value in (settings.mqtt_password, settings.mqtt_admin_password):
        if value:
            text = text.replace(value, "[REDACTED]")
    # Broker strings are data: prevent multiline/terminal control injection.
    return "".join(c if c.isprintable() else " " for c in text)[:1000]


def error_detail(exc: Exception, settings: Settings) -> str:
    code = getattr(exc, "rc", None)
    detail = f"{type(exc).__name__}: {exc}"
    if code is not None:
        detail += f" (CONNACK/reason={code})"
    if isinstance(exc, MqttConnectError) and isinstance(code, int):
        # aiomqtt 2.3's generic error_string is not a CONNACK lookup.
        detail += "; " + {
            1: "Incorrect protocol version",
            2: "Invalid client identifier",
            3: "Server unavailable",
            4: "Bad username or password",
            5: "Not authorized",
        }.get(code, "Unknown CONNACK")
    return redact(detail, settings)


def tls_context(settings: Settings) -> ssl.SSLContext | None:
    return mqtt_tls_context(settings)


async def connect_tcp(host: str, port: int, context: ssl.SSLContext | None = None) -> None:
    kwargs: dict[str, Any] = {}
    if context:
        kwargs = {"ssl": context, "server_hostname": host, "ssl_handshake_timeout": TIMEOUT}
    _, writer = await asyncio.open_connection(host, port, **kwargs)
    try:
        writer.close()
        await asyncio.wait_for(writer.wait_closed(), TIMEOUT)
    finally:
        writer.close()


async def receive(client: aiomqtt.Client, topic: str, predicate):
    async for message in client.messages:
        if str(message.topic) == topic and predicate(message.payload):
            return message.payload
    raise ConnectionError("MQTT message stream ended")


async def subscribe(client: aiomqtt.Client, topic: str) -> None:
    codes = await client.subscribe(topic, qos=1)
    for code in codes or []:
        if getattr(code, "value", code) >= 128:
            raise PermissionError(f"SUBACK rejected: {code}")


async def probe(settings: Settings) -> Report:
    report = Report(
        settings.mqtt_host, settings.mqtt_port, settings.mqtt_username, settings.mqtt_tls
    )

    async def step(name, operation, failure="FAIL"):
        try:
            result = await asyncio.wait_for(operation(), TIMEOUT)
            report.steps.append(Step(name, "PASS", "OK"))
            return True, result
        except Exception as exc:
            report.steps.append(Step(name, failure, error_detail(exc, settings)))
            return False, None

    ok, addresses = await step(
        "DNS",
        lambda: asyncio.get_running_loop().getaddrinfo(
            settings.mqtt_host, settings.mqtt_port, type=socket.SOCK_STREAM
        ),
    )
    if not ok:
        report.steps.append(
            Step("Gate", "STOP", "DNS failed; TCP/TLS/CONNECT and Phase 1 skipped.")
        )
        return report
    is_local = any(ipaddress.ip_address(item[4][0].split("%")[0]).is_loopback for item in addresses)
    report.steps.append(
        Step(
            "Server topology",
            "FAIL" if is_local else "PASS",
            "Host resolves to loopback; server topology not satisfied."
            if is_local
            else "Non-loopback address.",
        )
    )
    # A small, explicitly requested listener survey; TCP open does not prove protocol/TLS/WS.
    for port in (1883, 8883, 8083, 8084):
        await step(
            f"TCP port {port}", lambda p=port: connect_tcp(settings.mqtt_host, p), "UNAVAILABLE"
        )
    ok, _ = await step(
        "TCP configured", lambda: connect_tcp(settings.mqtt_host, settings.mqtt_port)
    )
    if not ok:
        report.steps.append(
            Step("Gate", "STOP", "Configured TCP connection failed; check listener/firewall/port.")
        )
        return report
    context = None
    if settings.mqtt_tls:

        async def handshake():
            nonlocal context
            context = tls_context(settings)
            await connect_tcp(settings.mqtt_host, settings.mqtt_port, context)

        ok, _ = await step(
            "TLS verified handshake"
            if settings.mqtt_tls_verify
            else "TLS handshake (verification disabled)",
            handshake,
        )
        report.tls_verified = ok and settings.mqtt_tls_verify
        if not ok:
            report.steps.append(
                Step("Gate", "STOP", "TLS failed; check CA, hostname/SAN and listener.")
            )
            return report
    else:
        report.steps.append(
            Step("TLS", "SKIP", "MQTT_TLS=false; plaintext transport explicitly selected.")
        )

    def client(admin=False):
        return aiomqtt.Client(
            hostname=settings.mqtt_host,
            port=settings.mqtt_port,
            username=settings.mqtt_admin_username if admin else settings.mqtt_username,
            password=settings.mqtt_admin_password if admin else settings.mqtt_password,
            identifier="codex-probe-" + secrets.token_hex(8),
            tls_context=context,
            timeout=TIMEOUT,
        )

    mqtt = client()
    ok, _ = await step("MQTT CONNECT", mqtt.__aenter__)
    if not ok:
        report.steps.append(
            Step(
                "Gate",
                "STOP",
                "CONNECT failed; check credentials, authorization and MQTT listener.",
            )
        )
        return report
    subscribed = False
    try:
        subscribed, _ = await step("Subscribe sensors/#", lambda: subscribe(mqtt, "sensors/#"))

        async def loopback():
            await subscribe(mqtt, PROBE_TOPIC)
            nonce = secrets.token_hex(16).encode()
            await mqtt.publish(PROBE_TOPIC, nonce, qos=1, retain=False)
            await receive(mqtt, PROBE_TOPIC, lambda payload: payload == nonce)

        await step("Test loopback", loopback, "INCONCLUSIVE")
        if report.steps[-1].status != "PASS":
            report.steps[
                -1
            ].detail += "; optional: ACL denial or timeout is not a core connection failure."

        async def version():
            await subscribe(mqtt, "$SYS/broker/version")
            raw = await receive(mqtt, "$SYS/broker/version", lambda _: True)
            value = bytes(raw).decode("utf-8", errors="replace")
            report.version = redact(value, settings)
            lower = value.lower()
            report.broker = next(
                (name for name in ("mosquitto", "emqx", "hivemq") if name in lower), "unknown"
            )

        await step("Broker version", version, "UNKNOWN")
    finally:
        await step("Service disconnect", lambda: mqtt.__aexit__(None, None, None), "WARN")

    if report.broker not in ("mosquitto", "unknown"):
        report.steps.append(
            Step(
                "Gate", "STOP", "Non-Mosquitto broker detected; choose its provisioning API first."
            )
        )
        return report
    if not (settings.mqtt_admin_username and settings.mqtt_admin_password):
        report.steps.append(
            Step(
                "Dynamic security",
                "UNKNOWN",
                "MQTT_ADMIN_USERNAME/PASSWORD not configured; no admin request sent.",
            )
        )
    else:

        async def dynsec():
            async with client(admin=True) as admin:
                await subscribe(admin, RESPONSE_TOPIC)
                correlation = secrets.token_hex(16)

                def matches(raw):
                    try:
                        body = json.loads(raw)
                        return (
                            isinstance(body, dict)
                            and isinstance(body.get("responses"), list)
                            and any(
                                isinstance(r, dict)
                                and r.get("command") == "listClients"
                                and r.get("correlationData") == correlation
                                for r in body.get("responses", [])
                            )
                        )
                    except (ValueError, TypeError):
                        return False

                command = {
                    "commands": [
                        {
                            "command": "listClients",
                            "count": 1,
                            "verbose": False,
                            "correlationData": correlation,
                        }
                    ]
                }
                await admin.publish(CONTROL_TOPIC, json.dumps(command), qos=1, retain=False)
                raw = await receive(admin, RESPONSE_TOPIC, matches)
                response = next(
                    r
                    for r in json.loads(raw)["responses"]
                    if r.get("command") == "listClients" and r.get("correlationData") == correlation
                )
                if response.get("error"):
                    raise PermissionError(str(response["error"]))
                if not isinstance(response.get("data"), dict) or "clients" not in response["data"]:
                    raise ValueError("Unexpected listClients response data")
                report.dynsec = "available (listClients authorized)"
                report.broker = (
                    "mosquitto-dynsec-compatible" if report.broker == "unknown" else report.broker
                )

        await step("Dynamic security listClients", dynsec, "UNKNOWN")

    report.phase1_ready = not is_local and subscribed and report.dynsec.startswith("available")
    report.steps.append(
        Step(
            "Gate",
            "PASS" if report.phase1_ready else "STOP",
            "Phase 1 prerequisites verified."
            if report.phase1_ready
            else "Phase 1 blocked: require server endpoint, telemetry subscription and verified admin provisioning API.",
        )
    )
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json-output", type=Path, help="Save sanitized report (no credentials/payloads)."
    )
    args = parser.parse_args()
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        settings = get_settings()
    except Exception as exc:
        # Pydantic exceptions may include env input values: never print them.
        print(f"CONFIG FAIL: {type(exc).__name__}; check environment value types.")
        return 2
    report = asyncio.run(probe(settings))
    print(
        f"Broker endpoint: {report.host}:{report.port}; username={report.username}; TLS={report.tls}"
    )
    print("| Step | Status | Detail |")
    print("|---|---|---|")
    for row in report.steps:
        print(f"| {row.name} | {row.status} | {row.detail.replace(chr(124), chr(47))} |")
    print(f"Broker={report.broker}; version={report.version}; dynamic-security={report.dynsec}")
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(
            json.dumps(asdict(report), ensure_ascii=False, indent=2), encoding="utf-8"
        )
    return 0 if report.phase1_ready else 2


if __name__ == "__main__":
    raise SystemExit(main())
