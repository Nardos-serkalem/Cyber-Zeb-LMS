"""Zoom Server-to-Server OAuth client (Account ID + Client ID + Client Secret)."""
from __future__ import annotations

import base64
import json
import time
from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import ValidationAppError

_TOKEN_URL = "https://zoom.us/oauth/token"
_API_BASE = "https://api.zoom.us/v2"

_cached_token: str | None = None
_cached_expiry: float = 0.0

_CREATE_MEETING_SCOPES = ("meeting:write:meeting", "meeting:write:meeting:admin")
_SCOPE_HELP = (
    "Zoom credentials work, but the Server-to-Server app is missing meeting-write scopes. "
    "In marketplace.zoom.us open the app → Scopes → add "
    "'Create a meeting for a user' (meeting:write:meeting:admin). "
    "Also add 'View all user information' (user:read:list_users:admin) unless ZOOM_USER_EMAIL is set. "
    "Then open Activation and activate the app again. After that, retry scheduling."
)


def zoom_configured() -> bool:
    return bool(settings.ZOOM_ACCOUNT_ID and settings.ZOOM_CLIENT_ID and settings.ZOOM_CLIENT_SECRET)


def _clear_token_cache() -> None:
    global _cached_token, _cached_expiry
    _cached_token = None
    _cached_expiry = 0.0


def _token_scopes(token: str) -> list[str]:
    try:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        raw = payload.get("scope") or payload.get("scp") or ""
        if isinstance(raw, list):
            return [str(item) for item in raw if item]
        return [item for item in str(raw).replace(",", " ").split() if item]
    except Exception:
        return []


def _has_create_meeting_scope(token: str) -> bool:
    scopes = set(_token_scopes(token))
    if not scopes:
        return True
    return bool(scopes.intersection(_CREATE_MEETING_SCOPES))


def _zoom_error_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except Exception:
        payload = {}
    code = payload.get("code")
    message = str(payload.get("message") or response.text[:400])
    if code == 4711 or "does not contain scopes" in message:
        return _SCOPE_HELP
    return f"Zoom could not create the meeting ({response.status_code}): {message}"


def _require_configured() -> None:
    if not zoom_configured():
        raise ValidationAppError(
            "Zoom is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET."
        )


async def get_access_token() -> str:
    global _cached_token, _cached_expiry
    _require_configured()
    now = time.time()
    if _cached_token and now < _cached_expiry - 60:
        return _cached_token

    basic = base64.b64encode(
        f"{settings.ZOOM_CLIENT_ID}:{settings.ZOOM_CLIENT_SECRET}".encode()
    ).decode()
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            _TOKEN_URL,
            params={
                "grant_type": "account_credentials",
                "account_id": settings.ZOOM_ACCOUNT_ID,
            },
            headers={
                "Authorization": f"Basic {basic}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
    if response.status_code >= 400:
        _clear_token_cache()
        detail = response.text[:300]
        raise ValidationAppError(f"Zoom authentication failed ({response.status_code}): {detail}")

    payload = response.json()
    token = payload.get("access_token")
    if not token:
        raise ValidationAppError("Zoom authentication failed: no access token returned.")
    _cached_token = token
    _cached_expiry = now + int(payload.get("expires_in") or 3600)
    return token


async def _host_user_id(token: str) -> str:
    if settings.ZOOM_USER_EMAIL.strip():
        return settings.ZOOM_USER_EMAIL.strip()

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            f"{_API_BASE}/users",
            params={"status": "active", "page_size": 10},
            headers={"Authorization": f"Bearer {token}"},
        )
    if response.status_code >= 400:
        raise ValidationAppError(
            f"Could not list Zoom users ({response.status_code}). "
            "Grant user:read:list_users:admin, or set ZOOM_USER_EMAIL."
        )
    users = (response.json() or {}).get("users") or []
    if not users:
        raise ValidationAppError("No active Zoom users found on this account.")
    return str(users[0].get("id") or users[0].get("email"))


async def create_meeting(*, topic: str, start_time_iso: str, duration_minutes: int) -> dict[str, Any]:
    token = await get_access_token()
    if not _has_create_meeting_scope(token):
        raise ValidationAppError(_SCOPE_HELP)
    host = await _host_user_id(token)
    start_time = start_time_iso.replace("+00:00", "Z")
    if start_time.endswith(".000Z"):
        start_time = start_time.replace(".000Z", "Z")

    body = {
        "topic": topic[:200],
        "type": 2,
        "start_time": start_time,
        "duration": max(1, int(duration_minutes)),
        "timezone": "UTC",
        "settings": {
            "join_before_host": True,
            "waiting_room": False,
            "mute_upon_entry": True,
            "approval_type": 2,
        },
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{_API_BASE}/users/{host}/meetings",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=body,
        )
    if response.status_code >= 400:
        _clear_token_cache()
        raise ValidationAppError(_zoom_error_message(response))

    data = response.json()
    join_url = data.get("join_url")
    if not join_url:
        raise ValidationAppError("Zoom created a meeting but did not return a join URL.")
    return {
        "meeting_id": str(data.get("id", "")),
        "join_url": join_url,
        "start_url": data.get("start_url") or join_url,
        "password": data.get("password") or "",
        "topic": data.get("topic") or topic,
    }


def _normalize_meeting_status(raw: str) -> str:
    value = (raw or "").strip().lower()
    if value in {"waiting", "started", "finished"}:
        return value
    return "unknown"


async def get_meeting_status(meeting_id: str) -> dict[str, str]:
    token = await get_access_token()
    meeting_id = meeting_id.strip()
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            f"{_API_BASE}/meetings/{meeting_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code in {404, 400}:
            past = await client.get(
                f"{_API_BASE}/past_meetings/{meeting_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if past.status_code < 400 or past.status_code == 404:
                return {"meeting_id": meeting_id, "status": "finished"}
        if response.status_code >= 400:
            raise ValidationAppError(_zoom_error_message(response))
    return {
        "meeting_id": meeting_id,
        "status": _normalize_meeting_status(str((response.json() or {}).get("status") or "")),
    }


async def end_meeting(meeting_id: str) -> dict[str, str]:
    token = await get_access_token()
    meeting_id = meeting_id.strip()
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.put(
            f"{_API_BASE}/meetings/{meeting_id}/status",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"action": "end"},
        )
    # 404 / already ended still means the LMS session should leave On air.
    if response.status_code >= 400 and response.status_code not in {404, 400}:
        try:
            payload = response.json()
        except Exception:
            payload = {}
        code = payload.get("code")
        if code not in {3001, 3002}:
            raise ValidationAppError(_zoom_error_message(response))
    return {"meeting_id": meeting_id, "status": "finished"}
