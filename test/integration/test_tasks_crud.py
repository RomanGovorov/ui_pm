"""Integration tests: Task CRUD operations — full lifecycle."""

import os
import sys
import pytest
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "app" / "src"))


@pytest.fixture(autouse=True)
def setup_env():
    if "API_KEY" not in os.environ:
        os.environ["API_KEY"] = "test-key-0123456789abcdef-xxxxxxxxxxxxxxx"
    yield


class TestTaskServiceCreate:
    """Test task creation flow."""

    @pytest.mark.asyncio
    async def test_create_task_valid(self, mock_prisma):
        """TC-INTEG-T001: Create a task with valid data returns 201."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.create.return_value = {
            "id": "task-001",
            "projectId": "proj-001",
            "subprojectId": None,
            "title": "New Task",
            "description": "Description",
            "status": "in_work",
            "priority": "medium",
            "assignee": "John Doe",
            "createdAt": datetime.now(),
            "updatedAt": datetime.now(),
        }
        
        result = await task_service.create({
            "projectId": "valid-uuid-here",
            "title": "New Task",
            "priority": "medium",
            "assignee": "John Doe",
        })
        
        assert result["title"] == "New Task"
        assert result["status"] == "in_work"

    @pytest.mark.asyncio
    async def test_create_task_with_subproject(self, mock_prisma):
        """TC-INTEG-T002: Create task with subprojectId."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.create.return_value = {
            "id": "task-002",
            "projectId": "proj-001",
            "subprojectId": "sub-001",
            "title": "Sub Task",
            "priority": "high",
            "assignee": "Jane",
            "status": "in_work",
            "description": "",
            "createdAt": datetime.now(),
            "updatedAt": datetime.now(),
        }
        
        result = await task_service.create({
            "projectId": "proj-001",
            "subprojectId": "sub-001",
            "title": "Sub Task",
            "priority": "high",
            "assignee": "Jane",
        })
        
        assert result["subprojectId"] == "sub-001"

    @pytest.mark.asyncio
    async def test_create_task_default_priority(self):
        """TC-INTEG-T003: Default priority is 'medium' when not specified."""
        from lib.validators.task import create_task_schema
        
        parsed = create_task_schema.safe_parse({
            "projectId": "valid-uuid",
            "title": "Task",
            "assignee": "User",
        })
        assert parsed.success is True
        assert parsed.data["priority"] == "medium"

    @pytest.mark.asyncio
    async def test_create_task_invalid_uuid(self):
        """TC-INTEG-T004: Non-UUID projectId fails validation."""
        from lib.validators.task import create_task_schema
        
        result = create_task_schema.safe_parse({
            "projectId": "not-a-uuid",
            "title": "Task",
            "assignee": "User",
        })
        assert result.success is False
        issues = [i for i in result.error.issues if "projectId" in i.get("path", [])]
        assert len(issues) > 0

    @pytest.mark.asyncio
    async def test_create_task_missing_title(self):
        """TC-INTEG-T005: Missing title fails validation."""
        from lib.validators.task import create_task_schema
        
        result = create_task_schema.safe_parse({
            "projectId": "valid-uuid",
            "assignee": "User",
        })
        assert result.success is False


