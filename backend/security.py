"""Owner login (JWT) and a tiny in-memory rate limiter."""
import hmac
import os
import secrets
import time
from collections import defaultdict, deque

import jwt
from fastapi import Header, HTTPException, Request

_FALLBACK_SECRET = secrets.token_urlsafe(32)  # used only if JWT_SECRET is unset
TOKEN_HOURS = 8


def _secret() -> str:
    return os.getenv("JWT_SECRET") or _FALLBACK_SECRET


def admin_configured() -> bool:
    return bool(os.getenv("ADMIN_PASSWORD"))


def check_password(password: str) -> bool:
    expected = os.getenv("ADMIN_PASSWORD", "")
    return bool(expected) and hmac.compare_digest(password.encode(), expected.encode())


def make_token() -> str:
    exp = int(time.time()) + TOKEN_HOURS * 3600
    return jwt.encode({"sub": "owner", "exp": exp}, _secret(), algorithm="HS256")


def is_owner(authorization: str | None) -> bool:
    if not authorization or not authorization.startswith("Bearer "):
        return False
    try:
        jwt.decode(authorization[7:], _secret(), algorithms=["HS256"])
        return True
    except jwt.PyJWTError:
        return False


def require_owner(authorization: str | None = Header(default=None)) -> None:
    if not is_owner(authorization):
        raise HTTPException(401, "Owner login required")


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return fwd or (request.client.host if request.client else "unknown")


class Limiter:
    """Allow `limit` calls per `window` seconds for each key (e.g. an IP)."""

    def __init__(self, limit: int, window: int):
        self.limit, self.window = limit, window
        self.hits: dict[str, deque] = defaultdict(deque)

    def check(self, key: str) -> None:
        now, q = time.time(), self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise HTTPException(429, "Bahut zyada requests. Thori der baad try karein.")
        q.append(now)