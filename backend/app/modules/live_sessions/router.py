"""Zoom live-session endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.live_sessions.schemas import (
    ZoomMeetingCreate,
    ZoomMeetingOut,
    ZoomMeetingStatusOut,
    ZoomStatusOut,
)
from app.modules.live_sessions.service import LiveSessionsService

router = APIRouter()


@router.get("/zoom/status", response_model=ZoomStatusOut)
async def zoom_status():
    return LiveSessionsService.status()


@router.post("/zoom/meetings", response_model=ZoomMeetingOut)
async def create_zoom_meeting(
    payload: ZoomMeetingCreate,
    db: AsyncSession = Depends(get_db),
):
    return await LiveSessionsService(db).create_zoom_meeting(payload)


@router.get("/zoom/meetings/{meeting_id}", response_model=ZoomMeetingStatusOut)
async def zoom_meeting_status(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await LiveSessionsService(db).zoom_meeting_status(meeting_id)


@router.post("/zoom/meetings/{meeting_id}/end", response_model=ZoomMeetingStatusOut)
async def end_zoom_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await LiveSessionsService(db).end_zoom_meeting(meeting_id)
