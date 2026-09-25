# ADR 0002: Synchronous SQLAlchemy

* **Status:** Accepted
* **Date:** 2026-09-25

## Context

FastAPI supports both `async def` and normal `def` endpoints, and SQLAlchemy supports both synchronous and async sessions. The app will only have a handful of coaches and parents using it at the same time.

## Decision

Use synchronous SQLAlchemy sessions with the psycopg 3 driver and normal `def` endpoints. FastAPI runs these in a thread pool.

## Consequences

* The code and tests are simpler, with no `await` chains or async session problems to debug.
* Row locking with `SELECT … FOR UPDATE`, which the booking feature will use, works the same way in synchronous code.
* The thread pool is more than enough for one academy. If that ever changes, individual endpoints can be moved to async later.