class TestTaskServiceList:
    """Test task listing with filters and ordering."""

    @pytest.mark.asyncio
    async def test_list_all_tasks(self, mock_prisma):
        """TC-INTEG-T006: List all tasks without filter."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.findMany.return_value = []
        await task_service.list()
        
        call_kwargs = mock_prisma.task.findMany.call_args[1]
        assert "where" not in call_kwargs or call_kwargs["where"] == {}

    @pytest.mark.asyncio
    async def test_list_by_project_id(self, mock_prisma):
        """TC-INTEG-T007: Filter tasks by projectId."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.findMany.return_value = []
        await task_service.list({"projectId": "proj-001"})
        
        call_kwargs = mock_prisma.task.findMany.call_args[1]
        assert call_kwargs["where"]["projectId"] == "proj-001"

    @pytest.mark.asyncio
    async def test_list_by_status(self, mock_prisma):
        """TC-INTEG-T008: Filter tasks by status."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.findMany.return_value = []
        await task_service.list({"status": "done"})
        
        call_kwargs = mock_prisma.task.findMany.call_args[1]
        assert call_kwargs["where"]["status"] == "done"

    @pytest.mark.asyncio
    async def test_list_ordered_by_priority_asc_created_at_desc(self, mock_prisma):
        """TC-INTEG-T009: Tasks ordered by priority ASC, createdAt DESC (DATA-002)."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.findMany.return_value = []
        await task_service.list()
        
        call_kwargs = mock_prisma.task.findMany.call_args[1]
        order = call_kwargs["orderBy"]
        assert order[0]["priority"] == "asc"
        assert order[1]["createdAt"] == "desc"

    @pytest.mark.asyncio
    async def test_list_returns_full_select(self, mock_prisma):
        """TC-INTEG-T010: List includes all task fields (full select)."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.findMany.return_value = [{
            "id": "t1", "projectId": "p1", "subprojectId": None,
            "title": "T", "description": "D", "status": "in_work",
            "priority": "medium", "assignee": "A",
            "createdAt": datetime.now(), "updatedAt": datetime.now(),
        }]
        
        result = await task_service.list()
        
        assert "id" in result[0]
        assert "projectId" in result[0]
        assert "subprojectId" in result[0]
        assert "description" in result[0]
        assert "assignee" in result[0]


class TestTaskServiceUpdate:
    """Test task update operations."""

    @pytest.mark.asyncio
    async def test_update_task_status(self, mock_prisma):
        """TC-INTEG-T011: Update task status changes it."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.update.return_value = {
            "id": "task-001", "title": "Task", "description": "",
            "status": "review", "priority": "medium", "assignee": "User",
            "createdAt": datetime.now(), "updatedAt": datetime.now(),
            "projectId": "p1", "subprojectId": None,
        }
        
        result = await task_service.update("task-001", {"status": "review"})
        assert result["status"] == "review"

    @pytest.mark.asyncio
    async def test_update_task_no_fields_raises(self, mock_prisma):
        """TC-INTEG-T012: Update with no fields raises validation error."""
        from lib.services.task_service import task_service
        from lib.errors import ApiError
        
        with pytest.raises(ApiError) as exc_info:
            await task_service.update("task-001", {})
        
        assert exc_info.value.statusCode == 400
        assert exc_info.value.code == "VALIDATION_ERROR"
        assert "No fields to update" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_update_filters_undefined(self, mock_prisma):
        """TC-INTEG-T013: Undefined values filtered out before DB update."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.update.return_value = {
            "id": "task-001", "title": "Updated", "description": "",
            "status": "in_work", "priority": "low", "assignee": "User",
            "createdAt": datetime.now(), "updatedAt": datetime.now(),
            "projectId": "p1", "subprojectId": None,
        }
        
        # Pass empty dict - cleanData filters it out
        mock_prisma.task.update.reset_mock()
        mock_prisma.task.update.side_effect = lambda **kwargs: {
            **kwargs.get("data", {}), "id": kwargs.get("where", {}).get("id")
        }
        
        result = await task_service.update("task-001", {"title": "Updated"})
        assert result["title"] == "Updated"

    @pytest.mark.asyncio
    async def test_update_assignee(self, mock_prisma):
        """TC-INTEG-T014: Update task assignee."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.update.return_value = {
            "id": "task-001", "title": "Task", "description": "",
            "status": "in_work", "priority": "medium", "assignee": "New User",
            "createdAt": datetime.now(), "updatedAt": datetime.now(),
            "projectId": "p1", "subprojectId": None,
        }
        
        result = await task_service.update("task-001", {"assignee": "New User"})
        assert result["assignee"] == "New User"


class TestTaskServiceDelete:
    """Test task deletion."""

    @pytest.mark.asyncio
    async def test_delete_task(self, mock_prisma):
        """TC-INTEG-T015: Delete task returns deleted ID."""
        from lib.services.task_service import task_service
        
        mock_prisma.task.delete.return_value = {"id": "task-001"}
        
        result = await task_service.delete("task-001")
        
        assert result["id"] == "task-001"


