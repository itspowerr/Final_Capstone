"""
HTTP Cache-Control middleware.

Adds Cache-Control headers to GET responses for read-heavy endpoints:
  - Jobs list, job detail:           30s stale-while-revalidate
  - Freelancer profiles, user list:  30s
  - Contract list, detail:           10s (more dynamic)
  - Messages, notifications:         no-cache (real-time)
  - Auth, writes:                    no-store
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# Path → (max-age, stale-while-revalidate)
CACHE_RULES = {
    "/api/jobs":             (30, 60),
    "/api/contracts":        (10, 30),
    "/api/users":            (30, 60),
    "/api/users/me":         (0, 0),
    "/api/admin/dashboard":  (15, 30),
    "/api/admin/reports":    (30, 60),
}

NO_CACHE_PREFIXES = (
    "/api/auth",
    "/api/messages",
    "/api/notifications",
    "/api/dispute-messages",
    "/api/admin/audit-logs",
    "/api/admin/disputes",
)


class CacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.method != "GET":
            response.headers["Cache-Control"] = "no-store"
            return response

        path = request.url.path

        for prefix in NO_CACHE_PREFIXES:
            if path.startswith(prefix):
                response.headers["Cache-Control"] = "no-store"
                return response

        for rule_path, (max_age, swr) in CACHE_RULES.items():
            if path.startswith(rule_path):
                if max_age == 0:
                    response.headers["Cache-Control"] = "no-cache, must-revalidate"
                else:
                    response.headers["Cache-Control"] = (
                        f"public, max-age={max_age}, stale-while-revalidate={swr}"
                    )
                return response

        response.headers["Cache-Control"] = "no-store"
        return response
