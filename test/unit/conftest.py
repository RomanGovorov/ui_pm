"""Unit test conftest — shared mocks and utilities."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

ROOT = Path(__file__).resolve().parent.parent.parent


@pytest.fixture(autouse=True)
def reset_env():
    """Reset environment variables between tests to avoid cross-test pollution."""
    from unittest.mock import patch
    import os
    
    preserved = {}
    sensitive_vars = ["API_KEY", "API_KEY_SECONDARY", "DATABASE_URL", "CORS_ALLOWED_ORIGINS"]
    for v in sensitive_vars:
        if v in os.environ:
            preserved[v] = os.environ[v]
    
    yield
    
    # Restore original values
    for k, v in preserved.items():
        os.environ[k] = v


@pytest.fixture
def mock_prisma():
    """Create a mock Prisma client for unit tests."""
    mock = MagicMock()
    
    # Mock findMany for all models
    mock.project.findMany = AsyncMock(return_value=[])
    mock.task.findMany = AsyncMock(return_value=[])
    mock.user.findMany = AsyncMock(return_value=[])
    mock.project.create = AsyncMock(side_effect=lambda **kwargs: kwargs.get("data", {}))
    mock.task.create = AsyncMock(side_effect=lambda **kwargs: {**kwargs.get("data", {}), "id": "mock-id"})
    mock.task.update = AsyncMock(side_effect=lambda **kwargs: {**kwargs.get("data", {}), "id": kwargs.get("where", {}).get("id", "mock-id")})
    mock.task.delete = AsyncMock(side_effect=lambda **kwargs: {"id": kwargs.get("where", {}).get("id", "mock-id")})
    mock.project.update = AsyncMock(side_effect=lambda **kwargs: {**kwargs.get("data", {}), "id": kwargs.get("where", {}).get("id", "mock-id")})
    mock.project.delete = AsyncMock(side_effect=lambda **kwargs: {"id": kwargs.get("where", {}).get("id", "mock-id")})
    mock.project.findUnique = AsyncMock(return_value=None)
    mock.user.create = AsyncMock(side_effect=lambda **kwargs: {**kwargs.get("data", {}), "id": "mock-user-id"})
    
    return mock


@pytest.fixture
def mock_event_bus():
    """Mock event bus for SSE testing."""
    mock = MagicMock()
    mock.emitTaskEvent = MagicMock()
    mock.emitProjectEvent = MagicMock()
    mock.on = MagicMock()
    mock.off = MagicMock()
    mock.canAcceptConnection = MagicMock(return_value=True)
    mock.registerConnection = MagicMock()
    mock.unregisterConnection = MagicMock()
    mock.getConnectionCount = MagicMock(return_value=0)
    return mock


@pytest.fixture
def valid_api_key():
    """Return a valid API key string matching the expected format."""
    import os
    return os.environ.get("API_KEY", "test-key-0123456789abcdef-xxxxxxxxxxxxxxx")


@pytest.fixture
def sample_project():
    """Standard project data for service tests."""
    return {
        "id": "proj-test-001",
        "name": "Test Project",
        "description": "A test project",
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z",
        "_count": {"tasks": 3},
    }


@pytest.fixture
def sample_task():
    """Standard task data for service tests."""
    return {
        "id": "task-test-001",
        "projectId": "proj-test-001",
        "subprojectId": None,
        "title": "Test Task",
        "description": "Task description",
        "status": "in_work",
        "priority": "medium",
        "assignee": "John Doe",
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z",
    }
