"""Concurrent Lab Test / progress / dashboard load test against a real uvicorn + PostgreSQL.

Creates an isolated database `pscubesat_load_<hex>`, migrates it with the Alembic CLI,
starts one uvicorn worker (production uses --workers 1) and drops the database at the end.
It never connects to the application database.

Usage (from fastapi-backend/): python scripts/load_test.py [--students 300] [--out FILE]
Needs POSTGRES_PASSWORD and POSTGRES_ADMIN_PASSWORD in .env (same as the PG tests).
"""

import argparse
import asyncio
import json
import os
import platform
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import asyncpg
import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.security import create_access_token, hash_password  # noqa: E402

ENV = dotenv_values(ROOT / ".env")


def question(index):
    # Synthetic mechanics-only content; choice "a" is the key. Not curriculum material.
    return {
        "prompt": f"Load fixture {uuid4()} {index}",
        "choices": [{"id": key, "text": "Lựa chọn " + key} for key in "abcd"],
        "correct_choice_id": "a",
        "explanation": "Chỉ dùng cho kiểm thử tải.",
        "objective": "Load test",
        "difficulty": "medium",
        "source_reference": "document: load-test",
    }


async def admin():
    return await asyncpg.connect(
        host="127.0.0.1",
        user="postgres",
        password=ENV["POSTGRES_ADMIN_PASSWORD"],
        database="postgres",
    )


def percentile(values, q):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(q * (len(ordered) - 1))))]


async def phase(client, name, requests):
    async def one(token, method, url, body):
        started = time.perf_counter()
        try:
            response = await client.request(
                method, url, json=body, headers={"Authorization": f"Bearer {token}"}
            )
            code = response.json().get("code") if response.status_code >= 400 else None
            return response.status_code, code, time.perf_counter() - started, response
        except httpx.HTTPError as exc:
            return 0, type(exc).__name__, time.perf_counter() - started, None

    started = time.perf_counter()
    results = await asyncio.gather(*[one(*r) for r in requests])
    wall = time.perf_counter() - started
    latencies = [r[2] for r in results]
    statuses = {}
    for status, code, _, _ in results:
        key = f"{status}" + (f":{code}" if code else "")
        statuses[key] = statuses.get(key, 0) + 1
    summary = {
        "phase": name,
        "requests": len(results),
        "wall_seconds": round(wall, 2),
        "throughput_rps": round(len(results) / wall, 1),
        "p50_ms": round(statistics.median(latencies) * 1000),
        "p95_ms": round(percentile(latencies, 0.95) * 1000),
        "p99_ms": round(percentile(latencies, 0.99) * 1000),
        "max_ms": round(max(latencies) * 1000),
        "statuses": statuses,
    }
    print(json.dumps(summary, ensure_ascii=False))
    return summary, [r[3] for r in results]


