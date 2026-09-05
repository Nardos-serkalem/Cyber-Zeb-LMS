"""Virtual classroom — Zoom Server-to-Server meeting creation."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.live_sessions.schemas import (
    ZoomMeetingCreate,
    ZoomMeetingOut,
    ZoomMeetingStatusOut,
    ZoomStatusOut,
)
from app.modules.live_sessions.zoom_client import (
    create_meeting,
    end_meeting,
    get_meeting_status,
    zoom_configured,
)


class LiveSessionsService:
    def __init__(self, db: AsyncSession | None = None):
        self.db = db

    @staticmethod
    def status() -> ZoomStatusOut:
        return ZoomStatusOut(configured=zoom_configured())

    async def create_zoom_meeting(self, payload: ZoomMeetingCreate) -> ZoomMeetingOut:
        created = await create_meeting(
            topic=payload.topic.strip(),
            start_time_iso=payload.start_at.strip(),
            duration_minutes=payload.duration_minutes,
        )
        return ZoomMeetingOut(**created)

    async def zoom_meeting_status(self, meeting_id: str) -> ZoomMeetingStatusOut:
        return ZoomMeetingStatusOut(**await get_meeting_status(meeting_id))

    async def end_zoom_meeting(self, meeting_id: str) -> ZoomMeetingStatusOut:
        return ZoomMeetingStatusOut(**await end_meeting(meeting_id))
