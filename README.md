# Sports Academy Management Platform 

A full-stack management platform designed for sports academies to manage players, coaches, training programs, sessions, attendance, and academy operations.
The initial implementation will be designed around a cricket academy, but the platform will be structured so that it can be adapted to other sports academies with similar requirements.

## Project Status

**Currently in development**

## Planned Technology

* **Frontend:** React + TypeScript
* **Backend:** Python + FastAPI
* **Database:** PostgreSQL
* **Authentication:** JWT
* **Styling:** Tailwind CSS
* **Testing:** pytest, Vitest, Playwright
* **Containerisation:** Docker
* **CI/CD:** GitHub Actions
* **Infrastructure:** AWS + Terraform

## Project Goals

The platform aims to provide a centralised system for:

* Managing players, parents, coaches, and academy staff
* Creating and managing training programs
* Scheduling training sessions
* Recording attendance
* Tracking player development and progress
* Managing payments and invoices
* Reducing manual administrative processes

The application is being developed as a production-style project, with an emphasis on clean architecture, testing, security, maintainability, and real-world software engineering practices.

## User Roles

### Coach
Coaches will be able to:

* Create and manage their training sessions
* Set availabilties for sessions
* Manage and view assigned players
* Manage training programs
* Record player development notes
* Track player progress
* Mark session attendance
* View payments related to their sessions, if I add that later

### Parent
Parents will be able to:

* Manage and view their children
* View available training sessions
* Book available sessions
* View upcoming sessions
* View player development
* View attendance
* View invoices and payment status

### Player
Players will be able to:

* View their training schedule
* View attendance
* View development information

## Session Booking

A core feature of the platform will be session capacity management.

For example:

```text
Saturday Training
10:00 AM – 11:30 AM

Capacity: 5
Booked: 4
Available: 1
```

Parents can book available places for their children. Once the session reaches capacity, additional bookings will not be permitted.

The backend will be responsible for validating bookings and preventing issues such as duplicate bookings or multiple users successfully booking the final available place at the same time.

## Project Motivation

This project is inspired by real-world processes encountered while helping operate a cricket coaching academy.

The goal is to replace repetitive manual processes with a centralised management platform that makes it easier for coaches, players, and parents to manage training sessions, bookings, attendance, development, and payments.

Although the initial implementation focuses on cricket, the underlying architecture will aim to support the broader requirements of sports academies.

## Licence

This project is being developed as a personal portfolio and learning project.
