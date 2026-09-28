"""Small helpers for creating test data."""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.bookings.models import Booking
from app.core.security import create_access_token
from app.players.models import Player
from app.players.schemas import PlayerCreate
from app.players.service import create_player
from app.programs.models import Program, ProgramPlayer
from app.programs.schemas import ProgramCreate
from app.programs.service import create_program
from app.sessions.models import TrainingSession
from app.sports.models import Sport
from app.users.models import Role, User
from app.users.service import create_user

DEFAULT_PASSWORD = "correct-horse-battery"


def make_user(
    db: Session,
    *,
    email: str = "parent@example.com",
    password: str = DEFAULT_PASSWORD,
    role: Role = Role.PARENT,
    first_name: str = "Alex",
    last_name: str = "Taylor",
    is_active: bool = True,
) -> User:
    user = create_user(
        db, email=email, password=password, first_name=first_name, last_name=last_name, role=role
    )
    if not is_active:
        user.is_active = False
        db.commit()
    return user


def make_coach(db: Session, email: str = "coach@example.com") -> User:
    return make_user(db, email=email, role=Role.COACH, first_name="Chris", last_name="Lee")


def auth_header(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.role.value).token
    return {"Authorization": f"Bearer {token}"}


def make_player(
    db: Session,
    parent: User,
    *,
    first_name: str = "Sam",
    last_name: str = "Taylor",
    date_of_birth: date = date(2013, 5, 14),
) -> Player:
    return create_player(
        db,
        parent,
        PlayerCreate(first_name=first_name, last_name=last_name, date_of_birth=date_of_birth),
    )


def cricket(db: Session) -> Sport:
    sport = db.scalar(select(Sport).where(Sport.name == "Cricket"))
    assert sport is not None, "The Cricket row comes from a migration"
    return sport


def make_program(
    db: Session,
    coach: User,
    *,
    name: str = "U14 Cricket Development",
    age_group: str = "Under 14",
) -> Program:
    return create_program(
        db, coach, ProgramCreate(name=name, sport_id=cricket(db).id, age_group=age_group)
    )


def enrol(db: Session, program: Program, player: Player) -> ProgramPlayer:
    enrolment = ProgramPlayer(program_id=program.id, player_id=player.id)
    db.add(enrolment)
    db.commit()
    return enrolment


def make_session(
    db: Session,
    program: Program,
    *,
    starts_at: datetime | None = None,
    hours: float = 1.5,
    capacity: int = 10,
    location: str = "Main oval",
) -> TrainingSession:
    """Adds the row directly, so tests can also make sessions that started in the past."""
    if starts_at is None:
        starts_at = datetime.now(UTC) + timedelta(days=7)
    session = TrainingSession(
        program_id=program.id,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=hours),
        location=location,
        capacity=capacity,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def book(db: Session, session: TrainingSession, player: Player, parent: User) -> Booking:
    """Adds a confirmed booking directly, so it also works for sessions that have started."""
    booking = Booking(session_id=session.id, player_id=player.id, booked_by=parent.id)
    db.add(booking)
    session.booked_count += 1
    db.commit()
    return booking
