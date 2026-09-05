from pydantic import BaseModel, ConfigDict, Field


class ZoomMeetingCreate(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    start_at: str = Field(description="ISO-8601 start time, e.g. 2026-09-05T12:00:00Z")
    duration_minutes: int = Field(default=60, ge=1, le=1440)


class ZoomMeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    meeting_id: str
    join_url: str
    start_url: str
    password: str = ""
    topic: str


class ZoomStatusOut(BaseModel):
    configured: bool


class ZoomMeetingStatusOut(BaseModel):
    meeting_id: str
    status: str
