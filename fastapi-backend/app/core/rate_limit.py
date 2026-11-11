"""Request rate limits: brute force, spam, compile abuse and bulk content scraping.

ponytail: counters live in process memory. Correct for the single uvicorn worker the
Dockerfile runs; move the counters to Redis (INCR + EXPIRE) before adding workers.
Volumetric/network DDoS must be stopped at Cloudflare, not here.
"""

import json
import re
import time
from dataclasses import dataclass

from loguru import logger

from app.core.config import get_settings
from app.core.security import decode_access_token

_MAX_KEYS = 50_000


class FixedWindowLimiter:
    """Count hits per key in fixed windows; memory is bounded by pruning expired keys."""

    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._windows: dict[str, tuple[float, int, float]] = {}  # key -> (start, count, window)

    def hit(self, key: str, limit: int, window_s: float) -> float | None:
        """Record one hit. Return seconds to wait when the limit is exceeded, else None."""
        now = self._clock()
        start, count, _ = self._windows.get(key, (now, 0, window_s))
        if now - start >= window_s:
            start, count = now, 0
        count += 1
        if len(self._windows) >= _MAX_KEYS and key not in self._windows:
            self._prune(now)
        self._windows[key] = (start, count, window_s)
        return max(1.0, start + window_s - now) if count > limit else None

    def blocked(self, key: str, limit: int) -> float | None:
        """Without recording a hit: seconds left if the key already reached its limit."""
        start, count, window_s = self._windows.get(key, (0.0, 0, 0.0))
        now = self._clock()
        return (
            max(1.0, start + window_s - now) if count >= limit and now - start < window_s else None
        )

    def reset(self, key: str) -> None:
        self._windows.pop(key, None)

    def clear(self) -> None:
        self._windows.clear()

    def _prune(self, now: float) -> None:
        self._windows = {
            key: value for key, value in self._windows.items() if now - value[0] < value[2]
        }


@dataclass(frozen=True)
class Rule:
    name: str
    methods: frozenset[str]
    path: re.Pattern
    scope: str  # "ip" or "user" (falls back to IP when there is no valid token)
    limit: int
    window_s: int
    scrape: bool = False  # exceeding it suggests bulk copying of protected content


def _rule(name, methods, path, scope, limit, window_s, scrape=False) -> Rule:
    return Rule(name, frozenset(methods.split()), re.compile(path), scope, limit, window_s, scrape)


# Limits allow a whole class behind one school NAT address (≈40 students) to work normally.
RULES = (
    _rule("login", "POST", r"^/api/auth/login$", "ip", 60, 60),
    _rule("google_login", "POST", r"^/api/auth/google$", "ip", 60, 60),
    _rule("register", "POST", r"^/api/auth/register$", "ip", 30, 3600),
    _rule("password_change", "PATCH", r"^/api/auth/password$", "user", 5, 900),
    _rule("compile", "POST", r"^/api/compile$", "user", 10, 600),
    _rule("quiz_generation", "POST", r"/generation-jobs$", "user", 10, 3600),
    _rule(
        "quiz_attempt",
        "POST",
        r"^/api/(classes/[^/]+/labs/[^/]+/attempts|attempts/[^/]+/submit)$",
        "user",
        30,
        60,
    ),
    _rule(
        "content_read",
        "GET",
        r"^/api/(curriculum|attempts|classes/[^/]+/(curriculum|learning-path|lessons))",
        "user",
        120,
        60,
        scrape=True,
    ),
    _rule(
        "source_download",
        "GET",
        r"^/api/curriculum/exercises/[^/]+/source$",
        "user",
        30,
        600,
        scrape=True,
    ),
    _rule("api_user", "GET POST PUT PATCH DELETE", r"^/api/", "user", 600, 60),
    _rule("api_ip", "GET POST PUT PATCH DELETE", r"^/api/", "ip", 3000, 60),
)


def client_ip(scope) -> str:
    """Client address; CLIENT_IP_HEADER is set only where a trusted edge (Cloudflare) writes it."""
    header = get_settings().client_ip_header.lower().encode()
    if header:
        for name, value in scope.get("headers", []):
            if name == header and value:
                return value.decode("latin-1").strip()
    client = scope.get("client")
    return client[0] if client else "unknown"


def _user_id(scope) -> str | None:
    for name, value in scope.get("headers", []):
        if name == b"authorization":
            match = re.match(r"^Bearer\s+(.+)$", value.decode("latin-1"), re.IGNORECASE)
            payload = decode_access_token(match.group(1)) if match else None
            return str(payload["sub"]) if payload and payload.get("sub") else None
    return None


async def _reject(send, rule: Rule, retry_after: float) -> None:
    seconds = int(retry_after + 0.999)
    body = json.dumps(
        {
            "code": "RATE_LIMITED",
            "message": f"Bạn thao tác quá nhanh. Vui lòng thử lại sau {seconds} giây.",
            "details": {"rule": rule.name, "retry_after": seconds},
        },
        ensure_ascii=False,
    ).encode()
    await send(
        {
            "type": "http.response.start",
            "status": 429,
            "headers": [
                (b"content-type", b"application/json; charset=utf-8"),
                (b"retry-after", str(seconds).encode()),
                (b"cache-control", b"no-store"),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


class RateLimitMiddleware:
    """Pure ASGI middleware: every matching rule is counted, the first exceeded one rejects."""

    def __init__(self, app):
        self.app = app
        self.limiter = FixedWindowLimiter()  # per app instance: test apps never share counters

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        method, path = scope["method"], scope["path"]
        matching = [rule for rule in RULES if method in rule.methods and rule.path.search(path)]
        if not matching:
            return await self.app(scope, receive, send)
        ip = client_ip(scope)
        user = _user_id(scope) if any(rule.scope == "user" for rule in matching) else None
        for rule in matching:
            subject = f"user:{user}" if rule.scope == "user" and user else f"ip:{ip}"
            retry_after = self.limiter.hit(f"{rule.name}:{subject}", rule.limit, rule.window_s)
            if retry_after is not None:
                logger.bind(
                    action="content_scrape_suspected" if rule.scrape else "rate_limited",
                    rule=rule.name,
                    subject=subject,
                    path=path,
                ).warning("Request rate limit exceeded")
                return await _reject(send, rule, retry_after)
        return await self.app(scope, receive, send)
