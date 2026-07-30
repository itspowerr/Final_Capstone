"""
Global rate limiting middleware using Redis sliding window.

Rate limits:
  - Auth endpoints (login, register, TOTP, wallet):  10 req/min per IP
  - Write endpoints (POST, PUT, DELETE):              30 req/min per IP
  - Read endpoints (GET):                            100 req/min per IP
  - WebSocket:                                   No limit
"""

import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

try:
    from app.redis_client import get_redis
except ImportError:
    get_redis = None

try:
    from redis.exceptions import RedisError
except ImportError:
    RedisError = Exception

AUTH_PATHS = (
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/totp/verify",
    "/api/auth/totp/validate",
    "/api/auth/totp/reset",
    "/api/auth/wallet/login",
    "/api/auth/wallet/register",
    "/api/auth/admin/login",
)

AUTH_LIMIT = 10
WRITE_LIMIT = 60
READ_LIMIT = 300
WINDOW = 60


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/ws") or request.url.path.endswith("/ws"):
            return await call_next(request)

        if request.url.path == "/health":
            return await call_next(request)

        if "/notifications/" in request.url.path:
            return await call_next(request)

        if get_redis is None:
            return await call_next(request)

        redis = await get_redis()
        if redis is None:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        method = request.method

        if method == "OPTIONS":
            return await call_next(request)

        is_auth = any(path.startswith(p) for p in AUTH_PATHS)
        if is_auth:
            limit = AUTH_LIMIT
            bucket = "rl_auth"
        elif method in ("POST", "PUT", "DELETE", "PATCH"):
            limit = WRITE_LIMIT
            bucket = "rl_write"
        else:
            limit = READ_LIMIT
            bucket = "rl_read"

        key = f"{bucket}:{client_ip}"
        now = time.time()

        try:
            pipe = redis.pipeline()
            pipe.zremrangebyscore(key, 0, now - WINDOW)
            pipe.zadd(key, {str(now): now})
            pipe.zcard(key)
            pipe.expire(key, WINDOW + 1)
            pipe.zrange(key, 0, 0, withscores=True)
            results = await pipe.execute()
        except RedisError:
            # Redis is unreachable/flaky (e.g. tunnel hiccup) — fail open rather
            # than 500ing every request in the app.
            return await call_next(request)

        count = results[2]
        oldest_entries = results[4]
        remaining = max(0, limit - count)

        if count > limit:
            oldest_ts = oldest_entries[0][1] if oldest_entries else now
            retry_after = max(1, int(WINDOW - (now - oldest_ts)) + 1)
            return JSONResponse(
                status_code=429,
                content={
                    "code": "RATE_LIMITED",
                    "message": f"Too many requests. Try again in {retry_after}s.",
                    "retry_after": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
