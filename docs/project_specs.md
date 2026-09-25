# Sports Academy Management Platform

## 1. Overview

The Sports Academy Management Platform is a full-stack web application designed to centralise the management of sports academy operations.

The initial implementation will focus on a cricket academy, while the underlying system will be designed so that it can be adapted to other sports academies with similar operational requirements.

The platform will replace repetitive manual processes with a centralised system for managing training programs, sessions, bookings, attendance, player development, and payments.

The system uses a coach-led management model. Coaches manage their own programs, sessions and enrolled players. The platform has three roles: Coach, Parent and Player.

---

## 2. Target Users

### 2.1 Coaches

Coaches are responsible for managing the training sessions and programs they operate.

Coaches will be able to:

* Create training programs
* Enrol players into their programs
* Create and manage their own sessions
* Set session capacity (the number of available places)
* View available and occupied places
* View players booked into their sessions
* Manage session bookings where appropriate
* Record attendance
* Add player development notes
* Track player progress
* View relevant payment information if payments are implemented

---

### 2.2 Parents

Parents are responsible for managing their children's participation in the academy.

Parents will be able to:

* Manage their children's profiles
* View available sessions
* View session capacity and available places
* Book sessions for their children
* View upcoming sessions
* View attendance records
* View player development information
* View invoices and payment status

---

### 2.3 Players

A Player is initially a profile created and managed by a Parent. A Player does not need their own login. A Player may be given a login later, which allows them to view their own information directly.

Players will have access to information relating to their own participation and development.

Players will be able to:

* View their training schedule
* View upcoming sessions
* View attendance records
* View development information
* Track their progress

---

## 3. Core Goals

The platform will aim to:

* Centralise academy operations
* Reduce repetitive manual administrative processes
* Simplify training session scheduling
* Manage session capacity and available places
* Allow parents to book available sessions
* Prevent overbooking
* Track player attendance
* Track player development
* Provide coaches with relevant player information
* Manage payments and invoices (after the MVP)
* Provide users with role-appropriate access to information

---

## 4. Core Features

### 4.1 Authentication

The system will provide:

* User registration/login
* Secure password handling
* JWT-based authentication
* Role-based authorisation
* Protected API endpoints
* Session/token management

Account creation rules:

* Public registration creates **Parent** accounts only.
* **Coach** accounts are created through a development CLI/seed script for the MVP.
* **Player** logins are optional and are enabled later by the Player's Parent.

Token management is delivered in two steps:

* Phase 2: short-lived JWT access tokens.
* Phase 2b: refresh tokens with rotation and revocation.

---

### 4.2 User Management

The system will support:

* Coach accounts
* Parent accounts
* Player profiles (created and managed by Parents)
* Optional Player logins
* Parent-player relationships
* Program-player enrolments
* Role-based access control

Users should only be able to access information they are authorised to view.

---

### 4.3 Training Programs

Coaches will be able to create and manage training programs.

A program may contain information such as:

* Program name
* Sport
* Age group
* Description
* Training objectives
* Assigned coach

Example:

```text
Program: U14 Cricket Development
Age Group: Under 14
Coach: Coach A
```

#### Program enrolment

The relationship between a player and a program is explicit. The coach who owns a program enrols players into it:

```text
Coach
  ↓
Program
  ↓
Enrols Player
  ↓
Player can book sessions belonging to that program
```

Enrolment is stored separately from bookings:

* **Enrolment** (program ↔ player) is the lasting relationship. It determines which players a coach manages.
* **Booking** (session ↔ player) represents participation in one specific training session.

Parent enrolment requests are not part of the MVP and may be added later if the academy needs them.

---

### 4.4 Training Sessions

Coaches will be able to create sessions associated with their programs.

A session may contain:

* Date
* Start time
* End time
* Location
* Capacity
* Assigned coach
* Training program
* Session status

Example:

```text
U14 Cricket Development
Saturday
10:00 AM – 11:30 AM
Capacity: 15
```

---

### 4.5 Session Capacity and Bookings

Each session will have a defined capacity. For now, "session availability" means the number of available places in a session (capacity minus confirmed bookings). A separate coach availability calendar is out of scope.

The system will track:

```text
Capacity: 15
Booked: 11
Available: 4
```

Parents will be able to book available places for their children in sessions that belong to a program their child is enrolled in.

The system must prevent:

* Duplicate bookings
* Booking a session for a player who is not enrolled in that session's program
* Booking when a session is full
* Invalid bookings
* Unauthorised users accessing bookings

The backend must also handle concurrent booking attempts so that the available capacity cannot be exceeded.

---

### 4.6 Attendance

Coaches will be able to record attendance for players participating in their sessions.

Attendance may include:

* Present
* Absent
* Excused

The system will store attendance against the relevant player and session.

---

### 4.7 Player Development

Coaches will be able to record development information for players.

Development records may include:

* Development notes
* Skills being worked on
* Areas for improvement
* Progress observations
* Date of observation
* Coach who recorded the observation

Parents and players will only be able to view development information they are authorised to access.

---

### 4.8 Payments

Payment functionality is planned for after the MVP. It is not part of the initial core system, and the core tables will not contain payment fields.

