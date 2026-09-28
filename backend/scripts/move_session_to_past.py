"""Move a session into the past, for testing attendance.

The API only lets coaches create sessions in the future, and attendance opens when a
session starts. The end-to-end test books a session first and then runs this, so the
coach can mark attendance straight away:

    docker compose exec backend python -m scripts.move_session_to_past <session id>

The session keeps its length and now ends half an hour ago. The script refuses to run
in production.
"""

import argparse
import sys
import uuid
from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_engine
from app.sessions.models import TrainingSession


def _default_session() -> Session:
    return Session(get_engine())


def _app_env() -> str:
    return get_settings().app_env


def main(
    argv: Sequence[str] | None = None,
    session_factory: Callable[[], Session] = _default_session,
    app_env: Callable[[], str] = _app_env,
) -> int:
    parser = argparse.ArgumentParser(
        description="Move a session into the past (not in production)."
    )
    parser.add_argument("session_id")
    args = parser.parse_args(argv)

    if app_env() == "production":
        print("This script can't be used in production.", file=sys.stderr)
        return 1
    try:
        session_id = uuid.UUID(args.session_id)
    except ValueError:
        print("That isn't a session id.", file=sys.stderr)
        return 1

    with session_factory() as db:
        session = db.get(TrainingSession, session_id)
        if session is None:
            print("Session not found.", file=sys.stderr)
            return 1
        length = session.ends_at - session.starts_at
        session.ends_at = datetime.now(UTC) - timedelta(minutes=30)
        session.starts_at = session.ends_at - length
        db.commit()
        print(f"Session {session.id} now started at {session.starts_at.isoformat()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
