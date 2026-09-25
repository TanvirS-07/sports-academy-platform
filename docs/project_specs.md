# Sports Academy Management Platform

## 1. Overview

The Sports Academy Management Platform is a full-stack web application designed to centralise the management of sports academy operations.

The initial implementation will focus on a cricket academy, while the underlying system will be designed so that it can be adapted to other sports academies with similar operational requirements.

The platform will replace repetitive manual processes with a centralised system for managing training programs, sessions, bookings, attendance, player development, and payments.

The system will use a coach-led management model. There will be no central Academy Administrator role in the initial scope.

---

## 2. Target Users

### 2.1 Coaches

Coaches are responsible for managing the training sessions and programs they operate.

Coaches will be able to:

* Create training programs
* Create and manage their own sessions
* Set session capacity
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
* Manage payments and invoices
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

---

### 4.2 User Management

The system will support:

* Coach accounts
* Parent accounts
* Player profiles
* Parent-player relationships
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

Each session will have a defined capacity.

The system will track:

```text
Capacity: 15
Booked: 11
Available: 4
```

Parents will be able to book available places for their children.

The system must prevent:

* Duplicate bookings
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

Payment functionality is planned but may be implemented after the core platform.

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
* A coach can view players associated with their sessions.
* A coach can record attendance for their sessions.
* A coach can add development notes for players they coach.

### Parent

A parent should only be able to:

* View their own account
* View their children
* Book sessions for their children
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
6. Training sessions
7. Session capacity
8. Session bookings
9. Attendance
10. Basic player development notes

Payments and more advanced functionality can be implemented after the core workflow is stable.

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
* Registration
* Login
* Password hashing
* JWT authentication
* Role-based authorisation

### Phase 3 — Core Academy Management

* Coaches
* Parents
* Players
* Parent-player relationships
* Training programs

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
