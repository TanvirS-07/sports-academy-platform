# ADR 0002: Synchronous SQLAlchemy

* **Status:** Accepted
* **Date:** 2026-09-25

## Context

FastAPI supports both `async def` and plain `def` endpoints. SQLAlchemy 2.0 offers a synchronous API and an asyncio extension. The academy's expected traffic is small: a few coaches and parents at a time.

## Decision

Use **synchronous** SQLAlchemy sessions with the psycopg 3 driver and plain `def` endpoints. FastAPI runs these in its thread pool.

## Consequences

* Simpler code, tests and debugging. There are no `await` chains, no async session lifecycle issues and no async-specific lazy-loading pitfalls.
* Row locking (`SELECT … FOR UPDATE`) for booking capacity works the same way in both models, so correctness is not affected.
* Throughput is limited by the thread pool size, which is far above what an academy needs. If that ever changes, endpoints can be migrated to async one at a time.
