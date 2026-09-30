# Deployment (live demo)

The live demo is at https://precisioncricket.vercel.app. It runs on free tiers, with made-up data only. Payments aren't part of it.

| Part | Host | Free tier (checked 2026-09-30) |
|---|---|---|
| Frontend | Vercel (Hobby) | Static site, 100 GB of transfer a month, non-commercial use only |
| Backend | Render (free web service) | 750 hours a month, sleeps after 15 minutes without traffic |
| Database | Neon (free) | Postgres 17, 0.5 GB, 100 compute hours a month, pauses after 5 idle minutes |

None of them need a card.

## How it fits together

The browser only talks to the Vercel site. `frontend/vercel.json` forwards every `/api/...` request to the Render backend, like the Vite dev server does locally, and sends every other path to `index.html` so refreshing on a page like `/calendar` works.

Because the frontend and the API look like one site to the browser, nothing about login changes: the refresh token cookie stays `SameSite=Strict` on `/api/v1/auth`, and CORS stays off. If the frontend called the Render URL directly, the cookie would count as a third-party cookie and a lot of browsers would drop it.

The backend runs the `prod` stage of `backend/Dockerfile`. On start, `backend/scripts/start.sh` runs `alembic upgrade head` and then uvicorn on the port Render gives it. Render's free tier has no separate step for migrations, so they run on every start. When there's nothing new they finish straight away.

## Setting it up

Do these in order, signing in to each site with GitHub.

### 1. Neon (database)

1. Create a project called `sports-academy`, with Postgres version 17 and a region close to the Render one (for example AWS US East if Render is in Virginia).
2. On the project dashboard, open "Connect" and copy the connection string with connection pooling turned off.
3. Change the start from `postgresql://` to `postgresql+psycopg://`. Keep `?sslmode=require` on the end. This is the `DATABASE_URL`.

### 2. Render (backend)

1. New, Web Service, pick this repository.
2. Name: `sports-academy-api`. Render builds the URL from the name and adds a few characters if it's taken (the live demo's is `https://sports-academy-api-0tfi.onrender.com`). The URL in `frontend/vercel.json` has to match it.
3. Language: Docker. Root directory: `backend`. Branch: `main`. Instance type: Free.
4. Environment variables:
   - `APP_ENV` = `production`
   - `DATABASE_URL` = the Neon URL from step 1
   - `JWT_SECRET` = a new value from `python -c "import secrets; print(secrets.token_urlsafe(48))"`
5. Health check path (under Advanced): `/api/v1/health`.
6. Create it. The first deploy runs the migrations on the empty Neon database.

Leave `CORS_ORIGINS` unset.

### 3. Demo data

Once the Render deploy is live, fill the database from your own machine. This uses the local backend image but points it at Neon:

```bash
docker compose run --rm --no-deps -e DATABASE_URL="<neon url>" backend python -m scripts.seed_demo
```

It makes 2 coaches, 8 parents, 18 players and 3 programs, with weekly sessions from two weeks ago to four weeks ahead, bookings, attendance and some development notes. The next Fielding and Fitness session is full, so that state shows up too. Everyone is made up and every email is on `example.com`. All the accounts use the password `demo-password`, for example `coach@example.com` and `parent@example.com`.

It won't run if the database already has users. To start again, for example after someone changes the demo passwords or when the sessions have all gone into the past:

```bash
docker compose run --rm --no-deps -e DATABASE_URL="<neon url>" backend python -m scripts.seed_demo --reset
```

`--reset` deletes everything first, so double-check the URL.

### 4. Vercel (frontend)

1. Add New, Project, pick this repository.
2. Root directory: `frontend`. The framework (Vite) and build settings come from `vercel.json`.
3. Environment variable: `VITE_DEMO` = `true`. This shows the demo accounts on the login page.
4. Deploy.

`vercel.json` installs with `--engine-strict=false`, because `package.json` asks for Node 24.21.0 or newer and Vercel's Node 24 might be a slightly older patch version.

## After it's up

- Pushes to `main` redeploy both the frontend and the backend.
- Vercel also builds a preview for each pull request. Previews use the same backend and database as the live demo.
- The `/status` page shows whether the frontend can reach the backend.

## Things to know

- The first visit after 15 quiet minutes waits about a minute while Render starts the backend again. The login page says so. A keep-alive ping would avoid that, but it would also keep Neon awake and use up its 100 compute hours in about two weeks.
- Anyone can log in with the demo accounts and change things. Running the seed script with `--reset` puts it back.
- Render and Vercel both sit in front of the backend and we can't list their IP addresses, so uvicorn trusts `X-Forwarded-For` from anyone. The per-IP login limit can be fooled by a faked header. The per-email limit still works.
- The login limits are kept in memory, so they reset whenever Render puts the backend to sleep.
- Free tiers change. Nothing here depends on these hosts in particular: it's a Docker image, a static build and a Postgres URL.
