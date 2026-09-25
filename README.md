# Sports Academy Management Platform

A full-stack management platform designed for sports academies to manage players, coaches, training programs, sessions, attendance, and academy operations.
The initial implementation will be designed around a cricket academy, but the platform will be structured so that it can be adapted to other sports academies with similar requirements.

## Project Status

**Currently in development: Phase 1 (Foundation).**

Phase 1 provides the local development environment, project structure, health checks and CI pipeline. Application features are added from Phase 2 onwards. See [docs/project_specs.md](docs/project_specs.md) for the full development phases.

## Technology

* **Frontend:** React + TypeScript
* **Backend:** Python + FastAPI
* **Database:** PostgreSQL
* **Authentication:** JWT
* **Styling:** Tailwind CSS
* **Testing:** pytest, Vitest, Playwright
* **Containerisation:** Docker
* **CI/CD:** GitHub Actions
* **Infrastructure (Phase 7):** AWS + Terraform

### Pinned versions

| Component | Version | Where it is pinned |
|---|---|---|
| Python | 3.12.14 | `backend/.python-version`, `backend/Dockerfile` |
| uv | 0.12.19 | `backend/Dockerfile`, `.github/workflows/ci.yml` |
| Node.js | 24.21.0 (LTS) | `frontend/.nvmrc`, `frontend/Dockerfile`, `frontend/package.json` engines |
| PostgreSQL | 17.11 | `docker-compose.yml`, `.github/workflows/ci.yml` |
| Python packages | exact versions | `backend/pyproject.toml` + `backend/uv.lock` |
| npm packages | exact versions | `frontend/package.json` + `frontend/package-lock.json` |

When upgrading a runtime, update every file listed in its row in the same pull request.

## Project Goals

The platform aims to provide a centralised system for:

* Managing coaches, parents and players
* Creating and managing training programs
* Enrolling players into programs
* Scheduling training sessions
* Recording attendance
* Tracking player development and progress
* Managing payments and invoices (after the MVP)
* Reducing manual administrative processes

The application is being developed as a production-style project, with an emphasis on clean architecture, testing, security, maintainability, and real-world software engineering practices.

## User Roles

The platform is coach-led. There are three roles: **Coach**, **Parent** and **Player**.

### Coach
Coaches will be able to:

* Create and manage their training sessions
* Set session capacity (the number of available places)
* Enrol players into their programs
* Manage and view players enrolled in their programs
* Manage training programs
* Record player development notes
* Track player progress
* Mark session attendance
* View payments related to their sessions (after the MVP)

Coach accounts are created with a development CLI/seed script for the MVP.

### Parent
Parents will be able to:

* Register an account
* Manage and view their children
* View available training sessions
* Book available sessions for children enrolled in the session's program
* View upcoming sessions
* View player development
* View attendance
* View invoices and payment status (after the MVP)

### Player
A Player starts as a profile created and managed by a Parent. A login is optional and can be enabled later.

Players will be able to:

* View their training schedule
* View attendance
* View development information

## Session Booking

A core feature of the platform will be session capacity management. For now, a session's availability means its number of available places.

For example:

```text
Saturday Training
10:00 AM – 11:30 AM

Capacity: 5
Booked: 4
Available: 1
```

Parents can book available places for their children in sessions belonging to a program their child is enrolled in. Once the session reaches capacity, additional bookings will not be permitted.

The backend will be responsible for validating bookings and preventing issues such as duplicate bookings or multiple users successfully booking the final available place at the same time.

## Getting Started

### Prerequisites

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
* Git
* Optional, for running tools outside Docker: Node.js 24.21.0 and [uv](https://docs.astral.sh/uv/)

On Windows, cloning the repository inside WSL 2 gives the fastest file access and reliable hot reload. If the repository is on the Windows filesystem and changes are not picked up, set `WATCH_POLLING=true` in `.env`.

### Run the stack

```bash
cp .env.example .env
docker compose up --build
```

In a second terminal, apply database migrations:

```bash
docker compose exec backend alembic upgrade head
```

Then open:

| URL | What it is |
|---|---|
| http://localhost:5173 | Frontend (shows API and database status) |
| http://localhost:8000/api/v1/health | Backend health check |
| http://localhost:8000/docs | Interactive API documentation |

### Common commands

```bash
# Stop the stack (database data is kept)
docker compose down

# Stop and delete the database volume
docker compose down -v

# Backend: lint, format check, tests (runs against the academy_test database)
docker compose exec backend ruff check .
docker compose exec backend ruff format --check .
docker compose exec backend pytest

# Create a new migration after changing models (from Phase 2 onwards)
docker compose exec backend alembic revision --autogenerate -m "describe the change"

# Frontend: lint, typecheck, unit tests, production build
docker compose exec frontend npm run lint
docker compose exec frontend npm run typecheck
docker compose exec frontend npm test
docker compose exec frontend npm run build

```

### End-to-end tests

Playwright runs on your machine against the running stack. Install the frontend dependencies on your machine **before** the first `docker compose up`. If you don't, the container's `node_modules` volume can create an empty, root-owned `frontend/node_modules` folder that blocks `npm ci`.

```bash
cd frontend
npm ci
npx playwright install chromium
cd ..
docker compose up --build -d
cd frontend
npm run test:e2e
```

## Repository Structure

```text
.
├── backend/                 FastAPI application
│   ├── app/                 Application code, grouped by feature
│   ├── alembic/             Database migrations
│   └── tests/               pytest tests (api/, integration/)
├── frontend/                React + TypeScript + Vite application
│   ├── src/                 Pages, components and the API client
│   └── e2e/                 Playwright tests
├── docker/postgres/init/    Database initialisation (creates academy_test)
├── docs/                    Specification, architecture and decision records
├── .github/                 CI workflow and Dependabot configuration
└── docker-compose.yml       Local development stack
```

See [docs/architecture.md](docs/architecture.md) for the full architecture.

## Project Motivation

This project is inspired by real-world processes encountered while helping operate a cricket coaching academy.

The goal is to replace repetitive manual processes with a centralised management platform that makes it easier for coaches, players, and parents to manage training sessions, bookings, attendance, development, and payments.

Although the initial implementation focuses on cricket, the underlying architecture will aim to support the broader requirements of sports academies.

## Licence

This project is being developed as a personal portfolio and learning project.
