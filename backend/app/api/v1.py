"""Collects every version 1 router. Mounted at /api/v1 in app.main."""

from fastapi import APIRouter

from app.auth.router import router as auth_router
from app.health.router import router as health_router
from app.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
