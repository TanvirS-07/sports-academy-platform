"""MCP server for the Precision Cricket Academy API.

Gives an AI assistant four tools that act as one coach: list their programs, list
their sessions, check spots left in a session and create a session. Runs over stdio:

    uv run server.py

Never print() in here. Over stdio, stdout carries the protocol messages, so anything
else written to it breaks the connection. Logs go to stderr through logging.
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp_types import ToolAnnotations
from pydantic import AwareDatetime, Field

from academy_api import AcademyApi, ApiError

logger = logging.getLogger(__name__)

mcp = MCPServer("precision-cricket")

READ_ONLY = ToolAnnotations(read_only_hint=True, open_world_hint=False)

_api: AcademyApi | None = None


def api() -> AcademyApi:
    # Created on first use so the server still starts (and can be explored in the
    # Inspector) before the login details are set.
    global _api
    if _api is None:
        try:
            _api = AcademyApi.from_env()
        except ValueError as exc:
            raise ToolError(str(exc)) from exc
    return _api


async def _get(path: str, params: dict[str, Any] | None = None) -> Any:
    try:
        return await api().get(path, params)
    except ApiError as exc:
        raise ToolError(str(exc)) from exc


def _session_summary(session: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": session["id"],
        "program": session["program"]["name"],
        "program_id": session["program"]["id"],
        "starts_at": session["starts_at"],
        "ends_at": session["ends_at"],
        "location": session["location"],
        "capacity": session["capacity"],
        "booked": session["booked"],
        "available": session["available"],
        "status": session["status"],
    }


@mcp.tool(annotations=READ_ONLY)
async def list_programs() -> list[dict[str, Any]]:
    """List the training programs run by the logged-in coach.

    Use this to find a program's id (needed by list_sessions and create_session) or to
    answer questions like "which programs do I coach?". Only returns this coach's own
    programs, not every program at the academy.
    """
    programs = await _get("/programs")
    return [
        {
            "id": program["id"],
            "name": program["name"],
            "sport": program["sport"]["name"],
            "age_group": program["age_group"],
        }
        for program in programs
    ]


@mcp.tool(annotations=READ_ONLY)
async def list_sessions(
    program_id: Annotated[
        uuid.UUID | None,
        Field(description="Only sessions in this program. Leave out for all programs."),
    ] = None,
    include_past: Annotated[
        bool, Field(description="Also return sessions that have already finished.")
    ] = False,
) -> list[dict[str, Any]]:
    """List the logged-in coach's training sessions, soonest first.

    By default only upcoming sessions. Each session has its time, location, capacity,
    how many players are booked, spots available and status (SCHEDULED or CANCELLED).
    Times are in UTC. The academy is in Sydney, so convert them before showing them.
    """
    params: dict[str, Any] = {"include_past": include_past}
    if program_id is not None:
        params["program_id"] = str(program_id)
    sessions = await _get("/sessions", params)
    return [_session_summary(session) for session in sessions]


@mcp.tool(annotations=READ_ONLY)
async def check_availability(
    session_id: Annotated[uuid.UUID, Field(description="The session's id, from list_sessions.")],
) -> dict[str, Any]:
    """Check how many spots are left in one training session.

    Use this before telling someone a session has room. Returns capacity, booked,
    available and whether it can still be booked: not cancelled, not started and not full.
    """
    session = _session_summary(await _get(f"/sessions/{session_id}"))
    starts_at = datetime.fromisoformat(session["starts_at"])
    session["bookable"] = (
        session["status"] == "SCHEDULED"
        and starts_at > datetime.now(UTC)
        and session["available"] > 0
    )
    return session


@mcp.tool(
    annotations=ToolAnnotations(
        read_only_hint=False, destructive_hint=False, idempotent_hint=False, open_world_hint=False
    )
)
async def create_session(
    program_id: Annotated[uuid.UUID, Field(description="The program's id, from list_programs.")],
    starts_at: Annotated[
        AwareDatetime,
        Field(description="Start time with an offset, for example 2026-10-10T16:00:00+11:00."),
    ],
    ends_at: Annotated[AwareDatetime, Field(description="End time with an offset.")],
    location: Annotated[str, Field(min_length=1, max_length=200, description="Where it is.")],
    capacity: Annotated[int, Field(ge=1, le=100, description="Most players who can book.")],
    confirm: Annotated[
        bool,
        Field(description="Only set to true after the coach has seen the preview and said yes."),
    ] = False,
) -> str:
    """Create a new training session in one of the coach's programs.

    This changes data, so it works in two steps. First call it without confirm to get a
    preview, show that to the coach and ask them to confirm. Only call it again with
    confirm=true if they say yes. Never set confirm=true on the first call.
    Sydney is UTC+10, or UTC+11 during daylight saving (October to April).
    """
    if ends_at <= starts_at:
        raise ToolError("The session must end after it starts.")
    if starts_at <= datetime.now(UTC):
        raise ToolError("The session must start in the future.")
    location = location.strip()
    if not location:
        raise ToolError("Location can't be empty.")

    programs = {program["id"]: program for program in await list_programs()}
    program = programs.get(str(program_id))
    if program is None:
        raise ToolError("That program doesn't exist or isn't one of yours. Use list_programs.")

    summary = (
        f"{program['name']}, {starts_at.isoformat()} to {ends_at.isoformat()}, "
        f"at {location}, for up to {capacity} players"
    )
    if not confirm:
        return f"Not created yet. Preview: {summary}. Ask the coach to confirm first."

    body = {
        "program_id": str(program_id),
        "starts_at": starts_at.isoformat(),
        "ends_at": ends_at.isoformat(),
        "location": location,
        "capacity": capacity,
    }
    try:
        session = await api().post("/sessions", body)
    except ApiError as exc:
        raise ToolError(str(exc)) from exc
    logger.info("Created session %s", session["id"])
    return f"Created session {session['id']}: {summary}."


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    mcp.run(transport="stdio")
