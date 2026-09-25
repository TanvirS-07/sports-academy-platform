# syntax=docker/dockerfile:1

# ---------- base: pinned Node LTS ----------
FROM node:24.21.0-bookworm-slim AS base
WORKDIR /app

# ---------- dev: Vite dev server, source is bind-mounted by docker compose ----------
FROM base AS dev
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------- build: static production bundle in /app/dist ----------
# The static files in /app/dist will be deployed in Phase 7 (hosting not decided yet).
FROM base AS build
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build
