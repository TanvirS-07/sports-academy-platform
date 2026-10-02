import pytest


@pytest.fixture
def anyio_backend() -> str:
    # anyio's pytest plugin runs the async tests. Only asyncio, not trio as well.
    return "asyncio"
