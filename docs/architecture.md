# Architecture

This document explains how the project is structured and why. Each section says whether it's **implemented** (Phase 1) or **planned** for a later phase. Requirements are in [project_specs.md](project_specs.md), and individual decisions are in [adr/](adr/).

I'm building this on my own, so the aim is to use a small set of tools I understand well and to add things only when a feature needs them.

## 1. Overview

```text
Browser
  │
  ▼
React + TypeScript (Vite)
  │  /api/v1 requests (Vite forwards these to the backend in development)
  ▼
FastAPI backend
  │  SQLAlchemy
  ▼
PostgreSQL
```

The frontend only talks to the backend API. The backend will enforce all business rules. Frontend checks are only there to give the user quicker feedback.

## 2. Repository structure

**Implemented:**

```text
backend/
  app/
    main.py        creates the FastAPI app, registers error handlers and routers
    core/          settings (config.py) and the error format (errors.py)
    db/            SQLAlchemy base class and database session
    api/v1.py      combines all /api/v1 routers
    health/        health check endpoints
  alembic/         migration setup (no migrations yet)
  tests/           api/ and integration/ tests
frontend/
  src/
    components/    Layout
    pages/         HomePage, NotFoundPage
    lib/api.ts     fetch wrapper for calling the backend
  e2e/             Playwright smoke test
docker/            Postgres init script
docs/              specification, architecture, ADRs
.github/           CI workflow, Dependabot
```

**Planned:** each backend feature gets its own folder, for example `app/bookings/` with `router.py`, `schemas.py`, `models.py` and `service.py`. There will also be `app/policies.py` for authorisation (Phase 3), `backend/scripts/` for the coach creation script (Phase 2), and `frontend/src/features/` for feature-specific UI.

## 3. Backend

**Implemented:**

* FastAPI with all routes under `/api/v1`.
* SQLAlchemy 2.0 in synchronous mode with the psycopg 3 driver. Synchronous code is simpler to write and test, and it's fast enough for one academy ([ADR 0002](adr/0002-sync-sqlalchemy.md)).
* Alembic for migrations. It reads the database URL from the same settings as the app.
* pydantic-settings for configuration from environment variables.
* uv for dependencies and ruff for linting and formatting.
* A standard JSON error format, used for every error response:

```json
{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "Database is unavailable" } }
```

**Planned:** each feature will be split into three parts. The router handles HTTP. The service holds the business rules and transactions. The models define the database tables. Services will use SQLAlchemy directly, without a separate repository layer, because another layer would add code without solving a problem at this size.

## 4. Frontend

**Implemented:** Vite, React, TypeScript, Tailwind CSS and React Router. `src/lib/api.ts` is the only place that calls the backend, and it turns error responses into an `ApiError`. The home page calls both health endpoints and shows the result.

**Planned:**

* The logged-in user will be stored in React Context (Phase 2).
* Pages will be restricted by role (Phase 2). This only affects what the user sees, because the backend checks permissions on every request.
* TanStack Query will be added in Phase 3, when there's real data to fetch and cache. Until then, plain `fetch` is enough.

## 5. Database

**Implemented:** PostgreSQL 17 in Docker, with a separate `academy_test` database for tests. Alembic is set up, but no application tables exist yet.

**Planned:** tables are added in the phase that needs them.

| Phase | Table | Notes |
|---|---|---|
| 2 | `users` | email (unique, case-insensitive), password hash, role (COACH / PARENT / PLAYER) |
| 2b | `refresh_tokens` | stored as hashes, with expiry and revocation time |
| 3 | `players` | profile managed by a parent; optional `user_id` for a player login |
| 3 | `parent_players` | links parents and players; a player can have more than one parent |
| 3 | `sports` | seeded with Cricket |
| 3 | `programs` | owned by a coach |
| 3 | `program_players` | enrolment; primary key `(program_id, player_id)`, status ACTIVE / INACTIVE |
| 4 | `training_sessions` | times stored as `timestamptz`; `capacity` and `booked_count` with CHECK constraints |
| 4 | `bookings` | status CONFIRMED / CANCELLED; one confirmed booking per player per session |
| 5 | `attendance` | one record per player per session: PRESENT / ABSENT / EXCUSED |
| 5 | `development_notes` | written by a coach about a player |
| 6 | invoices / payments | after the MVP; no payment columns in the core tables |

```text
coach (users) ─< programs ─< training_sessions ─< bookings >─ players
                    │                                            │
                    └─────────── program_players ────────────────┘
parent (users) >─< players        (through parent_players)
player login (users) ── players   (optional, players.user_id)
```

* **Enrolment and bookings are separate.** An enrolment (`program_players`) is the lasting link between a player and a program. It decides which players a coach manages. A booking is for one specific session.
* **Times** are stored in UTC and shown in Sydney time on the frontend.
* **The table is called `training_sessions`** so it isn't confused with a database session.

## 6. Authentication (planned, Phase 2 and 2b)

* Passwords are hashed with Argon2 (`pwdlib`), and JWTs are created with `PyJWT`.
* **Phase 2:** access tokens last 15 minutes. The frontend keeps them in memory, not in localStorage.
* **Phase 2b:** refresh tokens last about 7 days. They're sent in an `httpOnly` cookie and stored as hashes in the database. They're rotated each time they're used and revoked on logout.
* **Accounts:** only parents can sign up publicly. Coaches are created with a script, and player logins are added later by a parent.

## 7. Authorisation (planned, Phase 2 and 3)

There are two checks:

1. **Role check:** a FastAPI dependency, for example `require_role(Role.COACH)`. A wrong role returns `403`.
2. **Ownership check:** functions in `app/policies.py`, for example `can_manage_session(user, session)` or `can_act_for_player(user, player)`.

