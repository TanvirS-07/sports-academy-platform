"""Fill the database with made-up demo data for the live demo.

Everyone in here is invented and every email is on example.com. Sessions are placed
around today's date in Sydney, so the calendar is never empty:

    docker compose run --rm -e DATABASE_URL=<database url> backend python -m scripts.seed_demo

It refuses to run if the database already has users. Pass --reset to delete all
existing data first (the Cricket sport row from the migrations is kept). Every demo
account uses the same password, DEMO_PASSWORD below.
"""

import argparse
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.attendance.models import Attendance, AttendanceStatus
from app.bookings.models import Booking
from app.core.security import hash_password
from app.db.session import get_engine
from app.notes.models import DevelopmentNote
from app.players.models import ParentPlayer, Player
from app.programs.models import Program, ProgramPlayer
from app.sessions.models import SessionStatus, TrainingSession
from app.sports.models import Sport
from app.users.models import Role, User

SYDNEY = ZoneInfo("Australia/Sydney")
DEMO_PASSWORD = "demo-password"

# Every table with data, children first. sports and alembic_version are left alone.
TABLES = (
    "refresh_tokens",
    "attendance",
    "development_notes",
    "bookings",
    "training_sessions",
    "program_players",
    "programs",
    "parent_players",
    "players",
    "users",
)

COACHES = (
    ("coach@example.com", "Sam", "Carter"),
    ("coach.priya@example.com", "Priya", "Nair"),
)
PARENTS = (
    ("parent@example.com", "Alex", "Morgan"),
    ("parent.jordan@example.com", "Jordan", "Lee"),
    ("parent.chris@example.com", "Chris", "Walsh"),
    ("parent.sarah@example.com", "Sarah", "Khan"),
    ("parent.ben@example.com", "Ben", "Roberts"),
    ("parent.mei@example.com", "Mei", "Chen"),
    ("parent.daniel@example.com", "Daniel", "Okafor"),
    ("parent.emma@example.com", "Emma", "Fischer"),
)
# (parent index, first name, last name, age in years)
PLAYERS = (
    (0, "Ethan", "Morgan", 11),
    (0, "Mia", "Morgan", 13),
    (1, "Noah", "Lee", 12),
    (1, "Ava", "Lee", 14),
    (2, "Liam", "Walsh", 11),
    (2, "Zoe", "Walsh", 13),
    (3, "Arjun", "Khan", 10),
    (3, "Leila", "Khan", 13),
    (4, "Oliver", "Roberts", 11),
    (4, "Harry", "Roberts", 14),
    (5, "Lucas", "Chen", 12),
    (5, "Chloe", "Chen", 10),
    (6, "Samuel", "Okafor", 13),
    (6, "Grace", "Okafor", 11),
    (7, "Jack", "Fischer", 10),
    (7, "Ruby", "Fischer", 14),
    (7, "Max", "Fischer", 12),
    (1, "Isaac", "Lee", 10),
)


@dataclass(frozen=True)
class DemoProgram:
    coach: int
    name: str
    age_group: str
    description: str
    objectives: str
    players: tuple[int, ...]
    capacity: int
    weekday: int  # Monday is 0
    start: time
    location: str


PROGRAMS = (
    DemoProgram(
        coach=0,
        name="Junior Batting",
        age_group="Under 12",
        description="Batting basics for younger players, in the nets and on the field.",
        objectives="Solid grip and stance, playing straight, calling and running between wickets.",
        players=(0, 4, 6, 8, 11, 13, 14, 17),
        capacity=10,
        weekday=1,
        start=time(16, 30),
        location="Nets 1 and 2",
    ),
    DemoProgram(
        coach=0,
        name="Pace Bowling",
        age_group="Under 15",
        description="Run-up, action and accuracy for players who want to bowl quick.",
        objectives="A repeatable run-up, a safe action and hitting a good length.",
        players=(1, 2, 3, 5, 7, 9, 10, 12, 15, 16),
        capacity=12,
        weekday=3,
        start=time(16, 30),
        location="Main oval",
    ),
    DemoProgram(
        coach=1,
        name="Fielding and Fitness",
        age_group="Under 14",
        description="Catching, ground fielding and throwing, with some fitness work.",
        objectives="Safe hands, a quick pick-up and throw, and better running.",
        # One more player than places, so the next session can be shown as full.
        players=(0, 1, 2, 4, 5, 6, 7, 8, 10, 12, 13, 14, 16),
        capacity=12,
        weekday=5,
        start=time(9, 0),
        location="Main oval",
    ),
)

WEEKS_BEFORE = 2
WEEKS_AFTER = 4
SESSION_LENGTH = timedelta(minutes=90)
NOTES_PER_PROGRAM = 4

NOTES = (
    ("Front foot drive", "Keeping the head still", "Much more balanced than last month."),
    ("Line and length", "Follow-through", "Hitting a good length more often."),
    ("Catching high balls", "Calling early", "Took every catch in the drill today."),
    ("Running between wickets", "Backing up at the non-striker's end", "Calling is clearer."),
    ("Bowling a yorker", "Keeping the front arm up", "Getting it right about half the time."),
    ("Ground fielding", "Getting low earlier", "Quick pick-up and a good flat throw."),
)


def _default_session() -> Session:
    return Session(get_engine())


def _now() -> datetime:
    return datetime.now(UTC)


