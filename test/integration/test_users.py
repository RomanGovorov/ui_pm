"""Integration tests: User operations + API key auth layer."""

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


class TestUserServiceCreate:
    """Test user creation."""

    @pytest.mark.asyncio
    async def test_create_user_valid(self, mock_prisma):
        """TC-INTEG-U001: Create user with valid data."""
        from lib.services.user_service import userService
        
        mock_prisma.user.create.return_value = {
            "id": "user-001",
            "name": "New User",
            "role": "agent",
            "createdAt": datetime.now(),
        }
        
        result = await userService.create({
            "name": "New User",
            "role": "agent",
            "apiKey": "my-api-key-here",
        })
        
        assert result["name"] == "New User"
        assert result["role"] == "agent"

    @pytest.mark.asyncio
    async def test_create_user_default_role(self):
        """TC-INTEG-U002: Default role is 'stakeholder'."""
        from lib.validators.user import createUserSchema
        
        parsed = createUserSchema.safe_parse({"name": "User"})
        assert parsed.success is True
        assert parsed.data["role"] == "stakeholder"

    @pytest.mark.asyncio
    async def test_create_user_without_api_key(self, mock_prisma):
        """TC-INTEG-U003: User can be created without API key (optional)."""
        from lib.services.user_service import userService
        
        mock_prisma.user.create.return_value = {
            "id": "user-002",
            "name": "No Key User",
            "role": "stakeholder",
            "apiKey": None,
            "createdAt": datetime.now(),
        }
        
        result = await userService.create({"name": "No Key User"})
        assert result["name"] == "No Key User"


class TestUserServiceList:
    """Test user listing — apiKey should NOT be exposed."""

    @pytest.mark.asyncio
    async def test_list_excludes_apiKey(self, mock_prisma):
        """TC-INTEG-U004: List users does NOT include apiKey in response."""
        from lib.services.user_service import userService
        
        mock_prisma.user.findMany.return_value = [
            {"id": "u1", "name": "User 1", "role": "agent", "createdAt": datetime.now()},
        ]
        
        result = await userService.list()
        
        assert len(result) > 0
        call_kwargs = mock_prisma.user.findMany.call_args[1]
        select = call_kwargs["select"]
        # Verify apiKey is NOT in the select clause
        assert "apiKey" not in str(select), "apiKey must never appear in user list response"


class TestUserValidation:
    """Edge cases for user validation."""

    @pytest.mark.asyncio
    async def test_name_max_length(self):
        """TC-INTEG-U005: Name > 100 chars fails."""
        from lib.validators.user import createUserSchema
        
        long_name = "x" * 101
        result = createUserSchema.safe_parse({"name": long_name})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_invalid_role(self):
        """TC-INTEG-U006: Invalid role value fails."""
        from lib.validators.user import createUserSchema
        
        result = createUserSchema.safe_parse({"name": "User", "role": "admin"})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_api_key_min_length(self):
        """TC-INTEG-U007: API key < 32 chars fails."""
        from lib.validators.user import createUserSchema
        
        short_key = "short"
        result = createUserSchema.safe_parse({"name": "User", "apiKey": short_key})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_api_key_max_length(self):
        """TC-INTEG-U008: API key > 255 chars fails."""
        from lib.validators.user import createUserSchema
        
        long_key = "x" * 256
        result = createUserSchema.safe_parse({"name": "User", "apiKey": long_key})
        assert result.success is False


class TestApiAuthLayer:
    """Test the auth middleware/auth module directly."""

    @pytest.mark.asyncio
    async def test_validate_api_key_null(self):
        """TC-INTEG-U009: null API key returns false."""
        from lib.auth import validateApiKey
        
        result = validateApiKey(None)
        assert result is False

    @pytest.mark.asyncio
    async def test_validate_api_key_empty_string(self):
        """TC-INTEG-U010: Empty string API key returns false."""
        from lib.auth import validateApiKey
        
        result = validateApiKey("")
        assert result is False

    @pytest.mark.asyncio
    async def test_validate_api_key_missing_env(self):
        """TC-INTEG-U011: Missing API_KEY env var returns false."""
        from lib.auth import validateApiKey
        
        with patch.dict(os.environ, {}, clear=True):
            result = validateApiKey("some-key")
            assert result is False

    @pytest.mark.asyncio
    async def test_extract_api_key_from_header(self):
        """TC-INTEG-U012: extractApiKey reads X-API-Key header."""
        from lib.auth import extractApiKey
        
        mock_headers = {"x-api-key": "my-secret-key"}
        result = extractApiKey(mock_headers)
        assert result == "my-secret-key"

    @pytest.mark.asyncio
    async def test_extract_api_key_missing(self):
        """TC-INTEG-U013: Missing X-API-Key header returns None."""
        from lib.auth import extractApiKey
        
        mock_headers = {}
        result = extractApiKey(mock_headers)
        assert result is None

    @pytest.mark.asyncio
    async def test_validate_api_key_case_sensitivity(self):
        """TC-INTEG-U014: API key comparison is case-sensitive (hash-based)."""
        env_key = "MyKey1234567890abcdefghijklmnopqrstuv"
        with patch.dict(os.environ, {"API_KEY": env_key}, clear=False):
            from lib.auth import validateApiKey
            
            # Exact match
            assert validateApiKey(env_key) is True
            # Wrong case
            assert validateApiKey(env_key.lower()) is False
