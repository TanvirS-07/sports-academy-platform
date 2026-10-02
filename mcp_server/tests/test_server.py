import json
from datetime import UTC, datetime, timedelta

import httpx2
import pytest
from mcp.server.mcpserver.exceptions import ToolError

import server
from academy_api import AcademyApi, ApiError

pytestmark = pytest.mark.anyio

PROGRAM_ID = "11992b1e-4b09-4099-9e4f-9fe7c6983702"
PROGRAM = {
    "id": PROGRAM_ID,
    "name": "Junior Batting",
    "sport": {"id": "c1", "name": "Cricket"},
    "age_group": "Under 12",
    "description": "",
    "objectives": "",
}


class FakeApi:
    """Answers like the academy API and records every request it gets."""

    def __init__(self) -> None:
        self.requests: list[httpx2.Request] = []
        self.logins = 0
        self.expire_next_token = False

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        path = request.url.path.removeprefix("/api/v1")
        if path == "/auth/login":
            self.logins += 1
            return httpx2.Response(200, json={"access_token": f"token-{self.logins}"})
        if self.expire_next_token:
            self.expire_next_token = False
            return httpx2.Response(401, json={"error": {"message": "Invalid or expired token"}})
        if path == "/programs":
            return httpx2.Response(200, json=[PROGRAM])
        if path == "/sessions" and request.method == "POST":
            return httpx2.Response(201, json={"id": "new-session"})
        return httpx2.Response(404, json={"error": {"message": "Session not found"}})


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch) -> FakeApi:
    fake = FakeApi()
    api = AcademyApi(
        "http://localhost:8000/api/v1",
        "coach@example.com",
        "password",
        transport=httpx2.MockTransport(fake.handle),
    )
    monkeypatch.setattr(server, "_api", api)
    return fake


def test_refuses_an_api_that_is_not_local() -> None:
    with pytest.raises(ValueError, match="localhost"):
        AcademyApi("https://precisioncricket.vercel.app/api/v1", "a@example.com", "x")


async def test_logs_in_again_when_the_token_expires(fake: FakeApi) -> None:
    await server.list_programs()
    fake.expire_next_token = True

    programs = await server.list_programs()

    assert programs[0]["name"] == "Junior Batting"
    assert fake.logins == 2
    assert fake.requests[-1].headers["Authorization"] == "Bearer token-2"


async def test_api_errors_come_back_as_tool_errors(fake: FakeApi) -> None:
    with pytest.raises(ToolError, match="Session not found"):
        await server.check_availability("00000000-0000-0000-0000-000000000000")


async def test_api_error_keeps_the_api_message() -> None:
    def handle(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(401, json={"error": {"message": "Invalid email or password"}})

    api = AcademyApi(
        "http://localhost:8000", "a@example.com", "x", transport=httpx2.MockTransport(handle)
    )
    with pytest.raises(ApiError, match="Invalid email or password"):
        await api.get("/programs")


def _times() -> tuple[datetime, datetime]:
    starts_at = datetime.now(UTC) + timedelta(days=3)
    return starts_at, starts_at + timedelta(minutes=90)


async def test_create_session_only_previews_without_confirm(fake: FakeApi) -> None:
    starts_at, ends_at = _times()

    result = await server.create_session(PROGRAM_ID, starts_at, ends_at, "Nets 3", 8)

    assert result.startswith("Not created yet")
    assert not [r for r in fake.requests if r.method == "POST" and "sessions" in r.url.path]


async def test_create_session_posts_once_confirmed(fake: FakeApi) -> None:
    starts_at, ends_at = _times()

    result = await server.create_session(
        PROGRAM_ID, starts_at, ends_at, "  Nets 3 ", 8, confirm=True
    )

    assert result.startswith("Created session new-session")
    post = fake.requests[-1]
    assert post.method == "POST"
    assert json.loads(post.content)["location"] == "Nets 3"


async def test_create_session_rejects_bad_times(fake: FakeApi) -> None:
    starts_at, ends_at = _times()
    with pytest.raises(ToolError, match="end after it starts"):
        await server.create_session(PROGRAM_ID, ends_at, starts_at, "Nets 3", 8, confirm=True)

    past = datetime.now(UTC) - timedelta(days=1)
    with pytest.raises(ToolError, match="in the future"):
        await server.create_session(
            PROGRAM_ID, past, past + timedelta(hours=1), "Nets 3", 8, confirm=True
        )


async def test_create_session_rejects_another_coachs_program(fake: FakeApi) -> None:
    starts_at, ends_at = _times()
    with pytest.raises(ToolError, match="isn't one of yours"):
        await server.create_session(
            "00000000-0000-0000-0000-000000000000", starts_at, ends_at, "Nets 3", 8, confirm=True
        )
