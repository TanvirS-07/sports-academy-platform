from app.auth.rate_limit import FailedLoginLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_blocks_after_the_maximum_number_of_failures() -> None:
    limiter = FailedLoginLimiter(max_failures=3, window_seconds=60, clock=FakeClock())

    for _ in range(2):
        limiter.record_failure("a@example.com")
    assert not limiter.is_blocked("a@example.com")

    limiter.record_failure("a@example.com")
    assert limiter.is_blocked("a@example.com")


def test_failures_expire_after_the_window() -> None:
    clock = FakeClock()
    limiter = FailedLoginLimiter(max_failures=2, window_seconds=60, clock=clock)
    limiter.record_failure("a@example.com")
    limiter.record_failure("a@example.com")
    assert limiter.is_blocked("a@example.com")

    clock.now += 61

    assert not limiter.is_blocked("a@example.com")


def test_each_email_is_counted_separately() -> None:
    limiter = FailedLoginLimiter(max_failures=1, window_seconds=60, clock=FakeClock())

    limiter.record_failure("a@example.com")

    assert limiter.is_blocked("a@example.com")
    assert not limiter.is_blocked("b@example.com")


def test_reset_clears_failures() -> None:
    limiter = FailedLoginLimiter(max_failures=1, window_seconds=60, clock=FakeClock())
    limiter.record_failure("a@example.com")

    limiter.reset("a@example.com")

    assert not limiter.is_blocked("a@example.com")


def test_checking_an_email_does_not_store_it() -> None:
    limiter = FailedLoginLimiter(max_failures=1, window_seconds=60, clock=FakeClock())

    limiter.is_blocked("a@example.com")

    assert limiter._failures == {}


def test_old_keys_are_forgotten_once_there_are_too_many() -> None:
    clock = FakeClock()
    limiter = FailedLoginLimiter(max_failures=1, window_seconds=60, clock=clock, max_keys=2)
    limiter.record_failure("a@example.com")
    limiter.record_failure("b@example.com")

    clock.now += 61
    limiter.record_failure("c@example.com")

    assert set(limiter._failures) == {"c@example.com"}
