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
    sessions/      training sessions
    bookings/      bookings and cancellations
    policies.py    ownership checks
  alembic/         migrations
  scripts/         create_coach.py
  tests/           unit/, api/, integration/ and scripts/ tests
frontend/
  src/
    auth/          login state, route guards
    components/    Layout, form fields
    features/      API hooks and forms for players, programs, sessions and bookings
    pages/         one component per page
    lib/           fetch wrapper (api.ts), TanStack Query setup, dates, Sydney time, error messages
  e2e/             Playwright tests
docker/            Postgres init script
docs/              specification, architecture, ADRs
.github/           CI workflow, Dependabot
```

Each backend feature has its own folder with `router.py`, `schemas.py`, `models.py` and `service.py` (`app/auth/`, `app/users/`, `app/players/`, `app/sports/`, `app/programs/`, `app/sessions/`, `app/bookings/`, `app/attendance/` and `app/notes/`). Ownership checks are in `app/policies.py`. On the frontend, `src/features/` holds the API hooks and forms for each feature, and `src/pages/` holds the pages.

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

**Implemented in Phase 4:**

* `src/lib/sydneyTime.ts` shows times in Sydney time and turns a date and time typed in Sydney time into UTC for the API. It uses the browser's built-in `Intl` time zone data, so it handles daylight saving without a date library. A time that doesn't exist because the clocks went forward is rejected by the form.
* Coaches see a program's upcoming sessions on the program page, can add a session, and have a page for each session with the booked players, an edit form, a button to cancel a booking and a button to cancel the session (which asks first).
* Parents have a "Sessions" page with the upcoming sessions in their children's programs, the places left, and a Book or Cancel button for each child in that program. Each child's page lists their upcoming bookings.

**Implemented in Phase 5:**

* The program page also lists the last 10 past sessions, and each player's name links to a coach page for that player.
* Once a session has started, its page shows the booked players with Present, Absent and Excused buttons and one Save button, instead of the booking list.
* The coach's player page shows the player's attendance in that program, the notes written in it, and a form to add a note. The coach can edit the notes they wrote. A note's date defaults to today in Sydney.
* Each child's page in the parent area shows an attendance summary ("Attended 8 of 10 sessions"), the sessions it's made of, and every development note about the child.

## 5. Database

**Implemented:** PostgreSQL 17 in Docker, with a separate `academy_test` database for tests. The `users` table was added in Phase 2, `refresh_tokens` in Phase 2b, and `players`, `parent_players`, `sports`, `programs` and `program_players` in Phase 3, `training_sessions` and `bookings` in Phase 4, and `attendance` and `development_notes` in Phase 5.

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
| 4 (done) | `training_sessions` | belongs to a program (the coach comes from the program); times stored as `timestamptz`; `capacity` and `booked_count` with CHECK constraints (capacity above 0, booked count between 0 and capacity, end after start); status SCHEDULED / CANCELLED |
| 4 (done) | `bookings` | player, session and the parent who booked; status CONFIRMED / CANCELLED; a partial unique index allows one confirmed booking per player per session; cancelled bookings are kept |
| 5 (done) | `attendance` | one record per player per session (a unique constraint), PRESENT / ABSENT / EXCUSED, and the coach who recorded it; changing it updates the same row |
| 5 (done) | `development_notes` | a player, the program it was written in, the coach who wrote it, a date, and skills, improvements and progress text; a CHECK makes sure at least one of the three isn't empty |
| 6 | invoices / payments | after the MVP; no payment columns in the core tables |

```text
coach (users) ─< programs ─< training_sessions ─< bookings >─ players
                    │                                            │
                    └─────────── program_players ────────────────┘
