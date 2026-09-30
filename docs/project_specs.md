# Sports Academy Management Platform: Project Specification

This document describes what the platform should do. Phases 1 to 5 are done, which covers the MVP: authentication, players, programs and enrolment, sessions and bookings, and attendance and development notes. Payments and player logins are still to come. The features below are added in later phases (see [section 12](#12-development-phases)).

## 1. Overview

The platform is a web app for managing a sports academy's training programs, sessions, bookings, attendance and player development. The first version is for a cricket academy, but nothing in the design should assume cricket.

The system is coach-led. Coaches manage their own programs, sessions and enrolled players. There are three roles: **Coach**, **Parent** and **Player**.

## 2. Users

### 2.1 Coaches

Coaches will be able to:

* create training programs
* enrol players into their programs
* create and manage their own sessions
* set session capacity and see how many places are booked and available
* see which players are booked into their sessions
* manage bookings for their sessions where needed
* record attendance
* add development notes and track player progress
* see payment information for their sessions (after the MVP)

### 2.2 Parents

Parents will be able to:

* manage their children's profiles
* view sessions and how many places are available
* book their children into sessions
* view upcoming sessions, attendance and development information
* view invoices and payment status (after the MVP)

### 2.3 Players

A player starts as a profile that a parent creates and manages, and doesn't need a login. A player can be given a login later so they can see their own information.

Players will be able to view their training schedule, upcoming sessions, attendance, development information and progress.

## 3. Goals

* Replace manual tracking of sessions, bookings and attendance
* Manage session capacity and prevent overbooking
* Let parents book available places for their children
* Track attendance and player development
* Show each user only the information their role allows
* Add payments and invoices after the MVP

## 4. Features

### 4.1 Authentication

* Registration and login
* Password hashing
* JWT authentication
* Role-based authorisation on protected endpoints

Account rules:

* Public registration only creates **Parent** accounts.
* **Coach** accounts are created with a development CLI/seed script for the MVP.
* **Player** logins are optional and are enabled later by the player's parent.

Tokens are added in two steps:

* **Phase 2:** short-lived JWT access tokens.
* **Phase 2b:** refresh tokens with rotation and revocation.

### 4.2 User management

The system will support coach accounts, parent accounts, player profiles (with optional logins), parent–player relationships and program enrolments. Users can only access information they're allowed to see.

### 4.3 Training programs

A coach creates programs. A program has a name, sport, age group, description, training objectives and a coach.

```text
Program: U14 Cricket Development
Age Group: Under 14
Coach: Coach A
```

#### Program enrolment

A player is linked to a program through an enrolment, which the program's coach creates:

```text
Coach → Program → enrols Player → Player can book sessions in that program
```

Enrolments and bookings are stored separately:

* An **enrolment** (program ↔ player) is the lasting relationship. It decides which players a coach manages.
* A **booking** (session ↔ player) means the player is attending one specific session.

Parent enrolment requests are not part of the MVP and can be added later if the academy needs them.

### 4.4 Training sessions

Coaches create sessions for their programs. A session has a date, start time, end time, location, session capacity, coach, program and status.

```text
U14 Cricket Development
Saturday, 10:00 AM – 11:30 AM
capacity = 15
```

### 4.5 Session capacity and bookings

Session capacity is the number of players a session can accept. The system shows how many places are booked and how many are left:

```text
capacity  = 15
booked    = 11
available = 4
```

There is no separate coach availability calendar. "Available" always means places left in a session.

Parents can book available places for their children in sessions that belong to a program the child is enrolled in. The backend must reject:

* duplicate bookings
* bookings for a player who isn't enrolled in the session's program
* bookings when the session is full
* other invalid bookings, and access by users who aren't allowed to see them

It must also handle two people booking at the same time, so session capacity is never exceeded.

### 4.6 Attendance

Coaches record attendance for players in their sessions as **Present**, **Absent** or **Excused**. Each record belongs to one player and one session.

Only players with a confirmed booking can be marked, and attendance opens when the session starts. The coach can change it later.

### 4.7 Player development

Coaches record development notes for players. A note can include skills being worked on, areas for improvement, progress observations, the date and the coach who wrote it. Parents and players can only see notes they're allowed to access.

Each note belongs to one of the coach's programs. A player's parents see every note about them. A coach only sees the notes written in their own programs, not notes another coach wrote about the same player. Notes can be edited by the coach who wrote them but aren't deleted.

A player's progress is shown as their attendance summary and their notes over time. There are no ratings or scores, because those would depend on the sport.

### 4.8 Payments (after the MVP)

Invoices, payment status, pricing and payment history are planned for after the MVP. Payments will be a separate feature, and the core tables won't include payment fields, so they don't complicate the booking system.

## 5. Authorisation rules

The backend enforces these rules. The frontend doesn't decide what a user can access.

**Coach**

* Manages their own programs and sessions, including session capacity
* Enrols players into their own programs
* Sees players enrolled in their programs
* Records attendance for their own sessions
* Adds development notes for players in their programs

**Parent**

* Sees their own account and their children
* Books sessions for their children, in programs the child is enrolled in
* Sees their children's attendance and development information
* Sees their own payment information (after the MVP)

**Player**

* Sees their own schedule, attendance and development information

## 6. Business rules

These are enforced by the backend, and by database constraints where possible:

* A player can't be booked into the same session twice.
* A session can't go over its session capacity.
* Session capacity can't be negative.
* A cancelled booking frees up its place.
* A parent can't book for a player they don't manage.
* A player can only be booked into sessions from a program they're actively enrolled in.
* A player can't be enrolled in the same program twice.
* A coach can't change another coach's session or record attendance for it.
* Users can't see other users' private information.
* A session must have a valid date and time, and its end time must be after its start time.

## 7. MVP scope

1. User authentication
2. Role-based access
3. Parent and player profiles
4. Coach profiles
5. Training programs
6. Program enrolment
7. Training sessions
8. Session capacity
9. Session bookings
10. Attendance
11. Basic player development notes

Payments come after the MVP. The database schema is built up over time: each table is added by a migration in the phase that needs it.

## 8. Non-functional requirements

* **Security:** hashed passwords, JWT authentication, role-based authorisation, input validation.
* **Reliability:** database constraints for important rules, transaction-safe bookings, clear error responses, automated tests.
* **Maintainability:** backend code grouped by feature, reusable frontend components, consistent formatting and linting, up-to-date documentation.
* **Performance:** API responses should be quick at the scale of one academy. Queries shouldn't load more data than they need.

## 9. Testing

* **Backend (pytest):** unit, API endpoint, business rule, authentication/authorisation and database integration tests.
* **Frontend (Vitest):** component, utility and UI behaviour tests.
* **End-to-end (Playwright):** login, a coach creating a session, a parent booking a session, full-session behaviour, attendance, and role-based access.

So far, Phases 1 to 5 cover health checks and database tests, registration, login, role checks, players, programs, enrolment, sessions, bookings, attendance, development notes and ownership checks on the backend, a test where several parents book the last places at the same moment, frontend tests for the forms, route guards, Sydney time and the player, program, session, booking, attendance, notes and calendar pages, and Playwright tests for sign-up, login, role-based access, a coach enrolling a parent's child, two parents trying to book the last place in a session, and a coach recording attendance and a note that the parent then sees.

## 10. Technology

* **Frontend:** React, TypeScript, Tailwind CSS, Vitest, Playwright
* **Backend:** Python, FastAPI, JWT authentication, pytest
* **Database:** PostgreSQL
* **Development:** Docker, Docker Compose, Git, GitHub, GitHub Actions
* **Deployment (Phase 7):** a free live demo on Vercel, Render and Neon (see [deployment.md](deployment.md)). Terraform is left for a real production deployment.

## 11. Architecture

```text
React + TypeScript
        │  REST API (JSON)
        ▼
FastAPI backend
        │  SQL
        ▼
PostgreSQL
```

The backend handles authentication and authorisation. The frontend only talks to the backend's REST API, never to the database directly. More detail is in [architecture.md](architecture.md).

## 12. Development phases

| Phase | Scope |
|---|---|
| **1. Foundation** (done) | Repository setup, documentation, backend and frontend skeletons, PostgreSQL in Docker, Docker Compose, CI |
| **2. Authentication** (done) | User model, parent registration, login, password hashing, JWT access tokens, role-based authorisation, coach creation script |
| **2b. Refresh tokens** (done) | Refresh tokens, rotation, revocation (logout) |
| **3. Core management** (done) | Players, parent–player relationships, training programs, program enrolment (`program_players`) |
| **4. Sessions and bookings** (done) | Sessions, session capacity, bookings, booking validation, handling concurrent bookings |
| **5. Attendance and development** (done) | Attendance records, development notes, player progress |
| **5b. Design refresh** (done) | Academy branding, shared UI components, calendar of upcoming sessions |
| **6. Payments** | Invoices, payment status, payment history |
| **7. Deployment** (live demo done) | Free live demo with made-up data. Production configuration, Terraform, monitoring and logging are future work |

## 13. Other sports

Cricket is the first use case, but the system shouldn't hard-code cricket-specific assumptions. Football, basketball, tennis, swimming or other sports should be possible later without redesigning the platform.
