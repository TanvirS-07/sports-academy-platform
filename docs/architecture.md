# Architecture

This document describes the agreed architecture for the Sports Academy Management Platform. It is written for a single developer. It favours a small number of well-understood tools over extra layers or services.

The product requirements live in [project_specs.md](project_specs.md). Individual decisions are recorded in [adr/](adr/).

## 1. Overview

```text
Browser
  │
  │  HTTPS / JSON (REST, /api/v1)
  ▼
React + TypeScript (Vite)          ── static files
  │
  │  /api/* (Vite proxy in development; same-origin routing in production)
  ▼
FastAPI backend                    ── authentication, authorisation, business rules
  │
  │  SQLAlchemy 2.0 (psycopg 3)
  ▼
PostgreSQL 17                      ── data + constraints that protect critical rules
```

* The frontend never talks to the database directly.
* The backend enforces every business rule. Frontend checks only improve the user experience.
* The system is coach-led. The only roles are **Coach**, **Parent** and **Player**.

## 2. Repository structure

```text
backend/
  app/
    main.py          app factory: middleware, error handlers, routers
    core/            settings, error format, (Phase 2) security helpers
    db/              declarative base, engine, request-scoped session
    api/v1.py        collects every /api/v1 router
    health/          health endpoints
    <feature>/       added per phase: router.py, schemas.py, models.py, service.py
    policies.py      (Phase 3) central authorisation rules
  alembic/           migrations
  scripts/           (Phase 2) create_coach.py, seed.py
  tests/             api/, integration/, (later) unit/
frontend/
  src/
    components/      shared UI
    pages/           route-level pages
    features/        (Phase 2+) feature folders: api.ts, components/, pages/
    lib/             API client and helpers
  e2e/               Playwright tests
docker/              container initialisation files
docs/                specification, architecture, ADRs
.github/             CI and Dependabot
```

Backend code is grouped by feature rather than by technical layer. Everything about bookings lives in `app/bookings/`.

## 3. Backend

| Concern | Choice |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy 2.0, **synchronous** ([ADR 0002](adr/0002-sync-sqlalchemy.md)) |
| Driver | psycopg 3 |
| Migrations | Alembic |
| Validation/settings | Pydantic v2, pydantic-settings |
| Tooling | uv (dependencies), ruff (lint + format), pytest |

Each feature has three layers:

* **Router**: HTTP details, request/response schemas, auth dependencies.
* **Service**: business rules and transactions. The rules in spec section 6 live here.
* **Models**: SQLAlchemy tables.

There is no separate repository layer. Services query through SQLAlchemy directly.

**Errors.** Every error uses one JSON shape:

```json
{ "error": { "code": "SESSION_FULL", "message": "This session is full" } }
```

`AppError` subclasses are added only when a feature needs them (for example `NotFoundError` and `ConflictError` in later phases).

## 4. Frontend

* Vite + React + TypeScript + Tailwind CSS, with React Router for pages.
* `src/lib/api.ts` is the single place that calls the backend. It normalises errors into `ApiError`. In Phase 2 it will attach the access token, and in Phase 2b it will retry once after a token refresh.
* The logged-in user is held in React Context (Phase 2). TanStack Query is introduced in Phase 3, when there is real server data to cache. There is no Redux or other global store.
* Routes are guarded by role, for example `<RequireRole roles={['COACH']}>`, from Phase 2. This only controls what the user sees. The backend enforces access.

## 5. Database design

The schema is built **incrementally**: each table is created by an Alembic migration in the phase that implements the feature. Phase 1 creates no application tables.

| Phase | Table | Purpose / key constraints |
|---|---|---|
| 2 | `users` | `id` (UUID), `email` (unique, case-insensitive), `password_hash`, `role` (COACH/PARENT/PLAYER), names, `is_active`, timestamps |
| 2b | `refresh_tokens` | `user_id`, `token_hash`, `expires_at`, `revoked_at` |
| 3 | `players` | Profile: names, `date_of_birth`, `user_id` (nullable, unique) for an optional login |
| 3 | `parent_players` | `PK(parent_id, player_id)`; supports more than one guardian |
| 3 | `sports` | `name` unique; `Cricket` seeded |
| 3 | `programs` | `coach_id`, `sport_id`, name, age group, description, objectives, `is_active` |
| 3 | `program_players` | **Enrolment.** `PK(program_id, player_id)`, `status` (ACTIVE/INACTIVE), `enrolled_at` |
| 4 | `training_sessions` | `program_id`, `coach_id`, `starts_at`/`ends_at` (timestamptz), location, `capacity`, `booked_count`, `status`; `CHECK (ends_at > starts_at)`, `CHECK (capacity >= 0)`, `CHECK (booked_count BETWEEN 0 AND capacity)` |
| 4 | `bookings` | `session_id`, `player_id`, `booked_by`, `status` (CONFIRMED/CANCELLED); partial unique index on `(session_id, player_id) WHERE status = 'CONFIRMED'` |
| 5 | `attendance` | `UNIQUE(session_id, player_id)`, status PRESENT/ABSENT/EXCUSED, `recorded_by` |
| 5 | `development_notes` | `player_id`, `coach_id`, optional `session_id`, observed date, notes fields |
| 6 | `invoices`, `invoice_items`, `payments` | After the MVP. They reference parents and enrolments. No payment columns are added to core tables. |

