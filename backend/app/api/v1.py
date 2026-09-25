"""Collects every version 1 router. Mounted at /api/v1 in app.main."""

from fastapi import APIRouter

from app.health.router import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
