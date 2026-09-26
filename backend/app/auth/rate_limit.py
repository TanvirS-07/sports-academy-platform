"""A simple in-memory limit on failed login attempts.

Counts failures per email within a sliding time window. Because it lives in the
server's memory, it resets on restart and isn't shared between processes. That's
fine while the app runs as a single process. It can move to the database later if
the app is ever run as several processes.
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
    ) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
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
            return len(self._recent_failures(key)) >= self.max_failures

    def record_failure(self, key: str) -> None:
        with self._lock:
            self._recent_failures(key).append(self._clock())

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._failures.clear()


login_rate_limiter = FailedLoginLimiter()
