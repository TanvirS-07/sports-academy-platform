# MCP server

An MCP (Model Context Protocol) server for the academy API. It lets an AI assistant answer questions like "which of my sessions next week still have spots left?" and add a session, acting as one coach.

It only talks to the local API from Docker Compose, with the made-up seed data. It refuses any API address that isn't localhost, so it can't be pointed at the live demo by mistake.

## Tools

| Tool | What it does | API call |
|---|---|---|
| `list_programs` | The coach's programs, with their ids | `GET /programs` |
| `list_sessions` | The coach's upcoming sessions (or past ones too), optionally for one program | `GET /sessions` |
| `check_availability` | Spots left in one session, and whether it can still be booked | `GET /sessions/{id}` |
| `create_session` | Adds a session to one of the coach's programs | `POST /sessions` |

The tools call the REST API instead of the database, so the API's login, role and ownership checks still apply. The server logs in with a coach's email and password and only sees what that coach sees in the app.

`create_session` is the only one that changes data. It works in two steps: called without `confirm` it only returns a preview, and the description tells the model to show that to the coach and only call again with `confirm=true` once they say yes. The three read tools are marked read-only in their tool annotations.

## Running it

You need the local stack running with the demo data:

```bash
docker compose up --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m scripts.seed_demo
```

Then install the server's dependencies:

```bash
cd mcp_server
uv sync
```

The login comes from environment variables, never from the code:

| Variable | Default |
|---|---|
| `ACADEMY_EMAIL` | none, use `coach@example.com` for the demo data |
| `ACADEMY_PASSWORD` | none, use `demo-password` for the demo data |
| `ACADEMY_API_URL` | `http://localhost:8000/api/v1` |

### Trying the tools in the MCP Inspector

```bash
npx @modelcontextprotocol/inspector env ACADEMY_EMAIL=coach@example.com ACADEMY_PASSWORD=demo-password uv run server.py
```

This opens the Inspector in the browser, where you can list the tools, see their input schemas and call them. Add `--cli` after `inspector` to use it from the terminal instead.

Windows doesn't have `env`, and the Inspector doesn't pass PowerShell variables on to the server. Put the login in a config file instead (this one goes in your home folder, outside the repo):

```powershell
@'
{"mcpServers":{"academy":{"command":"uv","args":["run","server.py"],"env":{"ACADEMY_EMAIL":"coach@example.com","ACADEMY_PASSWORD":"demo-password"}}}}
'@ | Set-Content "$HOME\academy-mcp.json"
npx @modelcontextprotocol/inspector --config "$HOME\academy-mcp.json" --server academy
```

### Adding it to Claude Code

From the repo root:

```bash
claude mcp add academy -e ACADEMY_EMAIL=coach@example.com -e ACADEMY_PASSWORD=demo-password -- uv run --directory "$(pwd)/mcp_server" server.py
```

Then ask things like "which of my sessions next week still have spots left?" or "add a Junior Batting session next Wednesday 4pm to 5:30pm at Nets 3 for 8 players".

## Presenting it locally

### On the computer I've already set up

1. Start Docker Desktop, then in the repo root run `docker compose up -d`.
2. Run `claude` in the repo root. The `academy` server is already added, so it starts by itself. `claude mcp list` should show it as connected.
3. Log in to http://localhost:5173 as `coach@example.com` (password `demo-password`) so the site is open next to Claude.
4. Run through it:
   - Ask "which of my sessions next week still have spots left?"
   - Ask it to add a session. It shows a preview first, so say yes and refresh the calendar to show the new session.
5. When I'm done, `docker compose down` in the repo root. Adding `-v` also wipes the local data, and then it needs seeding again.

If the sessions list is empty or the dates have gone stale, run `docker compose exec backend python -m scripts.seed_demo --reset`. The seed puts sessions around today's date, so it's worth doing it the day before.

### On a new computer

Needs Git, Docker Desktop, [uv](https://docs.astral.sh/uv/) and Claude Code. Node 22.19 or newer is only needed for the Inspector.

1. Clone the repo and open a terminal in its root.
2. Start the stack and add the demo data (use `--reset` on the last one if it says the database already has users):
   ```bash
   docker compose up --build -d
   docker compose exec backend alembic upgrade head
   docker compose exec backend python -m scripts.seed_demo
   ```
3. Install the server's dependencies. This also downloads Python 3.12.14:
   ```bash
   cd mcp_server
   uv sync
   cd ..
   ```
4. Add the server to Claude Code, still in the repo root. It's saved for the folder you run it in, so always start `claude` from the repo root:
   ```bash
   claude mcp add academy -e ACADEMY_EMAIL=coach@example.com -e ACADEMY_PASSWORD=demo-password -- uv run --directory "$(pwd)/mcp_server" server.py
   ```
   In PowerShell, use `"$PWD\mcp_server"` instead of `"$(pwd)/mcp_server"`.
5. Run `claude mcp list` to check it's connected, then follow the steps above.

## Tests

```bash
uv run pytest
uv run ruff check .
```

The tests use a fake API, so they don't need the stack running.

## Things to know

- It runs over stdio, so the client starts it as a child process. Nothing in it can `print()`, because stdout carries the protocol messages. Logs go to stderr.
- Times go in and out with a UTC offset, like the API. The descriptions tell the model the academy is in Sydney so it converts them.
- Program names and locations come back from the API as they were typed in. If someone typed instructions into a location, the model would read them like any other text, so the data the tools return shouldn't be trusted as instructions. The confirm step on `create_session` is there partly for this.
- It only works as one coach, set by the environment variables. Running it for real users would mean Streamable HTTP and a proper login for each person, which this doesn't have.
