from __future__ import annotations

import httpx

from app.config import Settings


class CallbackClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def send(self, callback_url: str, payload: dict) -> httpx.Response:
        headers: dict[str, str] = {}
        if self.settings.nest_callback_auth_token:
            headers["Authorization"] = f"Bearer {self.settings.nest_callback_auth_token}"

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(callback_url, json=payload, headers=headers)
            response.raise_for_status()
            return response
