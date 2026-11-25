"""Development server with compiler output excluded from reload watching."""

import os
from pathlib import Path

import uvicorn


def port_in_use(host: str, port: int) -> bool:
    """True when something already accepts connections on host:port."""
    import socket

    probe = "127.0.0.1" if host in ("0.0.0.0", "") else host
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((probe, port)) == 0


if __name__ == "__main__":
    host, port = os.environ.get("BACKEND_HOST", "127.0.0.1"), 8005
    # Windows lets a second server bind the same port; requests then reach either process, so an old
    # backend (old build config, old code) keeps answering. Refuse to start a duplicate.
    if port_in_use(host, port):
        raise SystemExit(
            f"Cổng {port} đã có backend đang chạy. Tắt tiến trình cũ (dev.py) rồi chạy lại; "
            "hai backend song song sẽ trả kết quả lẫn lộn (ví dụ COMPILER_VERSION_MISMATCH)."
        )
    root = Path(__file__).resolve().parent
    # This Uvicorn version compares excluded directories with absolute paths. It globs any
    # exclude that is not an existing directory, and an absolute glob raises on Python 3.12+,
    # so the directory must exist before the first compile creates it.
    build_cache = root / "build_cache"
    build_cache.mkdir(exist_ok=True)
    uvicorn.run(
        "app.main:app",
        # Local only by default; set BACKEND_HOST=0.0.0.0 to expose the dev API on the LAN on purpose.
        host=host,
        port=port,
        reload=True,
        reload_dirs=[str(root / "app")],
        reload_excludes=[str(build_cache)],
    )
