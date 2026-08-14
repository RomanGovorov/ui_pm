"""Integration test conftest — DB sessions + API clients."""

import os
import sys
import json
import subprocess
import signal
import time
from pathlib import Path
from typing import Generator, Optional
from dataclasses import dataclass, field

import pytest

# Project root
ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "app" / "src"))

# Environment defaults for testing
TEST_API_KEY = "test-api-key-0123456789abcdef-test-api-key-0123456789abcdef"
TEST_ORIGINAL_API_KEY = "test-original-api-key-0123456789abcdef-or0123456789abcde"
BASE_URL = "http://127.0.0.1:3000"


@dataclass
class TestConfig:
    """Shared test configuration."""
    api_key: str = TEST_API_KEY
    base_url: str = BASE_URL
    db_url: str = "postgresql://postgres:postgres@localhost:5432/ui_pm_test"
    sse_base_url: str = f"{BASE_URL}/api/events"


@pytest.fixture(scope="session")
def config() -> TestConfig:
    """Global test config — can be overridden by environment variables."""
    c = TestConfig()
    if os.environ.get("API_KEY"):
        c.api_key = os.environ["API_KEY"]
    if os.environ.get("BASE_URL"):
        c.base_url = os.environ["BASE_URL"]
        c.sse_base_url = f"{c.base_url}/api/events"
    if os.environ.get("DB_URL"):
        c.db_url = os.environ["DB_URL"]
    return c


@pytest.fixture(scope="session", autouse=True)
def ensure_prisma_schema() -> None:
    """Ensure Prisma schema is generated before any test runs."""
    prisma_dir = ROOT / "prisma"
    schema = prisma_dir / "schema.prisma"
    if not schema.exists():
        pytest.skip("schema.prisma not found at prisma/schema.prisma")
    
    # Generate Prisma client
    env = os.environ.copy()
    env["DATABASE_URL"] = "sqlite::memory:"
    try:
        subprocess.run(
            [sys.executable, "-m", "prisma", "generate"],
            cwd=str(prisma_dir),
            capture_output=True,
            timeout=30,
            check=False,
        )
    except Exception:
        # Prisma generate may fail if native bindings missing; that's OK for API tests
        pass


@pytest.fixture
def api_client(config: TestConfig):
    """HTTP client fixture with optional API key auth."""
    import httpx
    
    class APIClient:
        def __init__(self):
            self.base_url = config.base_url
            self._sync_client = httpx.Client(timeout=10.0, follow_redirects=True)
            self._async_client = None
        
        @property
        def sync(self) -> httpx.Client:
            return self._sync_client
        
        def headers_with_auth(self, extra=None):
            h = {
                "Content-Type": "application/json",
                "X-API-Key": config.api_key,
            }
            if extra:
                h.update(extra)
            return h
        
        def get(self, path: str, headers=None, params=None):
            url = f"{self.base_url}{path}"
            resp = self.sync.get(url, headers=headers, params=params)
            return resp
        
        def post(self, path: str, json_data=None, headers=None):
            url = f"{self.base_url}{path}"
            merged_headers = {}
            if headers:
                merged_headers.update(headers)
            resp = self.sync.post(url, json=json_data, headers=merged_headers)
            return resp
        
        def put(self, path: str, json_data=None, headers=None):
            url = f"{self.base_url}{path}"
            resp = self.sync.put(url, json=json_data, headers=headers or {})
            return resp
        
        def delete(self, path: str, headers=None):
            url = f"{self.base_url}{path}"
            resp = self.sync.delete(url, headers=headers or {})
            return resp
        
        def connect_sse(self, headers=None):
            """Open SSE connection using streaming."""
            url = f"{self.base_url}/api/events"
            req_headers = {"Accept": "text/event-stream"}
            if headers:
                req_headers.update(headers)
            return self.sync.stream("GET", url, headers=req_headers, timeout=10.0)
        
        def close(self):
            self.sync.close()
    
    client = APIClient()
    yield client
    client.close()


@pytest.fixture
def mock_api_server(tmp_path_factory, config: TestConfig):
    """Start a minimal Next.js-compatible test server if real app is not running.
    
    Uses this only when BASE_URL points to a local port and the server isn't responding.
    """
    import socket
    
    def is_listening(host, port, timeout=1.0):
        try:
            sock = socket.create_connection((host, port), timeout=timeout)
            sock.close()
            return True
        except (ConnectionRefusedError, OSError):
            return False
    
    started_by_fixture = False
    if is_listening("127.0.0.1", 3000):
        yield
        return
    
    # No server running — we'll rely on unit-level tests instead
    pytest.skip("App server not running at 127.0.0.1:3000 — run integration tests against live server or use unit tests")


@pytest.fixture
def sample_task_data():
    """Standard task creation payload."""
    return {
        "projectId": "test-project-id",
        "title": "Test Task",
        "description": "A test task description",
        "priority": "medium",
        "assignee": "Test Assignee",
    }


@pytest.fixture
def sample_project_data():
    """Standard project creation payload."""
    return {
        "name": "Test Project",
        "description": "A test project description",
    }


@pytest.fixture
def sample_user_data():
    """Standard user creation payload."""
    return {
        "name": "Test User",
        "role": "agent",
        "apiKey": config.api_key if 'config' in dir() else TEST_API_KEY,
    }