async def ok(client, token, method, url, body=None):
    response = await client.request(
        method, url, json=body, headers={"Authorization": f"Bearer {token}"}
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Setup failed {method} {url}: {response.status_code} {response.text}")
    return response.json()


async def setup_course(client, teacher, base):
    draft = await ok(client, teacher, "GET", base + "/curriculum?draft=true")

    def payload(config):
        return {
            "course_version_id": config["course_version_id"],
            "expected_version": config["version"],
            "labs": [
                {"lab_id": x["id"], "enabled": x["enabled"], "prerequisites": x["prerequisites"]}
                for x in config["labs"]
            ],
            "lessons": [
                {
                    "lesson_id": item["id"],
                    **{k: item[k] for k in ("enabled", "required", "order_no", "params")},
                }
                for x in config["labs"]
                for item in x["lessons"]
            ],
        }

    body = payload(draft)
    for item in body["lessons"]:
        item["required"] = item["lesson_id"] == "document" or item["lesson_id"].startswith(
            "summary-"
        )
        if item["lesson_id"] == "document":
            item["params"] = {"markdown": "Tài liệu kiểm thử tải."}

    async def apply(body):
        saved = await ok(client, teacher, "PUT", base + "/settings", body)
        body = payload(saved)
        await ok(
            client,
            teacher,
            "POST",
            base + "/publish",
            {"expected_version": body["expected_version"]},
        )
        return body

    body = await apply(body)
    bank_url = base + "/labs/0/question-bank"
    bank = await ok(client, teacher, "GET", bank_url)
    bank = await ok(
        client,
        teacher,
        "POST",
        bank_url + "/import",
        {
            "expected_revision": bank["revision"],
            "format": "json",
            "content": json.dumps({"questions": [question(i) for i in range(20)]}),
        },
    )
    for item in bank["questions"]:
        bank = await ok(
            client,
            teacher,
            "POST",
            f"{bank_url}/questions/{item['id']}/review",
            {"expected_revision": bank["revision"], "status": "approved"},
        )
    await ok(
        client, teacher, "POST", bank_url + "/publish", {"expected_revision": bank["revision"]}
    )
    for item in body["lessons"]:
        if item["lesson_id"] == "labtest-0":
            item.update(enabled=True, required=True)
    await apply(body)


async def run(args):
    name = "pscubesat_load_" + uuid4().hex
    connection = await admin()
    try:
        await connection.execute(f'CREATE DATABASE "{name}" OWNER cubesat')
    finally:
        await connection.close()
    url = f"postgresql+asyncpg://cubesat:{ENV['POSTGRES_PASSWORD']}@127.0.0.1:5432/{name}"
    env = {**os.environ, "DATABASE_URL": url, "LMS_CLASS_MODE": "true"}
    server = None
    log = open(args.server_log, "w", encoding="utf-8")
    try:
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            env=env,
            cwd=ROOT,
            check=True,
            capture_output=True,
        )
        subprocess.run(
            [sys.executable, "-m", "app.services.curriculum_seed"],
            env=env,
            cwd=ROOT,
            check=True,
            capture_output=True,
        )
        db = await asyncpg.connect(url.replace("postgresql+asyncpg", "postgresql"))
        try:
            secret = hash_password("load-test-only")
            n = args.students
            await db.execute(
                "INSERT INTO users(id,email,password_hash,role) VALUES(1,'admin@load.test',$1,'admin'),(2,'teacher@load.test',$1,'teacher')",
                secret,
            )
            await db.executemany(
                "INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)",
                [(1000 + i, f"s{i}@load.test", secret) for i in range(n)],
            )
            class_id = await db.fetchval(
                "INSERT INTO classes(code,name,status,created_by) VALUES('LOAD','Lớp tải','active',2) RETURNING id"
            )
            await db.executemany(
                "INSERT INTO class_memberships(class_id,user_id,role,added_by) VALUES($1,$2,$3,2)",
                [(class_id, 2, "teacher")] + [(class_id, 1000 + i, "student") for i in range(n)],
            )
        finally:
            await db.close()
        server = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--port",
                str(args.port),
                "--workers",
                "1",
                "--no-access-log",
            ],
            env=env,
            cwd=ROOT,
            stdout=log,
            stderr=subprocess.STDOUT,
        )
        base_url = f"http://127.0.0.1:{args.port}"
        # No keep-alive reuse: uvicorn closes idle connections after 5 s, which races with reuse
        # between phases and would be counted as server errors.
        limits = httpx.Limits(max_connections=2 * n + 50, max_keepalive_connections=0)
        async with httpx.AsyncClient(base_url=base_url, timeout=180, limits=limits) as client:
            for _ in range(120):
                try:
                    if (await client.get("/api/health")).status_code < 500:
                        break
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.5)
            tokens = {uid: create_access_token({"sub": str(uid)}) for uid in (1, 2)}
            students = [create_access_token({"sub": str(1000 + i)}) for i in range(n)]
            base = f"/api/classes/{class_id}"
            await setup_course(client, tokens[2], base)
            results = []
            r, _ = await phase(
                client,
                "progress_event_document_read",
                [
                    (
                        t,
                        "POST",
                        base + "/lessons/document/events",
                        {"idempotency_key": str(uuid4()), "kind": "document_read"},
                    )
                    for t in students
                ],
            )
            results.append(r)
            r, _ = await phase(
                client,
                "learning_path_read",
                [(t, "GET", base + "/learning-path", None) for t in students],
            )
            results.append(r)
            # Two keys per student at once: double click / two tabs.
            r, responses = await phase(
                client,
                "attempt_start_x2",
                [
                    (t, "POST", base + "/labs/0/attempts", {"idempotency_key": str(uuid4())})
                    for t in students
                    for _ in range(2)
                ],
            )
            results.append(r)
            attempts = {}
            for index, response in enumerate(responses):
                if response is not None and response.status_code == 200:
                    attempts[index // 2] = response.json()
            r, _ = await phase(
                client,
                "answers_save",
                [
                    (
                        students[i],
                        "PUT",
                        f"/api/attempts/{a['id']}/answers",
                        {
                            "idempotency_key": str(uuid4()),
                            "expected_revision": a["answer_revision"],
                            "answers": {item["id"]: "a" for item in a["items"]},
                        },
                    )
                    for i, a in attempts.items()
                ],
            )
            results.append(r)
            r, _ = await phase(
                client,
                "attempt_submit_x2",
                [
                    (students[i], "POST", f"/api/attempts/{a['id']}/submit", None)
                    for i, a in attempts.items()
                    for _ in range(2)
                ],
            )
            results.append(r)
            r, _ = await phase(
                client,
                "attempt_result_refresh",
                [
                    (students[i], "GET", f"/api/attempts/{a['id']}/result", None)
                    for i, a in attempts.items()
                ],
            )
            results.append(r)
            r, _ = await phase(
                client, "class_report", [(tokens[2], "GET", base + "/reports", None)] * 20
            )
            results.append(r)
            r, _ = await phase(
                client, "admin_dashboard", [(tokens[1], "GET", "/api/admin/dashboard", None)] * 10
            )
            results.append(r)
        db = await asyncpg.connect(url.replace("postgresql+asyncpg", "postgresql"))
        try:
            invariants = {
                "students": n,
                "attempts": await db.fetchval("SELECT count(*) FROM quiz_attempts"),
                "students_with_attempt": await db.fetchval(
                    "SELECT count(DISTINCT membership_id) FROM quiz_attempts"
                ),
                "attempt_items": await db.fetchval("SELECT count(*) FROM quiz_attempt_items"),
                "graded_events": await db.fetchval(
                    "SELECT count(*) FROM progress_events WHERE kind='labtest_graded'"
                ),
                "labtest_completed": await db.fetchval(
                    "SELECT count(*) FROM lesson_progress WHERE lesson_id='labtest-0' AND status='completed'"
                ),
                "scores_5": await db.fetchval("SELECT count(*) FROM quiz_attempts WHERE score=5"),
                "postgres": await db.fetchval("SHOW server_version"),
            }
        finally:
            await db.close()
        invariants["ok"] = (
            all(
                invariants[k] == n
                for k in (
                    "attempts",
                    "students_with_attempt",
                    "graded_events",
                    "labtest_completed",
                    "scores_5",
                )
            )
            and invariants["attempt_items"] == 5 * n
        )
        print(json.dumps(invariants))
        output = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "machine": {
                "platform": platform.platform(),
                "cpu_count": os.cpu_count(),
                "python": platform.python_version(),
                "uvicorn_workers": 1,
            },
            "students": n,
            "phases": results,
            "invariants": invariants,
        }
        if args.out:
            Path(args.out).write_text(
                json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        return (
            0
            if invariants["ok"]
            and not any(key.startswith(("0", "5")) for p in results for key in p["statuses"])
            else 1
        )
    finally:
        if server:
            server.terminate()
            server.wait(timeout=30)
        log.close()
        connection = await admin()
        try:
            await connection.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        finally:
            await connection.close()


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--students", type=int, default=300)
    parser.add_argument("--port", type=int, default=8019)
    parser.add_argument("--out")
    parser.add_argument(
        "--server-log", default=str(ROOT.parent / "scratch" / "load-test-server.log")
    )
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
