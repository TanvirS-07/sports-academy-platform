"""Several parents try to book the last places in a session at the same moment.

Unlike the other tests, this one can't run inside one rolled-back transaction: each
thread needs its own database connection, and they only block each other if the data
is really committed. So it commits its own data and deletes it again at the end.
"""

import threading
import uuid
from collections.abc import Iterator
from dataclasses import dataclass

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.bookings.models import Booking
from app.bookings.service import book_player
from app.core.errors import ConflictError
from app.db.session import get_engine
from app.players.models import ParentPlayer, Player
from app.programs.models import Program, ProgramPlayer
from app.sessions.models import TrainingSession
from app.users.models import Role, User
from tests.helpers import enrol, make_player, make_program, make_session, make_user

PARENTS = 8


@dataclass
class Setup:
    session_id: uuid.UUID
    families: list[tuple[uuid.UUID, uuid.UUID]]  # (parent id, player id)


def _create(db: Session, capacity: int) -> Setup:
    tag = uuid.uuid4().hex[:8]
    coach = make_user(db, email=f"coach-{tag}@example.com", role=Role.COACH)
    program = make_program(db, coach, name=f"Concurrency {tag}")
    session = make_session(db, program, capacity=capacity)
    families = []
    for number in range(PARENTS):
        parent = make_user(db, email=f"parent-{tag}-{number}@example.com")
        player = make_player(db, parent, first_name="Concurrency", last_name=f"{tag}{number}")
        enrol(db, program, player)
        families.append((parent.id, player.id))
    return Setup(session_id=session.id, families=families)


def _delete(db: Session, setup: Setup) -> None:
    session = db.get(TrainingSession, setup.session_id)
    assert session is not None
    program = db.get(Program, session.program_id)
    assert program is not None
    parent_ids = [parent_id for parent_id, _ in setup.families]
    player_ids = [player_id for _, player_id in setup.families]

    db.execute(delete(Booking).where(Booking.session_id == session.id))
    db.execute(delete(TrainingSession).where(TrainingSession.id == session.id))
    db.execute(delete(ProgramPlayer).where(ProgramPlayer.program_id == program.id))
    db.execute(delete(ParentPlayer).where(ParentPlayer.player_id.in_(player_ids)))
    db.execute(delete(Player).where(Player.id.in_(player_ids)))
    db.execute(delete(Program).where(Program.id == program.id))
    db.execute(delete(User).where(User.id.in_([*parent_ids, program.coach_id])))
    db.commit()


@pytest.fixture
def committed() -> Iterator[list[Setup]]:
    created: list[Setup] = []
    yield created
    with Session(get_engine()) as db:
        for setup in created:
            _delete(db, setup)


def _book_all_at_once(setup: Setup) -> list[str]:
    barrier = threading.Barrier(len(setup.families))
    results: list[str] = []
    results_lock = threading.Lock()

    def book(parent_id: uuid.UUID, player_id: uuid.UUID) -> None:
        with Session(get_engine()) as db:
            parent = db.get(User, parent_id)
            assert parent is not None
            barrier.wait()
            try:
                book_player(db, parent, setup.session_id, player_id)
                result = "BOOKED"
            except ConflictError as exc:
                result = exc.code
        with results_lock:
            results.append(result)

    threads = [threading.Thread(target=book, args=family) for family in setup.families]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    return results


@pytest.mark.parametrize("capacity", [1, 3])
def test_capacity_is_never_exceeded(committed: list[Setup], capacity: int) -> None:
    with Session(get_engine()) as db:
        setup = _create(db, capacity)
    committed.append(setup)

    results = _book_all_at_once(setup)

    assert sorted(results) == ["BOOKED"] * capacity + ["SESSION_FULL"] * (PARENTS - capacity)
    with Session(get_engine()) as db:
        session = db.get(TrainingSession, setup.session_id)
        assert session is not None
        assert session.booked_count == capacity
        assert db.query(Booking).filter(Booking.session_id == session.id).count() == capacity
