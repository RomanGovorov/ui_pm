"""Integration tests: Project CRUD operations — full lifecycle."""

import os
import sys
import pytest
from unittest.mock import MagicMock, AsyncMock, patch, PropertyMock
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "app" / "src"))


@pytest.fixture(autouse=True)
def setup_env():
    """Ensure API_KEY is set before any project service test."""
    if "API_KEY" not in os.environ:
        os.environ["API_KEY"] = "test-key-0123456789abcdef-xxxxxxxxxxxxxxx"
    yield


class TestProjectServiceCreate:
    """Test project creation flow."""

    @pytest.mark.asyncio
    async def test_create_project_valid(self, mock_prisma):
        """TC-INTEG-P001: Create a project with valid data returns 201."""
        from lib.services.project_service import project_service
        
        mock_prisma.project.create.return_value = {
            "id": "proj-001",
            "name": "New Project",
            "description": "Description",
            "createdAt": datetime.now(),
            "updatedAt": datetime.now(),
        }
        
        result = await project_service.create({
            "name": "New Project",
            "description": "Description",
        })
        
        assert result["name"] == "New Project"
        assert result["id"] == "proj-001"
        mock_prisma.project.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_project_no_description(self, mock_prisma):
        """TC-INTEG-P002: Create project without description (optional field)."""
        from lib.services.project_service import project_service
        
        mock_prisma.project.create.return_value = {
            "id": "proj-002",
            "name": "No Desc Project",
            "description": None,
            "createdAt": datetime.now(),
            "updatedAt": datetime.now(),
        }
        
        result = await project_service.create({"name": "No Desc Project"})
        
        assert result["name"] == "No Desc Project"
        assert result["description"] is None

    @pytest.mark.asyncio
    async def test_create_project_trims_whitespace(self, mock_prisma):
        """TC-INTEG-P003: Project name whitespace is trimmed by Zod schema."""
        from lib.validators.project import create_project_schema
        
        # Schema-level validation: trim + min/max
        parsed = create_project_schema.safe_parse({"name": "  Trimmed Name  ", "description": ""})
        assert parsed.success is True
        assert parsed.data["name"] == "Trimmed Name"

    @pytest.mark.asyncio
    async def test_create_project_name_too_long(self, mock_prisma):
        """TC-INTEG-P004: Project name > 255 chars fails validation."""
        from lib.validators.project import create_project_schema
        
        long_name = "x" * 256
        result = create_project_schema.safe_parse({"name": long_name})
        
        assert result.success is False
        issues = [i for i in result.error.issues if "name" in i.get("path", [])]
        assert len(issues) > 0

    @pytest.mark.asyncio
    async def test_create_project_empty_name(self, mock_prisma):
        """TC-INTEG-P005: Empty project name fails validation."""
        from lib.validators.project import create_project_schema
        
        result = create_project_schema.safe_parse({"name": ""})
        
        assert result.success is False
        issues = [i for i in result.error.issues if "name" in i.get("path", [])]
        assert len(issues) > 0

    @pytest.mark.asyncio
    async def test_create_project_undefined_name(self, mock_prisma):
        """TC-INTEG-P006: Missing project name fails validation."""
        from lib.validators.project import create_project_schema
        
        result = create_project_schema.safe_parse({})
        
        assert result.success is False


class TestProjectServiceList:
    """Test project listing with filters."""

    @pytest.mark.asyncio
    async def test_list_all_projects(self, mock_prisma):
        """TC-INTEG-P007: List all projects returns sorted by name."""
        from lib.services.project_service import project_service
        
        mock_prisma.project.findMany.return_value = [
            {"id": "p2", "name": "Beta", "_count": {"tasks": 0}},
            {"id": "p1", "name": "Alpha", "_count": {"tasks": 2}},
        ]
        
        result = await project_service.list()
        
        assert len(result) == 2
        # Verify orderBy was used
        call_kwargs = mock_prisma.project.findMany.call_args[1]
        assert "orderBy" in call_kwargs
        assert call_kwargs["orderBy"]["name"] == "asc"

    @pytest.mark.asyncio
    async def test_list_returns_count_field(self, mock_prisma):
        """TC-INTEG-P008: List includes task count per project."""
        from lib.services.project_service import project_service
        
        mock_prisma.project.findMany.return_value = [
            {"id": "p1", "name": "Proj", "_count": {"tasks": 5}},
        ]
        
        result = await project_service.list()
        
        assert result[0]["_count"]["tasks"] == 5


