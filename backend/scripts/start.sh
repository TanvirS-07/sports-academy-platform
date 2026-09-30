#!/bin/sh
# Starts the backend in the prod image: runs migrations, then uvicorn.
#
# The host sets PORT (Render uses 10000). It falls back to 8000 like local development.
#
# The app runs behind the host's proxy (and Vercel's in front of that), and we can't
# list their IP addresses, so every proxy is trusted for X-Forwarded-For. That lets
# the per-IP login limit see real addresses, but a client can fake the header. The
# per-email limit isn't affected.
set -e

alembic upgrade head

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --proxy-headers \
    --forwarded-allow-ips "*"