Potential functionality includes:

* Invoices
* Payment status
* Session/program pricing
* Payment history
* Parent payment records

Payment processing will be treated as a separate feature so that it does not unnecessarily complicate the initial MVP.

---

## 5. Authorisation Rules

The system must enforce role-based access.

### Coach

A coach should only be able to modify resources they are authorised to manage.

For example:

* A coach can manage their own sessions.
* A coach can manage capacity for their own sessions.
* A coach can enrol players into their own programs.
* A coach can view players enrolled in their programs.
* A coach can record attendance for their sessions.
* A coach can add development notes for players enrolled in their programs.

### Parent

A parent should only be able to:

* View their own account
* View their children
* Book sessions for their children, in programs their children are enrolled in
* View their children's attendance
* View their children's development information
* View their own payment information

### Player

A player should only be able to:

* View their own schedule
* View their own attendance
* View their own development information

---

## 6. Important Business Rules

The backend should enforce business rules rather than relying solely on frontend validation.

Examples include:

* A player cannot have duplicate bookings for the same session.
* A session cannot exceed its capacity.
* A parent cannot book a session for a player they do not manage.
* A player can only be booked into sessions that belong to a program they are actively enrolled in.
* A player cannot be enrolled in the same program twice.
* A coach cannot modify another coach's session.
* A coach cannot record attendance for a session they are not authorised to manage.
* Users cannot access another user's private information.
* A cancelled booking should free the relevant session place.
* Session capacity cannot be negative.
* A session must have a valid date and time.
* A session's end time must occur after its start time.

---

## 7. Initial MVP

The initial MVP should focus on the core academy workflow:

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

Payments are not part of the MVP. They and other advanced functionality will be implemented after the core workflow is stable.

The database schema is built incrementally: each table is created by a migration in the phase that implements the feature that needs it.

---

## 8. Non-Functional Requirements

The application should aim to provide:

### Security

* Secure password storage
* JWT authentication
* Role-based authorisation
* Input validation
* Protected endpoints
* Appropriate access controls

### Reliability

* Database constraints for critical business rules
* Automated testing
* Error handling
* Transaction-safe booking operations

### Maintainability

* Clear separation of responsibilities
* Modular backend architecture
* Reusable frontend components
* Consistent coding standards
* Documentation

### Performance

The system should provide responsive API requests under normal expected academy usage.

Database queries should be designed to avoid unnecessary operations and inefficient data retrieval.

---

## 9. Testing Requirements

The project should include multiple levels of automated testing.

### Backend

Using `pytest`:

* Unit tests
* API endpoint tests
* Business logic tests
* Authentication/authorisation tests
* Database integration tests

### Frontend

Using `Vitest`:

* Component tests
* Utility/function tests
* UI behaviour tests

### End-to-End

Using `Playwright`:

* User login
* Coach creating a session
* Parent booking a session
* Full-session booking behaviour
* Attendance workflow
* Role-based access scenarios

---

## 10. Planned Technology

### Frontend

* React
* TypeScript
* Tailwind CSS
* Vitest
* Playwright

### Backend

* Python
* FastAPI
* JWT authentication
* pytest

### Database

* PostgreSQL

### Development & Infrastructure

* Docker
* Docker Compose
* Git
* GitHub
* GitHub Actions
* AWS
* Terraform

---

## 11. Architecture

The initial architecture will follow a client-server model:

```text
React + TypeScript
        |
        | HTTPS / REST API
        v
FastAPI Backend
        |
        | SQL / Database Access
        v
PostgreSQL
```

Authentication and authorisation will be handled by the backend.

The frontend will consume the backend through REST APIs and will not directly access the PostgreSQL database.

---

## 12. Development Phases

### Phase 1 — Foundation

* Repository setup
* Project documentation
* Backend initialisation
* Frontend initialisation
* PostgreSQL setup
* Docker configuration
* Initial CI pipeline

### Phase 2 — Authentication

* User model
* Parent registration
* Login
* Password hashing
* JWT access-token authentication
* Role-based authorisation
* Coach creation CLI/seed script

### Phase 2b — Refresh Tokens

* Refresh tokens
* Token rotation
* Token revocation (logout)

### Phase 3 — Core Academy Management

* Coaches
* Parents
* Players
* Parent-player relationships
* Training programs
* Program enrolment (program_players)

### Phase 4 — Sessions and Bookings

* Session creation
* Session management
* Capacity management
* Available-place calculation
* Bookings
* Booking validation
* Concurrency handling

### Phase 5 — Attendance and Development

* Attendance records
* Development notes
* Player progress

### Phase 6 — Payments

* Invoices
* Payment status
* Payment history

### Phase 7 — Production

* Production configuration
* AWS deployment
* Terraform infrastructure
* CI/CD deployment pipeline
* Monitoring and logging

---

## 13. Future Extensibility

Although the initial implementation will focus on cricket, the system should avoid unnecessarily hard-coding cricket-specific assumptions.

Potential future support includes:

* Football
* Basketball
* Tennis
* Swimming
* Other sports

The architecture should allow sport-specific functionality to be added without requiring a complete redesign of the platform.
