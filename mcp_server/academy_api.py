"""Small client for the academy REST API, used by the MCP tools.

The tools go through the API rather than the database, so the same login, role and
ownership checks apply. The server logs in as one coach and only sees what that coach
would see in the app.
"""

import os
from typing import Any
from urllib.parse import urlparse

import httpx2

DEFAULT_API_URL = "http://localhost:8000/api/v1"

# Only the local Docker Compose API. This server is for local testing with seed data,
# so it refuses to talk to the live demo or anything else on the internet.
LOCAL_HOSTS = {"localhost", "127.0.0.1"}


class ApiError(Exception):
    """An error from the API, with the message from its error response."""


class AcademyApi:
    def __init__(
        self,
        base_url: str,
        email: str,
        password: str,
        transport: httpx2.AsyncBaseTransport | None = None,
    ) -> None:
        host = urlparse(base_url).hostname
        if host not in LOCAL_HOSTS:
            raise ValueError(f"ACADEMY_API_URL must point at localhost, not {host}")
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.token: str | None = None
        # Only set by the tests, to answer requests without a running API.
        self.transport = transport

    @classmethod
    def from_env(cls) -> "AcademyApi":
        email = os.environ.get("ACADEMY_EMAIL")
        password = os.environ.get("ACADEMY_PASSWORD")
        if not email or not password:
            raise ValueError("Set ACADEMY_EMAIL and ACADEMY_PASSWORD to a local coach account")
        return cls(os.environ.get("ACADEMY_API_URL", DEFAULT_API_URL), email, password)

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return await self._request("GET", path, params=params)

    async def post(self, path: str, body: dict[str, Any]) -> Any:
        return await self._request("POST", path, json=body)

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        async with httpx2.AsyncClient(
            base_url=self.base_url, timeout=10, transport=self.transport
        ) as client:
            if self.token is None:
                await self._login(client)
            response = await client.request(method, path, headers=self._auth(), **kwargs)

            # Access tokens only last 15 minutes, so log in again once and retry.
            if response.status_code == 401:
                await self._login(client)
                response = await client.request(method, path, headers=self._auth(), **kwargs)

            if response.is_error:
                raise ApiError(_error_message(response))
            return response.json()

    async def _login(self, client: httpx2.AsyncClient) -> None:
        response = await client.post(
            "/auth/login", json={"email": self.email, "password": self.password}
        )
        if response.is_error:
            raise ApiError(f"Couldn't log in to the academy API: {_error_message(response)}")
        self.token = response.json()["access_token"]

    def _auth(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


def _error_message(response: httpx2.Response) -> str:
    try:
        return response.json()["error"]["message"]
    except (ValueError, KeyError, TypeError):
        return f"API returned {response.status_code}"
