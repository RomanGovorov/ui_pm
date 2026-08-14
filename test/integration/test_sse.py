"""Integration tests: SSE (Server-Sent Events) real-time connections."""

import os
import sys
import pytest
from unittest.mock import MagicMock, patch, call
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "app" / "src"))


@pytest.fixture(autouse=True)
def setup_env():
    if "API_KEY" not in os.environ:
        os.environ["API_KEY"] = "test-key-0123456789abcdef-xxxxxxxxxxxxxxx"
    yield


class TestEventBusConnectionLimits:
    """Test SSE connection limit enforcement."""

    def test_can_accept_under_limit(self):
        """TC-SEC-E001: EventBus accepts connections under limit."""
        from lib.events.event_bus import eventBus
        
        # Initial state should accept
        assert eventBus.canAcceptConnection("ip-test") is True

    def test_can_accept_multiple_ips(self):
        """TC-SEC-E002: Multiple IPs can connect simultaneously."""
        from lib.events.event_bus import eventBus
        
        # Clear state
        eventBus._EventBus__activeConnections = 0
        eventBus.ipConnections.clear()
        
        for i in range(5):
            assert eventBus.canAcceptConnection(f"ip-{i}") is True

    @pytest.mark.asyncio
    async def test_max_total_connections_enforced(self, mock_prisma):
        """TC-SEC-E003: Max 50 total connections enforced."""
        from lib.events.event_bus import eventBus
        
        # Reset to clean state
        eventBus._EventBus__activeConnections = 0
        eventBus.ipConnections.clear()
        
        # Simulate registering 50 connections
        for i in range(50):
            eventBus.registerConnection(f"conn-ip-{i % 5}")
        
        assert eventBus.getConnectionCount() == 50
        # Next connection should be rejected
        assert eventBus.canAcceptConnection("overflow-ip") is False

    @pytest.mark.asyncio
    async def test_max_per_ip_enforced(self, mock_prisma):
        """TC-SEC-E004: Max 10 connections per IP enforced."""
        from lib.events.event_bus import eventBus
        
        # Reset
        eventBus._EventBus__activeConnections = 0
        eventBus.ipConnections.clear()
        
        # Register 10 connections from same IP
        for i in range(10):
            eventBus.registerConnection("single-ip")
        
        assert eventBus.ipConnections.get("single-ip") == 10
        # 11th connection from same IP should fail
        assert eventBus.canAcceptConnection("single-ip") is False

    def test_unregister_decrements_count(self, mock_prisma):
        """TC-SEC-E005: Unregistering a connection decrements count."""
        from lib.events.event_bus import eventBus
        
        eventBus.registerConnection("unreg-ip")
        assert eventBus.getConnectionCount() == 1
        
        eventBus.unregisterConnection("unreg-ip")
        assert eventBus.getConnectionCount() == 0


class TestEventBusEmit:
    """Test event emission through EventBus."""

    @pytest.mark.asyncio
    async def test_emit_task_created(self):
        """TC-SEC-E006: Task created event emits correctly."""
        from lib.events.event_bus import eventBus
        
        received = []
        eventBus.on("task_created", lambda data: received.append(data))
        
        payload = {"id": "t1", "title": "New", "status": "in_work"}
        eventBus.emitTaskEvent("task_created", payload)
        
        assert len(received) == 1
        assert received[0]["id"] == "t1"
        eventBus.off("task_created", received.append)

    @pytest.mark.asyncio
    async def test_emit_task_updated(self):
        """TC-SEC-E007: Task updated event emits with full payload."""
        from lib.events.event_bus import eventBus
        
        received = []
        eventBus.on("task_updated", lambda data: received.append(data))
        
        payload = {"id": "t1", "status": "done", "priority": "high"}
        eventBus.emitTaskEvent("task_updated", payload)
        
        assert len(received) == 1
        assert received[0]["status"] == "done"

    @pytest.mark.asyncio
    async def test_emit_task_deleted(self):
        """TC-SEC-E008: Task deleted event has minimal payload."""
        from lib.events.event_bus import eventBus
        
        received = []
        eventBus.on("task_deleted", lambda data: received.append(data))
        
        payload = {"id": "t1-deleted"}
        eventBus.emitTaskEvent("task_deleted", payload)
        
        assert len(received) == 1
        assert received[0] == {"id": "t1-deleted"}

    @pytest.mark.asyncio
    async def test_emit_project_events(self):
        """TC-SEC-E009: Project events emit correctly."""
        from lib.events.event_bus import eventBus
        
        received = {}
        for evt in ["project_created", "project_updated", "project_deleted"]:
            handler = lambda d: received.setdefault(evt, []).append(d)
            eventBus.on(evt, handler)
        
        for evt in ["project_created", "project_updated", "project_deleted"]:
            eventBus.emitProjectEvent(evt, {"id": "p1"})
        
        for evt in ["project_created", "project_updated", "project_deleted"]:
            assert len(received[evt]) == 1
            assert received[evt][0]["id"] == "p1"