**Relationships**

```text
Coach (users) ─1:N─ programs ─1:N─ training_sessions ─1:N─ bookings ─N:1─ players
                        │                                                  │
                        └──────── program_players (enrolment) ─────────────┘
Parent (users) ─N:M─ players          (via parent_players)
Player login (users) ─1:1─ players    (optional, players.user_id)
```

* **Enrolment vs booking.** `program_players` is the lasting coach/program ↔ player relationship. A coach's players are the players actively enrolled in that coach's programs. `bookings` records participation in one specific session.
* **Times** are stored as `timestamptz` in UTC and displayed in Australia/Sydney time by the frontend.
* **Other sports.** The `sports` table allows sports other than cricket. Sport-specific data can later go in a JSONB column instead of new tables.
* **Naming.** The table is called `training_sessions` to avoid confusion with database sessions.

## 6. Authentication

* **Passwords:** Argon2 via `pwdlib`.
* **Tokens:** JWT via `PyJWT` (HS256, secret from `JWT_SECRET`).
* **Phase 2, access tokens:** 15 minutes. Claims are `sub`, `role`, `type=access`, `exp`, `iat` and `jti`. The frontend keeps the token in memory, never in localStorage.
* **Phase 2b, refresh tokens:**
  * About 7 days, sent as an `httpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/api/v1/auth/refresh`.
  * Stored hashed in `refresh_tokens`.
  * Rotated on every use and revoked on logout.
  * A password change revokes all of the user's tokens.
* **Account creation:**
  * Public registration creates Parent accounts only.
  * Coaches are created with `scripts/create_coach.py`.
  * Player logins are enabled later by the Player's Parent.

## 7. Authorisation

There are two levels of checks:

1. **Role:** a FastAPI dependency, `require_role(Role.COACH)`. A wrong role returns `403`.
2. **Ownership/relationship:** functions in `app/policies.py`, called from services:

```text
can_manage_program(user, program)   coach owns the program
can_manage_session(user, session)   coach owns the session
can_act_for_player(user, player)    parent linked through parent_players
can_view_player(user, player)       parent of, the player themselves, or coach of an enrolled program
```

* A resource the user may not see returns `404`, so its existence isn't revealed.
* List endpoints are filtered in the query itself.

## 8. REST API

Everything is under `/api/v1`. Lists use `limit`/`offset` pagination. The docs are generated at `/docs`.

| Phase | Endpoints |
|---|---|
| 1 | `GET /health`, `GET /health/db` |
| 2 | `POST /auth/register` (parent), `POST /auth/login`, `GET /users/me` |
| 2b | `POST /auth/refresh`, `POST /auth/logout` |
| 3 | `GET/POST /players`, `GET/PATCH /players/{id}`; `GET/POST /programs`, `GET/PATCH /programs/{id}`; `GET/POST /programs/{id}/players`, `PATCH /programs/{id}/players/{player_id}` (enrolment) |
| 4 | `GET /sessions?from=&to=&program_id=&available=`, `POST /sessions`, `GET/PATCH /sessions/{id}`, `POST /sessions/{id}/cancel`; `POST /sessions/{id}/bookings`, `GET /sessions/{id}/bookings`, `GET /bookings`, `POST /bookings/{id}/cancel` |
| 5 | `PUT/GET /sessions/{id}/attendance`, `GET /players/{id}/attendance`; `GET/POST /players/{id}/development-notes`, `PATCH /development-notes/{id}` |

Session responses include `capacity`, `booked` and `available`. For now, availability means available places only. There is no coach availability calendar.

## 9. Booking and capacity (Phase 4)

A booking is made in a single transaction:

1. `SELECT … FROM training_sessions WHERE id = :id FOR UPDATE` locks the session row, so requests for the last place are handled one at a time.
2. Validate:
   * the parent manages the player;
   * the player is **actively enrolled** in the session's program;
   * the session is `SCHEDULED` and in the future;
   * `booked_count < capacity`.
3. Insert the booking, increment `booked_count`, and commit.

What happens in other cases:

