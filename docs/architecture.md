# Architecture

This document explains how the project is structured and why. Each section says whether it's **implemented** or **planned** for a later phase. Requirements are in [project_specs.md](project_specs.md), and individual decisions are in [adr/](adr/).

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
    core/          settings (config.py), the error format (errors.py), hashing and tokens (security.py)
    db/            SQLAlchemy base class and database session
    api/v1.py      combines all /api/v1 routers
    health/        health check endpoints
    auth/          register, login, refresh, logout, role checks
    users/         User model and /users/me
    players/       players, parent links and the coach search
    sports/        sports list
    programs/      programs and enrolments
    policies.py    ownership checks
  alembic/         migrations
  scripts/         create_coach.py
  tests/           unit/, api/, integration/ and scripts/ tests
frontend/
  src/
    auth/          login state, route guards
    components/    Layout, form fields
    features/      API hooks and forms for players and programs
    pages/         one component per page
    lib/           fetch wrapper (api.ts), TanStack Query setup, dates, error messages
  e2e/             Playwright tests
docker/            Postgres init script
docs/              specification, architecture, ADRs
.github/           CI workflow, Dependabot
```

Each backend feature has its own folder with `router.py`, `schemas.py`, `models.py` and `service.py` (`app/auth/`, `app/users/`, `app/players/`, `app/sports/` and `app/programs/` so far). Ownership checks are in `app/policies.py`. On the frontend, `src/features/` holds the API hooks and forms for each feature, and `src/pages/` holds the pages.

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

Each feature is split into three parts. The router handles HTTP. The service holds the business rules and transactions. The models define the database tables. Services use SQLAlchemy directly, without a separate repository layer, because another layer would add code without solving a problem at this size.

## 4. Frontend

**Implemented:** Vite, React, TypeScript, Tailwind CSS and React Router. `src/lib/api.ts` is the only place that calls the backend, and it turns error responses into an `ApiError`. The home page calls both health endpoints and shows the result.

**Implemented in Phase 2:**

* The logged-in user is kept in React Context (`src/auth/`). The access token is held in memory inside `api.ts` and added to every request.
* `RequireAuth` and `RequireRole` restrict pages by role. This only affects what the user sees, because the backend checks permissions on every request.
* If a request with a token comes back `401`, the user is logged out.

**Implemented in Phase 2b:**

* When the app loads, it calls `POST /auth/refresh` to log back in from the refresh cookie. The route guards show "Loading…" until that finishes, so a reload doesn't bounce you to the login page.
* If a request comes back `401`, `api.ts` refreshes the access token once and retries the request. If the refresh fails, the user is logged out.
* Only one refresh runs at a time. Inside a tab, callers share the request that's already running. Across tabs, a Web Lock makes the second tab wait for the first, so two tabs never send the same refresh token (which would look like reuse and log both out).
* Logout calls `POST /auth/logout`.

**Implemented in Phase 3:**

* TanStack Query fetches and caches data. Each feature has its hooks in `src/features/<feature>/api.ts`, which call `api.ts`. After a change (for example enrolling a player), the hook invalidates the related queries so the page reloads them.
* 4xx errors aren't retried, because asking again won't change the answer. The cache is cleared on logout, so the next person to log in on the same browser can't see the last person's data.
* Parents have a "My players" list, a form to add a player, and a page for each player with their programs.
* Coaches have a "My programs" list, a form to create or edit a program, and a page for each program with its players, a search to enrol a player, and a button to make an enrolment inactive or active again.

## 5. Database

**Implemented:** PostgreSQL 17 in Docker, with a separate `academy_test` database for tests. The `users` table was added in Phase 2, `refresh_tokens` in Phase 2b, and `players`, `parent_players`, `sports`, `programs` and `program_players` in Phase 3.

**Planned:** tables are added in the phase that needs them.

| Phase | Table | Notes |
|---|---|---|
| 2 (done) | `users` | email (stored lowercase, unique), Argon2 password hash, role (COACH / PARENT / PLAYER), `is_active` |
| 2b (done) | `refresh_tokens` | SHA-256 hash of the token (unique), `family_id`, `expires_at`, `revoked_at`; deleted along with the user |
| 3 (done) | `players` | first name, last name, date of birth; optional unique `user_id` for a player login later |
| 3 (done) | `parent_players` | primary key `(parent_id, player_id)`; the parent who adds a player is linked automatically; a player can have more than one parent |
| 3 (done) | `sports` | unique name; the migration adds Cricket; new sports are added by migration |
| 3 (done) | `programs` | owned by a coach; name, sport, age group, description, training objectives |
| 3 (done) | `program_players` | enrolment; primary key `(program_id, player_id)`, status ACTIVE / INACTIVE; enrolments are made inactive, not deleted |
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

## 6. Authentication (Phase 2 and 2b done)

* Passwords are hashed with Argon2 (`pwdlib`), and JWTs are created with `PyJWT` (HS256, signed with `JWT_SECRET`).
* **Access tokens** last 15 minutes. The frontend keeps them in memory, not in localStorage.
* The backend loads the user from the database on every request, so a deactivated account stops working straight away and the role always comes from the database.
* A wrong password and an unknown email get the same `401` response. After 5 failed attempts for an email within a minute, login returns `429`. This limit is kept in memory, which is fine while the backend runs as one process.
* **Refresh tokens** (Phase 2b) keep you logged in for 7 days (`REFRESH_TOKEN_EXPIRE_DAYS`). Each refresh starts a new 7 days, so you're only logged out after a week of not using the site.
  * The token is a random string, not a JWT. Only its SHA-256 hash is stored, so a copy of the database can't be used to log in.
  * It's sent in an `httpOnly`, `SameSite=Strict` cookie with `Path=/api/v1/auth`, so JavaScript can't read it and the browser only sends it to the auth endpoints. `Secure` is on everywhere except local development, which runs over plain http.
  * Login sets the cookie. Every refresh revokes the old token and sets a new one (rotation). A failed refresh clears the cookie.
  * Every token from one login shares a `family_id`. If a revoked token is used again, it was probably stolen, so every token in that family is revoked and that login ends everywhere. Other logins (another device) aren't affected.
  * The token row is locked while it's being rotated, so two requests with the same token can't both succeed.
  * Refresh fails for expired, revoked or unknown tokens, and for deactivated users.
  * Logout revokes the token and clears the cookie. It doesn't need an access token, so it still works after the access token has expired.
* **CSRF:** the frontend and API are served from one origin, and `SameSite=Strict` stops other sites sending the cookie, so CSRF tokens aren't needed.
* **Known limitations:**
  * If a refresh response never reaches the browser (for example, the connection drops), the browser keeps the old cookie. The next refresh then looks like reuse and the user has to log in again.
  * Old token rows aren't cleaned up yet. That's fine at this size, and a cleanup job can be added later.
* **Accounts:** only parents can sign up publicly. Coaches are created with `scripts/create_coach.py`, and player logins are added later by a parent.

## 7. Authorisation (done in Phases 2 and 3)

There are two checks:

1. **Role check:** a FastAPI dependency, for example `require_role(Role.COACH)`. A wrong role returns `403`.
2. **Ownership check:** functions in `app/policies.py`. So far there's `can_act_for_player` (a parent linked to the player) and `can_manage_program` (the coach who owns the program). Phase 4 adds checks for sessions and bookings.

If a user asks for something they aren't allowed to see, the API returns `404` so it doesn't reveal that the record exists. List endpoints only return the user's own records.

**Children's details:** a player's date of birth is only returned to their parents and to the coach of a program they're actively enrolled in. Coaches find players to enrol with a name search, which returns the name and the parents' first names only. The search is a `POST` so children's names don't end up in URLs or server logs.

## 8. REST API

**Implemented:**

| Method | Path | Response |
|---|---|---|
| GET | `/api/v1/health` | `{"status": "ok"}` |
| GET | `/api/v1/health/db` | `{"status": "ok", "database": "ok"}`, or `503` if the database can't be reached |
| POST | `/api/v1/auth/register` | Creates a parent. `201`, or `409 EMAIL_ALREADY_REGISTERED` |
| POST | `/api/v1/auth/login` | `{"access_token", "token_type", "expires_in"}` and the refresh cookie, or `401` / `429` |
| POST | `/api/v1/auth/refresh` | A new access token and refresh cookie, or `401 INVALID_REFRESH_TOKEN` (and the cookie is cleared) |
| POST | `/api/v1/auth/logout` | Revokes the refresh token and clears the cookie. Always `204` |
| GET | `/api/v1/users/me` | The logged-in user, or `401` |
| GET | `/api/v1/sports` | All sports. Any logged-in user |
| GET, POST | `/api/v1/players` | Parents: list their players, or add one (`201`) |
| GET, PATCH | `/api/v1/players/{id}` | Parents: one of their players (with their active programs), or edit it. `404 PLAYER_NOT_FOUND` for anyone else's |
| POST | `/api/v1/players/search` | Coaches: `{"query": "sam"}` (at least 2 characters). Up to 20 players with their parents' first names |
| GET, POST | `/api/v1/programs` | Coaches: list their programs, or create one (`201`, or `422 SPORT_NOT_FOUND`) |
| GET, PATCH | `/api/v1/programs/{id}` | Coaches: one of their programs, or edit it. `404 PROGRAM_NOT_FOUND` for anyone else's |
| GET, POST | `/api/v1/programs/{id}/players` | The program's coach: list enrolments, or enrol a player (`201`, `409 ALREADY_ENROLLED`, or `422 PLAYER_NOT_FOUND`). Enrolling an inactive player makes them active again |
| PATCH | `/api/v1/programs/{id}/players/{player_id}` | The program's coach: set the status to `ACTIVE` or `INACTIVE`, or `404 ENROLMENT_NOT_FOUND` |

FastAPI also generates API docs at `/docs`.

**Planned:**

| Phase | Endpoints |
|---|---|
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
  * A check that migrations have a single head, can upgrade and downgrade, and match the models.
  * Password hashing and access tokens (expired, tampered with, wrong secret, wrong type).
  * Registration, login, `/users/me`, the login rate limit, role checks and the coach script.
  * Refresh tokens: the cookie flags, rotation, expiry, reuse detection, inactive users and logout.
  * Players, programs and enrolment, including checks that parents and coaches can't see or change each other's records, that the wrong role gets `403`, and that date of birth isn't shown in search results or for inactive enrolments.
* **Frontend (Vitest + React Testing Library):** the API client, the home page, the login and register forms, the route guards, restoring the login on load, refresh-and-retry, and the parent player pages and coach program pages.
* **End-to-end (Playwright):** the home page health checks, the not-found page, parent registration, login and logout, coach login, a parent being kept out of the coach area, staying logged in after a reload, staying logged out after logging out, and a coach enrolling a parent's child in a program, which the parent then sees.

Each backend test runs inside a transaction that's rolled back afterwards, so tests don't share data.

Tests use real PostgreSQL instead of SQLite, because later features depend on row locks and constraints that SQLite handles differently. As a safety measure, the test suite won't run against a database whose name doesn't end in `_test`.

**Planned:** authorisation and business rule tests for sessions and bookings, a concurrent booking test, and Playwright tests for the booking and attendance flows.

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
| **1. Foundation** (done) | Project structure, Docker Compose, Alembic setup, health endpoints, home page, CI | The stack starts with one command and CI passes |
| **2. Authentication** (done) | `users`, parent registration, login, access tokens, role checks, coach script | Auth tests pass and login works |
| **2b. Refresh tokens** (done) | `refresh_tokens`, rotation, logout | Refresh and revocation tests pass |
| **3. Core management** (done) | Players, parents, programs, `program_players`, `policies.py` | Coaches can enrol players; authorisation tests pass |
| **4. Sessions and bookings** | Sessions, session capacity, bookings, cancellation | The concurrent booking test passes |
| **5. Attendance and development** | Attendance, development notes | All MVP Playwright flows pass |
| **6. Payments** | Invoices, payment status | Parents can see invoices |
| **7. Deployment** | Choose a provider, Terraform, deployment pipeline, monitoring | The app deploys from `main` |