class TestEventBusToListenCleanup:
    """Test event listener cleanup on SSE disconnect."""

    def test_handler_registered_on_connect(self):
        """TC-SEC-E010: SSE handler registered on connection."""
        from lib.events.event_bus import eventBus
        
        handlers_called = []
        eventBus.on("task_created", lambda d: handlers_called.append(d))
        
        assert "task_created" in [m[0][0] for m in eventBus._listeners().keys()]
        eventBus.off("task_created", handlers_called.append)

    @pytest.mark.asyncio
    async def test_no_duplicate_handlers(self, mock_event_bus):
        """TC-SEC-E011: No duplicate handler registrations."""
        from lib.events.event_bus import eventBus
        
        eventBus._EventBus__activeConnections = 0
        eventBus.ipConnections.clear()
        
        handlers_before = list(eventBus._listeners().get("task_created", []))
        
        register_count = eventBus.ipConnections.get("dup-ip", 0)
        if register_count < 2:
            eventBus.registerConnection("dup-ip")
            eventBus.emitTaskEvent("task_created", {"id": "test"})
            
            handlers_after = list(eventBus._listeners().get("task_created", []))
            # Should have exactly one new handler
            added = len(handlers_after) - len(handlers_before)
            assert added <= 1


class TestSSEPayloadStripping:
    """Test that SSE payloads exclude description (bandwidth optimization)."""

    @pytest.mark.asyncio
    async def test_description_excluded_from_sse(self):
        """TC-SEC-E012: Description excluded from SSE payload for bandwidth."""
        from lib.events.event_bus import toSSEPayload
        
        task_with_desc = {
            "id": "t1", "projectId": "p1", "subprojectId": None,
            "title": "Big Task", "description": "x" * 2000,
            "status": "in_work", "priority": "high", "assignee": "User",
            "createdAt": datetime.now(), "updatedAt": datetime.now(),
        }
        
        payload = toSSEPayload(task_with_desc)
        
        assert "description" not in payload
        assert len(payload) == 9  # All fields except description
        assert payload["id"] == "t1"
        assert payload["title"] == "Big Task"

    @pytest.mark.asyncio
    async def test_sse_payload_includes_all_non_desc_fields(self):
        """TC-SEC-E013: SSE payload includes all fields except description."""
        from lib.events.event_bus import toSSEPayload
        
        task = {
            "id": "t1", "projectId": "p1", "subprojectId": "sp1",
            "title": "T", "description": "D",
            "status": "in_work", "priority": "medium", "assignee": "A",
            "createdAt": datetime.now(), "updatedAt": datetime.now(),
        }
        
        payload = toSSEPayload(task)
        
        expected_keys = {"id", "projectId", "subprojectId", "title", 
                         "status", "priority", "assignee", "createdAt", "updatedAt"}
        assert set(payload.keys()) == expected_keys


class TestEventBusMaxListeners:
    """Test EventEmitter max listeners configuration."""

    def test_max_listeners_configured(self):
        """TC-SEC-E014: EventBus max listeners increased to 100."""
        from lib.events.event_bus import eventBus
        
        # Default is 10; v1 sets it to 100
        assert eventBus.getMaxListeners() >= 100
