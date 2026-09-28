"""Collects every version 1 router. Mounted at /api/v1 in app.main."""

from fastapi import APIRouter

from app.auth.router import router as auth_router
from app.bookings.router import router as bookings_router
from app.health.router import router as health_router
from app.players.router import router as players_router
from app.programs.router import router as programs_router
from app.sessions.router import router as sessions_router
from app.sports.router import router as sports_router
from app.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(players_router)
api_router.include_router(sports_router)
api_router.include_router(programs_router)
api_router.include_router(sessions_router)
api_router.include_router(bookings_router)
