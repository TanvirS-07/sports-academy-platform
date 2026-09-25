# ADR 0001: Technology stack and repository structure

* **Status:** Accepted
* **Date:** 2026-09-25

## Context

I'm building this project on my own. It needs a web frontend, an API with some tricky rules (permissions and session capacity when two people book at once) and a database with several related tables. It should run the same way on my machine, in Docker and in CI.

## Decision

* **One repository** with `backend/`, `frontend/` and `docs/`, so a single pull request can change the API, the UI and the tests together.
* **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic and PostgreSQL 17, with dependencies managed by uv. Code is grouped by feature.
* **Frontend:** React, TypeScript, Vite, Tailwind CSS and React Router.
* **Testing:** pytest against a real PostgreSQL database, Vitest with React Testing Library, and Playwright against the Docker Compose stack.
* **Local environment:** Docker Compose only. No cloud services are needed for development.
* **Pinned versions:** Python 3.12.14, Node 24.21.0, PostgreSQL 17.11 and uv 0.12.19. Dependencies are locked in `uv.lock` and `package-lock.json`, and Docker images use exact tags instead of `latest`.

## Consequences

* These tools are widely used and well documented, which matters when there's no team to ask.
* Upgrades happen on purpose, through Dependabot pull requests, instead of changing without warning.
* Things like a repository layer, a global state library, caching or message queues are left out until a feature needs them.