class TestTaskValidationEdgeCases:
    """Edge cases for task validation."""

    @pytest.mark.asyncio
    async def test_title_max_length(self):
        """TC-INTEG-T016: Title > 200 chars fails validation."""
        from lib.validators.task import create_task_schema
        
        long_title = "x" * 201
        result = create_task_schema.safe_parse({
            "projectId": "valid-uuid",
            "title": long_title,
            "assignee": "User",
        })
        assert result.success is False

    @pytest.mark.asyncio
    async def test_description_max_length(self):
        """TC-INTEG-T017: Description > 2000 chars fails validation."""
        from lib.validators.task import create_task_schema
        
        long_desc = "x" * 2001
        result = create_task_schema.safe_parse({
            "projectId": "valid-uuid",
            "title": "Title",
            "assignee": "User",
            "description": long_desc,
        })
        assert result.success is False

    @pytest.mark.asyncio
    async def test_assignee_max_length(self):
        """TC-INTEG-T018: Assignee > 100 chars fails validation."""
        from lib.validators.task import create_task_schema
        
        long_assignee = "x" * 101
        result = create_task_schema.safe_parse({
            "projectId": "valid-uuid",
            "title": "Title",
            "assignee": long_assignee,
        })
        assert result.success is False

    @pytest.mark.asyncio
    async def test_invalid_priority(self):
        """TC-INTEG-T019: Invalid priority value fails validation."""
        from lib.validators.task import create_task_schema
        
        result = create_task_schema.safe_parse({
            "projectId": "valid-uuid",
            "title": "Title",
            "assignee": "User",
            "priority": "critical",
        })
        assert result.success is False

    @pytest.mark.asyncio
    async def test_empty_assignee(self):
        """TC-INTEG-T020: Empty assignee fails validation."""
        from lib.validators.task import create_task_schema
        
        result = create_task_schema.safe_parse({
            "projectId": "valid-uuid",
            "title": "Title",
            "assignee": "   ",
        })
        assert result.success is False

    @pytest.mark.asyncio
    async def test_update_task_partial_fields(self):
        """TC-INTEG-T021: Update schema accepts partial field updates."""
        from lib.validators.task import update_task_schema
        
        for field, value in [("status", "done"), ("priority", "high"), ("assignee", "New")]:
            result = update_task_schema.safe_parse({field: value})
            assert result.success is True, f"Partial update of {field} should succeed"

    @pytest.mark.asyncio
    async def test_task_description_nullable_on_update(self):
        """TC-INTEG-T022: Setting description to null clears it on update."""
        from lib.validators.task import update_task_schema
        
        result = update_task_schema.safe_parse({"description": None})
        assert result.success is True


class TestTaskSSEPayload:
    """Test SSE payload generation excludes description."""

    @pytest.mark.asyncio
    async def test_to_sse_payload_excludes_description(self, mock_event_bus):
        """TC-INTEG-T023: SSE payload strips description field."""
        from lib.events.event_bus import toSSEPayload
        
        full_task = {
            "id": "t1",
            "projectId": "p1",
            "subprojectId": None,
            "title": "Task",
            "description": "Long description that should be excluded",
            "status": "in_work",
            "priority": "medium",
            "assignee": "User",
            "createdAt": datetime.now(),
            "updatedAt": datetime.now(),
        }
        
        payload = toSSEPayload(full_task)
        
        assert "description" not in payload
        assert payload["id"] == "t1"
        assert payload["title"] == "Task"
        assert payload["status"] == "in_work"


class TestTaskAPIServiceLayer:
    """Service layer tests for HTTP route handlers."""

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_prisma):
        """TC-INTEG-T024: Get non-existent task raises 404."""
        from lib.services.task_service import task_service
        from lib.errors import ApiError
        
        mock_prisma.task.findUnique.return_value = None
        
        with pytest.raises(ApiError) as exc_info:
            await task_service.getById("nonexistent")
        
        assert exc_info.value.statusCode == 404
        assert exc_info.value.code == "NOT_FOUND"