* A duplicate booking hits the partial unique index, which returns `409 ALREADY_BOOKED`.
* A full session returns `409 SESSION_FULL`.
* `CHECK (booked_count <= capacity)` makes the database refuse an overbooking even if the code has a bug.
* Cancelling uses the same lock and decrements `booked_count`. The player can then book again.
* A coach can't reduce capacity below `booked_count`. That returns `409`.

## 10. Testing

| Level | Tooling | Scope |
|---|---|---|
| Backend unit/API/integration | pytest, FastAPI TestClient, real PostgreSQL (`academy_test`) | Endpoints, business rules, authorisation matrix, migrations, concurrent booking test (Phase 4) |
| Frontend | Vitest, React Testing Library, jsdom | API client, pages, role guards |
| End-to-end | Playwright (Chromium) against the Docker Compose stack | Phase 1: smoke test. Later: login, coach creates session, parent books, full-session behaviour, attendance, access control |

* Tests use PostgreSQL rather than SQLite because row locks, partial indexes and CHECK constraints are central to the design.
* The test suite refuses to run against any database whose name doesn't end in `_test`.

## 11. Security

* Argon2 password hashing, a generic login failure message, and login rate limiting (Phase 2).
* Pydantic validation on every input. Stricter schemas (`extra="forbid"`, length limits) come with the first input endpoints.
* CORS disabled by default. When enabled, only an explicit list of origins is allowed, never `*`.
* Secrets only in `.env` (git-ignored) locally and in AWS SSM Parameter Store in production.
* Children's data: collect as little as possible, never log it, and never put it in URLs. The Australian Privacy Principles apply.
* Never log passwords, tokens or full request bodies.
* Dependabot for Actions, uv, npm and Docker images.

## 12. Development environment

Docker Compose runs `db` (postgres:17.11-bookworm), `backend` (uvicorn with reload) and `frontend` (Vite dev server).

* The source code is bind-mounted, so changes reload automatically.
* The Postgres init script creates `academy_test` alongside `academy`.
* Migrations are run explicitly with `docker compose exec backend alembic upgrade head`.
* Everything runs locally. There is no cloud dependency during development.

## 13. CI/CD

**CI** (`.github/workflows/ci.yml`) runs on pull requests and on pushes to `main`:

1. **backend**: `uv sync --frozen` → ruff check → ruff format check → `alembic upgrade head` → pytest with coverage.
2. **frontend**: `npm ci` → eslint → `tsc -b` → vitest → `vite build`.
3. **e2e**: `docker compose up --wait` → migrations → Playwright smoke test. Logs and the report are uploaded if it fails.

Work happens on feature branches (`phase-N/<name>`) and merges into `main` through pull requests. Branch protection on `main` should require all three jobs to pass.

**CD** is added in Phase 7.

## 14. Future AWS deployment (Phase 7)

This is not implemented yet. The planned shape:

* **Frontend:** S3 + CloudFront, using the static build from the frontend `build` stage.
* **Backend:** ECS Fargate (one task) behind an Application Load Balancer, with images in ECR. A single EC2 instance is the cheaper alternative, to be decided in Phase 7.
* **Database:** RDS PostgreSQL 17, smallest instance class, in private subnets with automated backups.
* **Secrets and logs:** SSM Parameter Store and CloudWatch Logs.
* **Costs:** no NAT Gateway, plus an AWS Budget alarm.
* **Terraform:** `infra/terraform/{modules,envs/prod}`, with state in S3 using native lockfiles.
* **Pipeline:** deploys through GitHub Actions using OIDC, so there are no long-lived AWS keys. `terraform plan` runs on pull requests, and `apply` runs on `main` with manual approval.

## 15. Phases

| Phase | Scope | Done when |
|---|---|---|
| 1 Foundation | Structure, Docker Compose, Alembic setup, health endpoints, home page, CI with Playwright smoke test | Stack starts with one command and CI is green |
| 2 Authentication | `users`, parent registration, login, access tokens, `require_role`, create-coach script | Auth tests pass and the login page works |
| 2b Refresh tokens | `refresh_tokens`, rotation, revocation, logout | Refresh/rotation/revocation tests pass |
| 3 Core management | Players, parent links, sports, programs, `program_players` enrolment, `policies.py` | Coaches enrol players, parents manage children, authorisation matrix tests pass |
| 4 Sessions and bookings | Sessions, capacity, enrolment-checked locking booking flow, cancellation | Concurrency test passes; Playwright booking and full-session tests pass |
| 5 Attendance and development | Attendance, development notes, parent/player views | All MVP Playwright journeys pass |
| 6 Payments | Invoices and payment status (after the MVP) | Parents see invoices |
| 7 Production | Terraform, AWS, CD, monitoring | Deployed automatically from `main` |