def _has_users(db: Session) -> bool:
    return db.scalar(select(User.id).limit(1)) is not None


def _reset(db: Session) -> None:
    db.execute(text(f"TRUNCATE {', '.join(TABLES)}"))


def _session_times(program: DemoProgram, today: date) -> list[datetime]:
    """Weekly session start times (UTC), from WEEKS_BEFORE ago to WEEKS_AFTER ahead."""
    this_week = today - timedelta(days=today.weekday()) + timedelta(days=program.weekday)
    days = [this_week + timedelta(weeks=w) for w in range(-WEEKS_BEFORE, WEEKS_AFTER + 1)]
    return [datetime.combine(d, program.start, tzinfo=SYDNEY).astimezone(UTC) for d in days]


def seed(db: Session, now: datetime) -> None:
    password_hash = hash_password(DEMO_PASSWORD)
    today = now.astimezone(SYDNEY).date()
    cricket = db.scalars(select(Sport).where(Sport.name == "Cricket")).one()

    def user(role: Role, email: str, first: str, last: str) -> User:
        return User(
            email=email, password_hash=password_hash, first_name=first, last_name=last, role=role
        )

    coaches = [user(Role.COACH, *c) for c in COACHES]
    parents = [user(Role.PARENT, *p) for p in PARENTS]
    db.add_all(coaches + parents)

    players = []
    for i, (_parent, first, last, age) in enumerate(PLAYERS):
        # Spread birthdays over the year, while keeping each player the given age today.
        born = date(today.year - age - 1, today.month, 1) + timedelta(days=31 + 19 * i)
        player = Player(first_name=first, last_name=last, date_of_birth=born)
        players.append(player)
        db.add(player)
    db.flush()
    for (parent, *_), player in zip(PLAYERS, players, strict=True):
        db.add(ParentPlayer(parent_id=parents[parent].id, player_id=player.id))

    for index, spec in enumerate(PROGRAMS):
        coach = coaches[spec.coach]
        program = Program(
            coach_id=coach.id,
            sport_id=cricket.id,
            name=spec.name,
            age_group=spec.age_group,
            description=spec.description,
            objectives=spec.objectives,
        )
        db.add(program)
        db.flush()
        enrolled = [players[i] for i in spec.players]
        for player in enrolled:
            db.add(ProgramPlayer(program_id=program.id, player_id=player.id))

        made_full = False
        for week, starts_at in enumerate(_session_times(spec, today)):
            session = TrainingSession(
                program_id=program.id,
                starts_at=starts_at,
                ends_at=starts_at + SESSION_LENGTH,
                location=spec.location,
                capacity=spec.capacity,
            )
            # One upcoming session is cancelled, so that state shows up too.
            if index == 1 and week == WEEKS_BEFORE + 2:
                session.status = SessionStatus.CANCELLED
            db.add(session)
            db.flush()
            if session.status == SessionStatus.CANCELLED:
                continue

            if len(enrolled) > spec.capacity and starts_at > now and not made_full:
                # The next session is full: everyone is booked except the first player
                # (a child of parent@example.com), who can't get a place.
                booked = enrolled[1:]
                made_full = True
            else:
                # Leave about a quarter unbooked each week, so parents have something to book.
                booked = [p for i, p in enumerate(enrolled) if (i + week) % 4 != 0]
            booked = booked[: spec.capacity]
            for player in booked:
                parent = parents[PLAYERS[players.index(player)][0]]
                db.add(Booking(session_id=session.id, player_id=player.id, booked_by=parent.id))
            session.booked_count = len(booked)

            if session.ends_at < now:
                for i, player in enumerate(booked):
                    # Mostly present, with the odd absence and excused absence.
                    status = {4: AttendanceStatus.ABSENT, 5: AttendanceStatus.EXCUSED}.get(
                        (i + week + index) % 8, AttendanceStatus.PRESENT
                    )
                    db.add(
                        Attendance(
                            session_id=session.id,
                            player_id=player.id,
                            status=status,
                            recorded_by=coach.id,
                        )
                    )

        for i, player in enumerate(enrolled[:NOTES_PER_PROGRAM]):
            skills, improvements, progress = NOTES[(index + i) % len(NOTES)]
            db.add(
                DevelopmentNote(
                    player_id=player.id,
                    program_id=program.id,
                    coach_id=coach.id,
                    noted_on=today - timedelta(days=3 + 4 * i),
                    skills=skills,
                    improvements=improvements,
                    progress=progress,
                )
            )

    db.commit()


def main(
    argv: Sequence[str] | None = None,
    session_factory: Callable[[], Session] = _default_session,
    now: Callable[[], datetime] = _now,
) -> int:
    parser = argparse.ArgumentParser(description="Fill the database with made-up demo data.")
    parser.add_argument(
        "--reset", action="store_true", help="delete all existing data first (can't be undone)"
    )
    args = parser.parse_args(argv)

    with session_factory() as db:
        if args.reset:
            _reset(db)
        elif _has_users(db):
            print(
                "The database already has users. Use --reset to delete everything first.",
                file=sys.stderr,
            )
            return 1
        seed(db, now())

    print(f"Added the demo data. Every account's password is {DEMO_PASSWORD}")
    print(f"  Coach:  {COACHES[0][0]}")
    print(f"  Parent: {PARENTS[0][0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
