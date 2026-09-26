"""Create a coach account.

Public registration only creates parents, so coaches are added with this script:

    docker compose exec backend python -m scripts.create_coach \\
        --email coach@example.com --first-name Sam --last-name Lee

It asks for the password with a hidden prompt, so it never ends up in your shell
history. For CI or other non-interactive use, set COACH_PASSWORD instead.
"""

import argparse
import getpass
import os
import sys
from collections.abc import Callable, Sequence

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy.orm import Session

from app.auth.schemas import Name, Password
from app.core.errors import ConflictError
from app.db.session import get_engine
from app.users.models import Role
from app.users.service import create_user

PASSWORD_ENV_VAR = "COACH_PASSWORD"


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a coach account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    return parser.parse_args(argv)


def _read_password() -> str:
    from_env = os.environ.get(PASSWORD_ENV_VAR)
    if from_env:
        return from_env

    password = getpass.getpass("Password: ")
    if getpass.getpass("Confirm password: ") != password:
        raise ValueError("Passwords don't match.")
    return password


def _default_session() -> Session:
    return Session(get_engine())


def main(
    argv: Sequence[str] | None = None,
    session_factory: Callable[[], Session] = _default_session,
) -> int:
    args = _parse_args(argv)

    try:
        email = TypeAdapter(EmailStr).validate_python(args.email).lower()
        first_name = TypeAdapter(Name).validate_python(args.first_name)
        last_name = TypeAdapter(Name).validate_python(args.last_name)
        password = TypeAdapter(Password).validate_python(_read_password())
    except ValidationError as exc:
        print(f"Invalid input: {exc.errors()[0]['msg']}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    with session_factory() as db:
        try:
            user = create_user(
                db,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role=Role.COACH,
            )
        except ConflictError as exc:
            print(exc.message, file=sys.stderr)
            return 1

        print(f"Created coach {user.email} ({user.id})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