parent (users) >─< players        (through parent_players)
player login (users) ── players   (optional, players.user_id)
```

* **Enrolment and bookings are separate.** An enrolment (`program_players`) is the lasting link between a player and a program. It decides which players a coach manages. A booking is for one specific session.
* **Times** are stored in UTC and shown in Sydney time on the frontend. The API only accepts times with an offset (for example `+11:00` or `Z`) and always returns UTC, so the backend never guesses a time zone.
* **Nothing is deleted.** Sessions and bookings are cancelled instead, so attendance has something to point at. Development notes are edited, not deleted.
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

## 7. Authorisation (done in Phases 2 to 5)

There are two checks:

1. **Role check:** a FastAPI dependency, for example `require_role(Role.COACH)`. A wrong role returns `403`.
2. **Ownership check:** functions in `app/policies.py`. There's `can_act_for_player` (a parent linked to the player), `can_manage_program` (the coach who owns the program), `can_manage_session` (the coach who owns the session's program), `can_view_session` (that coach, or a parent with a child actively enrolled in the program) and `can_view_player_records` (for attendance and notes: the player's parents, or a coach with the player in one of their programs, active or not).

If a user asks for something they aren't allowed to see, the API returns `404` so it doesn't reveal that the record exists. List endpoints only return the user's own records.

**Children's details:** a player's date of birth is only returned to their parents and to the coach of a program they're actively enrolled in. Coaches find players to enrol with a name search, which returns the name and the parents' first names only. The search is a `POST` so children's names don't end up in URLs or server logs. Session, booking, attendance and note responses only include the player's name, never their date of birth.

**Attendance and notes:** parents see all of their child's attendance and notes. A coach only sees the attendance and notes from their own programs, even when the child is in another coach's program too. A coach keeps seeing their own records after a player's enrolment goes inactive, but can't add new notes.

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
| PATCH | `/api/v1/programs/{id}/players/{player_id}` | The program's coach: set the status to `ACTIVE` or `INACTIVE`, or `404 ENROLMENT_NOT_FOUND`. Going inactive cancels the player's bookings for this program's sessions that haven't started; going active again doesn't bring them back |
| GET | `/api/v1/sessions` | Coaches: their upcoming sessions (`?program_id=` and `?include_past=true` are optional). Parents: upcoming scheduled sessions in programs one of their children is actively enrolled in |
| POST | `/api/v1/sessions` | Coaches: add a session to one of their programs (`201`, `422 INVALID_TIMES` or `422 PROGRAM_NOT_FOUND`) |
| GET | `/api/v1/sessions/{id}` | The session's coach, or a parent with a child in the program. `404 SESSION_NOT_FOUND` for anyone else |
| PATCH | `/api/v1/sessions/{id}` | The session's coach: edit the times, location or capacity. `409 CAPACITY_BELOW_BOOKED`, or `409 SESSION_NOT_EDITABLE` once it's cancelled or has started |
| POST | `/api/v1/sessions/{id}/cancel` | The session's coach: cancel the session and all its bookings |
| GET | `/api/v1/sessions/{id}/bookings` | The session's coach: who's booked (names only) |
| POST | `/api/v1/sessions/{id}/bookings` | Parents: book one of their children, `{"player_id": "..."}`. `201`, `409 SESSION_FULL`, `409 ALREADY_BOOKED`, `409 SESSION_NOT_BOOKABLE`, `422 PLAYER_NOT_ENROLLED` or `422 PLAYER_NOT_FOUND` |
| GET | `/api/v1/bookings` | Parents: their children's bookings for sessions that haven't finished (`?player_id=` is optional), including cancelled ones |
| POST | `/api/v1/bookings/{id}/cancel` | The child's parent or the session's coach, before the session starts. `409 BOOKING_NOT_CANCELLABLE` if it's already cancelled or the session has started |
| GET | `/api/v1/sessions/{id}/attendance` | The session's coach: every player with a confirmed booking and their status, or `null` if not marked yet |
| PUT | `/api/v1/sessions/{id}/attendance` | The session's coach: `{"records": [{"player_id": "...", "status": "PRESENT"}]}`. Players left out keep what they had. `409 ATTENDANCE_NOT_OPEN` before the start, `409 SESSION_CANCELLED`, or `422 PLAYER_NOT_BOOKED` |
| GET | `/api/v1/players/{id}/attendance` | The player's parents, or a coach for their own programs (`?program_id=` is optional). A summary (`present`, `absent`, `excused`, `total`) and the records, newest first |
| GET, POST | `/api/v1/players/{id}/development-notes` | GET: the player's parents, or a coach for their own programs (`?program_id=` is optional), newest first. POST: a coach adds a note in one of their programs (`201`, `422 PROGRAM_NOT_FOUND` or `422 PLAYER_NOT_ENROLLED`) |
| PATCH | `/api/v1/development-notes/{id}` | The coach who wrote the note. `404 NOTE_NOT_FOUND` for anyone else, `422 NOTE_EMPTY` if every text field would be empty |

FastAPI also generates API docs at `/docs`.

Session responses include `capacity`, `booked` and `available`, so the frontend doesn't need to calculate them.

## 9. Bookings and session capacity (done in Phase 4)

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

Cancelling a booking uses the same lock and frees the place again. Editing a session's capacity, cancelling a session and making a player's enrolment inactive (which cancels their upcoming bookings in that program) lock the row too, so they can't race with a booking.

`tests/integration/test_booking_concurrency.py` starts eight threads, each with its own database connection, that all try to book a session with one (or three) places at the same moment. Exactly that many succeed and the rest get `SESSION_FULL`. Without the row lock, this test fails.

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
  * Sessions and bookings: validation, every booking rule, who can see and change what, and the database constraints. A concurrency test (above) checks that capacity is never exceeded.
  * Attendance and development notes: when attendance opens, only booked players, changing a record, the note rules, which coach sees what, and the database constraints.
  * The script that moves a session into the past for the end-to-end test.
* **Frontend (Vitest + React Testing Library):** the API client, the home page, the login and register forms, the route guards, restoring the login on load, refresh-and-retry, the parent player pages and coach program pages, the Sydney time conversion (including both daylight saving changes), the coach session pages, the parent booking pages, the attendance form, the note form and the progress sections.
* **End-to-end (Playwright):** the home page health checks, the not-found page, parent registration, login and logout, coach login, a parent being kept out of the coach area, staying logged in after a reload, staying logged out after logging out, a coach enrolling a parent's child in a program, which the parent then sees, two parents trying to book the last place in a session, and a coach marking a child present and writing a note, which the parent then sees (and a parent being kept out of the coach's session page).

The attendance test needs a session that has already happened, but the API only creates future sessions. The test books a session first and then runs `scripts/move_session_to_past.py` through `docker compose exec`, which refuses to run in production.

Each backend test runs inside a transaction that's rolled back afterwards, so tests don't share data. The concurrency test is the exception: it needs several connections, so it commits its data and deletes it afterwards.

Tests use real PostgreSQL instead of SQLite, because later features depend on row locks and constraints that SQLite handles differently. As a safety measure, the test suite won't run against a database whose name doesn't end in `_test`.

## 11. Security

**Implemented:**

* Secrets are kept in `.env`, which is git-ignored. `.env.example` has placeholder values.
* CORS is off by default, because Vite forwards API requests in development. When it's enabled, only the listed origins are allowed.
* Dependabot opens pull requests for dependency updates.
* Passwords are hashed with Argon2, and a wrong password and an unknown email get the same "invalid email or password" message.
* Failed logins are limited per email (5 a minute) and per IP address (20 a minute, higher because a family or school can share one address). Behind a reverse proxy, uvicorn will need `--forwarded-allow-ips` for the IP limit to see real addresses. That gets set up with hosting.
* `APP_ENV` must be set, so a missing setting can't quietly run production in development mode. In production the app refuses to start with one of the example JWT secrets from this repo.
* Docker Compose only exposes the database, backend and frontend ports on `127.0.0.1`, so other computers on the same network can't connect.

**Planned:**

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
| **4. Sessions and bookings** (done) | Sessions, session capacity, bookings, cancellation | The concurrent booking test passes |
| **5. Attendance and development** (done) | Attendance, development notes | All MVP Playwright flows pass |
| **6. Payments** | Invoices, payment status | Parents can see invoices |
| **7. Deployment** | Choose a provider, Terraform, deployment pipeline, monitoring | The app deploys from `main` |
