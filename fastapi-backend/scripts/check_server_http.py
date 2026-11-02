"""Verify the public config API through each deployed HTTP layer, without login."""

import argparse
import sys

import httpx

from app.core.config import get_settings


def check_endpoint(label: str, origin: str):
    url = origin.rstrip("/") + "/api/auth/google/config"
    try:
        response = httpx.get(url, timeout=15, follow_redirects=False, trust_env=False)
    except httpx.HTTPError as error:
        raise RuntimeError(f"{label}: HTTP connection failed ({type(error).__name__}).") from None
    if response.status_code != 200:
        raise RuntimeError(
            f"{label}: config API returned HTTP {response.status_code}; expected 200."
        )
    try:
        payload = response.json()
    except ValueError:
        raise RuntimeError(f"{label}: expected JSON from API; got a different response.") from None
    if not isinstance(payload, dict) or not isinstance(payload.get("client_id"), str):
        raise RuntimeError(f"{label}: config API JSON does not match its contract.")
    print(f"PASS {label}: config API HTTP 200; Google enabled={bool(payload['client_id'])}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--public", action="store_true", help="Also check the configured HTTPS origin"
    )
    args = parser.parse_args()
    check_endpoint("BE direct", "http://127.0.0.1:8000")
    check_endpoint("Nginx to BE", "http://frontend")
    if args.public:
        origins = get_settings().allowed_origins_list
        if not origins:
            raise RuntimeError("Missing ALLOWED_ORIGINS for public HTTP check.")
        check_endpoint("Public HTTPS/tunnel", origins[0])


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(
            f"FAIL HTTP check: {error if isinstance(error, RuntimeError) else type(error).__name__}",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