If a user asks for something they aren't allowed to see, the API returns `404` so it doesn't reveal that the record exists. List endpoints only return the user's own records.

## 8. REST API

**Implemented:**

| Method | Path | Response |
|---|---|---|
| GET | `/api/v1/health` | `{"status": "ok"}` |
| GET | `/api/v1/health/db` | `{"status": "ok", "database": "ok"}`, or `503` if the database can't be reached |

FastAPI also generates API docs at `/docs`.

**Planned:**

| Phase | Endpoints |
|---|---|
| 2 | `POST /auth/register`, `POST /auth/login`, `GET /users/me` |
| 2b | `POST /auth/refresh`, `POST /auth/logout` |
| 3 | `/players`, `/programs`, `/programs/{id}/players` (enrolment) |
| 4 | `/sessions`, `/sessions/{id}/cancel`, `/sessions/{id}/bookings`, `/bookings`, `/bookings/{id}/cancel` |
| 5 | `/sessions/{id}/attendance`, `/players/{id}/attendance`, `/players/{id}/development-notes` |

Session responses will include `capacity`, `booked` and `available`, so the frontend doesn't need to calculate them.

## 9. Bookings and session capacity (planned, Phase 4)

Session capacity is the number of players a session can accept (`capacity = 10`, `booked = 7`, `available = 3`). To stop two parents booking the last place at the same time, each booking runs in one transaction:

1. Lock the session row with `SELECT … FOR UPDATE`.
2. Check the rules:
   * the parent manages the player;
   * the player is actively enrolled in the session's program;
   * the session is scheduled and in the future;
   * `booked_count < capacity`.
3. Insert the booking, increase `booked_count` and commit.

The database also enforces these:

* A `CHECK (booked_count <= capacity)` constraint, so an overbooking fails even if the code has a bug.
* A partial unique index, so a player can't have two confirmed bookings for the same session.

Cancelling a booking uses the same lock and frees the place again.

## 10. Testing

**Implemented:**

* **Backend (pytest):**
  * Health endpoints, including the `503` case.
  * The error format for unknown routes and wrong methods.
  * A database connection check.
  * A check that migrations have a single head and can upgrade and downgrade.
* **Frontend (Vitest + React Testing Library):** the API client and the home page's loading, success and error states.
* **End-to-end (Playwright):** the home page shows the API and database as OK, and unknown routes show the not-found page.

Tests use real PostgreSQL instead of SQLite, because later features depend on row locks and constraints that SQLite handles differently. As a safety measure, the test suite won't run against a database whose name doesn't end in `_test`.

**Planned:** tests for authorisation (each role against resources they do and don't own), business rules, a concurrent booking test, and Playwright tests for the main user flows.

## 11. Security

**Implemented:**

* Secrets are kept in `.env`, which is git-ignored. `.env.example` has placeholder values.
* CORS is off by default, because Vite forwards API requests in development. When it's enabled, only the listed origins are allowed.
* Dependabot opens pull requests for dependency updates.

**Planned:**

* **Authentication:** Argon2 password hashing, login rate limiting, and a generic "invalid email or password" message.
* **Input validation:** stricter Pydantic validation on input endpoints.
* **Children's data:** collect only what's needed, and don't log it or put it in URLs.
* **Logging:** never log passwords, tokens or full request bodies.

## 12. Development environment

**Implemented:** `docker compose up` starts three services:

* `db`: `postgres:17.11-bookworm`
* `backend`: uvicorn with auto-reload
* `frontend`: the Vite dev server

The source folders are mounted into the containers, so code changes reload automatically. Migrations are run by hand with `docker compose exec backend alembic upgrade head`. No cloud services are used during development.

## 13. CI

**Implemented:** `.github/workflows/ci.yml` runs on every pull request and on pushes to `main`.

1. **backend:** installs from `uv.lock`, then runs ruff, Alembic migrations and pytest with coverage.
2. **frontend:** installs from `package-lock.json`, then runs ESLint, TypeScript, Vitest and a production build.
3. **e2e:** starts the Docker Compose stack and runs the Playwright smoke test.

Work is done on branches and merged into `main` through pull requests. A branch ruleset on `main` requires all three checks to pass.

## 14. Deployment (not decided yet)

Deployment is planned for Phase 7, and the hosting provider hasn't been chosen. What is already known:

* Infrastructure will be defined with Terraform.
* The frontend builds to static files (`npm run build`).
* The backend has a `prod` Docker image that runs as a non-root user.
* Deployment will run from GitHub Actions after CI passes.

The provider, hosting setup, secrets storage and costs will be decided in Phase 7.

## 15. Phases

| Phase | Scope | Done when |
|---|---|---|
| **1. Foundation** (in progress) | Project structure, Docker Compose, Alembic setup, health endpoints, home page, CI | The stack starts with one command and CI passes |
| **2. Authentication** | `users`, parent registration, login, access tokens, role checks, coach script | Auth tests pass and login works |
| **2b. Refresh tokens** | `refresh_tokens`, rotation, logout | Refresh and revocation tests pass |
| **3. Core management** | Players, parents, programs, `program_players`, `policies.py` | Coaches can enrol players; authorisation tests pass |
| **4. Sessions and bookings** | Sessions, session capacity, bookings, cancellation | The concurrent booking test passes |
| **5. Attendance and development** | Attendance, development notes | All MVP Playwright flows pass |
| **6. Payments** | Invoices, payment status | Parents can see invoices |
| **7. Deployment** | Choose a provider, Terraform, deployment pipeline, monitoring | The app deploys from `main` |
