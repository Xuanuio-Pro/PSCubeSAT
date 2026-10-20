"""Public API entrypoint."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "CubeSat Ground Station API v2.0", "docs": "/docs", "ws": "/ws"}