class TestProjectServiceGetById:
    """Test project retrieval by ID."""

    @pytest.mark.asyncio
    async def test_get_by_id_found(self, mock_prisma):
        """TC-INTEG-P009: Get existing project returns full data."""
        from lib.services.project_service import project_service
        from lib.errors import ApiError
        
        mock_prisma.project.findUnique.return_value = {
            "id": "proj-001",
            "name": "Found Project",
            "description": "Has desc",
            "createdAt": datetime.now(),
            "updatedAt": datetime.now(),
            "subprojects": [{"id": "sp1", "name": "Sub 1"}],
            "_count": {"tasks": 3},
        }
        
        result = await project_service.getById("proj-001")
        
        assert result["name"] == "Found Project"
        assert result["subprojects"][0]["name"] == "Sub 1"
        assert result["_count"]["tasks"] == 3

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_prisma):
        """TC-INTEG-P010: Get non-existent project raises 404."""
        from lib.services.project_service import project_service
        from lib.errors import ApiError
        
        mock_prisma.project.findUnique.return_value = None
        
        with pytest.raises(ApiError) as exc_info:
            await project_service.getById("nonexistent")
        
        assert exc_info.value.statusCode == 404
        assert exc_info.value.code == "NOT_FOUND"


class TestProjectServiceUpdate:
    """Test project update operations."""

    @pytest.mark.asyncio
    async def test_update_partial_fields(self, mock_prisma):
        """TC-INTEG-P011: Update only specific fields filters undefined out."""
        from lib.services.project_service import project_service
        
        mock_prisma.project.update.return_value = {
            "id": "proj-001",
            "name": "Updated Name",
            "description": None,
            "createdAt": datetime.now(),
            "updatedAt": datetime.now(),
        }
        
        result = await project_service.update("proj-001", {"name": "Updated Name"})
        
        assert result["name"] == "Updated Name"
        # The cleanData should filter out undefined
        call_kwargs = mock_prisma.project.update.call_args[1]
        assert "description" not in call_kwargs["data"] or call_kwargs["data"].get("description") is None

    @pytest.mark.asyncio
    async def test_update_all_fields(self, mock_prisma):
        """TC-INTEG-P012: Update with all fields."""
        from lib.services.project_service import project_service
        
        mock_prisma.project.update.return_value = {
            "id": "proj-001",
            "name": "Full Update",
            "description": "Full desc",
            "createdAt": datetime.now(),
            "updatedAt": datetime.now(),
        }
        
        result = await project_service.update("proj-001", {
            "name": "Full Update",
            "description": "Full desc",
        })
        
        assert result["name"] == "Full Update"


class TestProjectServiceDelete:
    """Test project deletion."""

    @pytest.mark.asyncio
    async def test_delete_project(self, mock_prisma, mock_event_bus):
        """TC-INTEG-P013: Delete project emits SSE event."""
        from lib.services.project_service import project_service
        
        mock_prisma.project.delete.return_value = {"id": "proj-001"}
        
        result = await project_service.delete("proj-001")
        
        assert result["id"] == "proj-001"
        # Event bus emit should have been called
        mock_event_bus.emitProjectEvent.assert_called()


class TestProjectValidationEdgeCases:
    """Edge cases for project validation."""

    @pytest.mark.asyncio
    async def test_description_max_length(self):
        """TC-INTEG-P014: Description > 2000 chars fails validation."""
        from lib.validators.project import create_project_schema
        
        long_desc = "x" * 2001
        result = create_project_schema.safe_parse({"name": "Name", "description": long_desc})
        
        assert result.success is False

    @pytest.mark.asyncio
    async def test_description_nullable_on_update(self):
        """TC-INTEG-P015: Setting description to null clears it on update."""
        from lib.validators.project import update_project_schema
        
        result = update_project_schema.safe_parse({"name": "Name", "description": None})
        assert result.success is True
        assert result.data["description"] is None

    @pytest.mark.asyncio
    async def test_update_schema_optional_fields(self):
        """TC-INTEG-P016: Update schema accepts partial updates."""
        from lib.validators.project import update_project_schema
        
        for field in ["name", "description"]:
            result = update_project_schema.safe_parse({field: "value"})
            assert result.success is True


class TestProjectAPIServiceLayer:
    """Test the service layer handles business logic correctly."""

    @pytest.mark.asyncio
    async def test_list_with_select_clause(self, mock_prisma):
        """TC-INTEG-P017: List uses selective projection (no sensitive data leaked)."""
        from lib.services.project_service import project_service
        
        mock_prisma.project.findMany.return_value = []
        await project_service.list()
        
        call_kwargs = mock_prisma.project.findMany.call_args[1]
        select = call_kwargs["select"]
        assert "apiKey" not in str(select)

    @pytest.mark.asyncio
    async def test_get_by_id_with_subprojects(self, mock_prisma):
        """TC-INTEG-P018: GetById fetches subprojects in same query (avoids N+1)."""
        from lib.services.project_service import project_service
        
        mock_prisma.project.findUnique.return_value = {
            "id": "p1",
            "name": "Parent",
            "subprojects": [{"id": "s1", "name": "Child 1"}],
            "_count": {"tasks": 1},
        }
        
        result = await project_service.getById("p1")
        
        assert len(result["subprojects"]) == 1
        mock_prisma.project.findUnique.assert_called_once()
