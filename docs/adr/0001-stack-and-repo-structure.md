# ADR 0001: Technology stack and repository structure

* **Status:** Accepted
* **Date:** 2026-09-25

## Context

The platform is built and maintained by a single developer as a production-style portfolio project. It needs a web frontend, an API with non-trivial business rules (authorisation, booking capacity under concurrency) and a relational database. It must be reproducible on any machine and in CI.

## Decision

* **One repository** containing `backend/`, `frontend/`, `docs/` and (from Phase 7) `infra/`. One pull request can change the API, the UI and the tests together.
* **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL 17, managed with uv. Code is grouped by feature (`app/<feature>/router.py, schemas.py, models.py, service.py`).
* **Frontend:** React + TypeScript + Vite + Tailwind CSS + React Router.
* **Testing:** pytest against real PostgreSQL, Vitest + React Testing Library, and Playwright against the Docker Compose stack.
* **Local environment:** Docker Compose only. No cloud services are needed for development.
* **Reproducibility:** runtimes are pinned to exact versions (Python 3.12.14, Node 24.21.0, PostgreSQL 17.11, uv 0.12.19). Dependencies are locked in `uv.lock` and `package-lock.json`, and Docker images use explicit version tags rather than `latest`.

## Consequences

* Every tool is mainstream and well documented, which keeps the learning and maintenance burden reasonable for one developer.
* Pinning means upgrades are deliberate pull requests (proposed by Dependabot) instead of surprises.
* Deliberately not included until a real need appears: a separate repository layer, global state libraries, message queues, caches and microservices.
