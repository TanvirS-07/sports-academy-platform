"""require_role isn't used by a real endpoint until Phase 3, so these tests
mount a small test-only app that uses it."""

from collections.abc import Iterator
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.core.errors import register_error_handlers
from app.db.session import get_db
from app.users.models import Role, User
from tests.helpers import auth_header, make_user


@pytest.fixture
def role_client(db_session: Session) -> Iterator[TestClient]:
    test_app = FastAPI()
    register_error_handlers(test_app)

    @test_app.get("/coach-only")
    def coach_only(user: Annotated[User, Depends(require_role(Role.COACH))]) -> dict[str, str]:
        return {"email": user.email}

    @test_app.get("/coach-or-parent")
    def coach_or_parent(
        user: Annotated[User, Depends(require_role(Role.COACH, Role.PARENT))],
    ) -> dict[str, str]:
        return {"email": user.email}

    def _get_test_db() -> Iterator[Session]:
        yield db_session

    test_app.dependency_overrides[get_db] = _get_test_db
    with TestClient(test_app) as client:
        yield client


def test_coach_can_reach_a_coach_only_route(role_client: TestClient, db_session: Session) -> None:
    coach = make_user(db_session, email="coach@example.com", role=Role.COACH)

    response = role_client.get("/coach-only", headers=auth_header(coach))

    assert response.status_code == 200


def test_parent_gets_403_on_a_coach_only_route(
    role_client: TestClient, db_session: Session
) -> None:
    parent = make_user(db_session, email="parent@example.com", role=Role.PARENT)

    response = role_client.get("/coach-only", headers=auth_header(parent))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_missing_token_gets_401_not_403(role_client: TestClient) -> None:
    response = role_client.get("/coach-only")

    assert response.status_code == 401


def test_route_can_allow_several_roles(role_client: TestClient, db_session: Session) -> None:
    coach = make_user(db_session, email="coach@example.com", role=Role.COACH)
    parent = make_user(db_session, email="parent@example.com", role=Role.PARENT)

    assert role_client.get("/coach-or-parent", headers=auth_header(coach)).status_code == 200
    assert role_client.get("/coach-or-parent", headers=auth_header(parent)).status_code == 200
