"""Fetch pinned upstream curriculum sources and compile local revisions without flashing.

Run with the backend Python environment. Downloads/build evidence stays in build_cache.
"""
import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "build_cache/ptitcube-audit-2026-10-21"


def get(url):
    request = Request(url, headers={"User-Agent": "PSCubeSAT-curriculum-audit", "Accept": "application/vnd.github+json"})
    with urlopen(request, timeout=40) as response:
        return response.read()


def fetch_repository(repository):
    name = repository["name"]
    branch = repository["default_branch"]
    commit = json.loads(get(f"https://api.github.com/repos/PTITCube/{name}/commits/{branch}"))["sha"]
    folder = CACHE / "upstream" / name
    folder.mkdir(parents=True, exist_ok=True)
    paths = ["src/main.cpp", "README.md", "platformio.ini"] if name.startswith("Lab") else ["library.json", "src/Sensor/Sensor.cpp", "src/EPS/EPS.h", "src/Storage/Storage.h", "src/Scheduler/Scheduler.cpp", "src/Camera/Camera.cpp"]
    files = {}
    for relative in paths:
        url = f"https://raw.githubusercontent.com/PTITCube/{name}/{commit}/{relative}"
        try:
            contents = get(url)
        except HTTPError as error:
            if error.code != 404:
                raise
            files[relative] = {"missing": True}
            continue
        target = folder / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(contents)
        files[relative] = {"sha256": sha256(contents).hexdigest(), "url": url}
    return {"repository": name, "commit": commit, "branch": branch, "files": files}


def fetch():
    CACHE.mkdir(parents=True, exist_ok=True)
    repositories = json.loads(get("https://api.github.com/orgs/PTITCube/repos?per_page=100"))
    selected = sorted((repo for repo in repositories if re.match(r"Lab[1-8]-", repo["name"]) or repo["name"] == "PTITCube-Library"), key=lambda repo: repo["name"])
    results = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        for result in executor.map(fetch_repository, selected):
            results.append(result)
            print(f"FETCH {result['repository']} {result['commit'][:12]}", flush=True)
    manifest = {"checked_at": datetime.now(timezone.utc).isoformat(), "repositories": results}
    (CACHE / "upstream-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


async def compile_sources(args):
    sys.path.insert(0, str(ROOT / "fastapi-backend"))
    from app.services.compiler_sandbox import image_id, run

    manifest = json.loads((CACHE / "upstream-manifest.json").read_text(encoding="utf-8"))
    compiler_image = await image_id()
    if not compiler_image:
        raise RuntimeError("Compiler sandbox image is unavailable")
    jobs = [repo for repo in manifest["repositories"] if repo["repository"].startswith("Lab") and (not args.only or repo["repository"] in args.only)]
    result_file = CACHE / f"build-results-{'upstream' if args.upstream else 'reviewed'}.json"
    results = json.loads(result_file.read_text(encoding="utf-8")) if result_file.exists() else []
    selected_names = {repo["repository"] for repo in jobs}
    results = [row for row in results if row["repository"] not in selected_names or row["board"] not in args.boards]
    for repo in jobs:
        name = repo["repository"]
        override = ROOT / f"fastapi-backend/app/firmware/curriculum/{name}.cpp"
        if not override.exists() and name == "Lab4-04b_Camera_Library":
            override = ROOT / "fastapi-backend/app/firmware/curriculum/Lab4-04_Camera_Snapshot.cpp"
        source = override if override.exists() and not args.upstream else CACHE / f"upstream/{name}/src/main.cpp"
        code = source.read_text(encoding="utf-8-sig")
        for board in args.boards:
            target = CACHE / "builds" / f"{name}-{board}-{'upstream' if args.upstream else 'reviewed'}"
            target.mkdir(parents=True, exist_ok=True)
            print(f"BUILD {name} {board} source={source.relative_to(ROOT)}", flush=True)
            status, log = await run(code, board, target, 600)
            (target / "compile.log").write_text(log, encoding="utf-8")
            row = {"repository": name, "commit": repo["commit"], "board": board, "status": status, "source": str(source.relative_to(ROOT)), "source_sha256": sha256(code.encode()).hexdigest(), "compiler_image": compiler_image}
            results.append(row)
            result_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
            print(f"{'PASS' if status == 0 else 'FAIL'} {name} {board}", flush=True)
    return int(any(row["status"] != 0 for row in results))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--compile", action="store_true")
    parser.add_argument("--upstream", action="store_true")
    parser.add_argument("--only", nargs="*")
    parser.add_argument("--boards", nargs="+", default=["esp32"], choices=["esp32", "esp32s3"])
    args = parser.parse_args()
    if args.fetch:
        fetch()
    if args.compile:
        sys.exit(asyncio.run(compile_sources(args)))
