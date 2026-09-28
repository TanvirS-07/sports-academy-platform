"""A simple in-memory limit on failed login attempts.

Counts failures per key (an email or an IP address) within a sliding time window.
Because it lives in the server's memory, it resets on restart and isn't shared
between processes. That's fine while the app runs as a single process. It can move
to the database later if the app is ever run as several processes.

Behind a reverse proxy every request looks like it comes from the proxy, so uvicorn
needs --forwarded-allow-ips set for the IP limit to see real addresses. That gets
set up with hosting.
"""

import threading
import time
from collections import deque
from collections.abc import Callable


class FailedLoginLimiter:
    def __init__(
        self,
        max_failures: int = 5,
        window_seconds: float = 60,
        clock: Callable[[], float] = time.monotonic,
        max_keys: int = 10_000,
    ) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self._clock = clock
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _recent_failures(self, key: str) -> deque[float]:
        failures = self._failures.setdefault(key, deque())
        cutoff = self._clock() - self.window_seconds
        while failures and failures[0] <= cutoff:
            failures.popleft()
        return failures

    def is_blocked(self, key: str) -> bool:
        with self._lock:
            if key not in self._failures:
                return False
            return len(self._recent_failures(key)) >= self.max_failures

    def _forget_old_keys(self) -> None:
        # Every new key is kept until it's checked again, so without this someone
        # trying lots of different emails would slowly fill up memory.
        cutoff = self._clock() - self.window_seconds
        old = [key for key, times in self._failures.items() if not times or times[-1] <= cutoff]
        for key in old:
            del self._failures[key]

    def record_failure(self, key: str) -> None:
        with self._lock:
            if key not in self._failures and len(self._failures) >= self.max_keys:
                self._forget_old_keys()
            self._recent_failures(key).append(self._clock())

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._failures.clear()


login_rate_limiter = FailedLoginLimiter()
# Stops one address trying lots of different emails. Higher than the email limit
# because a family or a school can share one address.
ip_login_rate_limiter = FailedLoginLimiter(max_failures=20)
