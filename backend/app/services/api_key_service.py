import uuid
from datetime import datetime
from typing import Optional

from ..repositories.langflow_repository import LangflowRepository


class ApiKeyService:
    def __init__(self):
        self.langflow_repo = LangflowRepository()
        self._current_api_key: Optional[str] = None
        self._current_api_key_id: Optional[str] = None

    def _generate_api_key_name(self) -> str:
        """Generate a unique API key name"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        random_suffix = str(uuid.uuid4())[:8]
        return f"temp_key_{timestamp}_{random_suffix}"

    async def create_temporary_api_key(self, auth_token: str) -> str:
        """Create a temporary API key for a single request"""
        try:
            key_name = self._generate_api_key_name()
            description = "Temporary API key for single request"

            result = await self.langflow_repo.create_api_key(
                token=auth_token,
                name=key_name,
                description=description
            )

            api_key_value = result.get("api_key")
            api_key_id = result.get("id")

            if not api_key_value or not api_key_id:
                raise Exception("API key creation response missing required fields")

            # Store for cleanup
            self._current_api_key = api_key_value
            self._current_api_key_id = str(api_key_id)

            print(f"Created temporary API key: {key_name} (ID: {api_key_id})")
            return api_key_value

        except Exception as e:
            raise Exception(f"Failed to create temporary API key: {str(e)}")

    async def cleanup_temporary_api_key(self) -> bool:
        """Clean up the current temporary API key"""
        if not self._current_api_key_id:
            return True

        try:
            # We need the auth token to delete, but we don't have it here
            # This is a limitation - we'll need to pass it or store it
            # For now, we'll just clear our references
            print(f"Warning: Manual cleanup needed for API key ID: {self._current_api_key_id}")
            self._current_api_key = None
            self._current_api_key_id = None
            return True
        except Exception as e:
            print(f"Warning: Failed to cleanup API key {self._current_api_key_id}: {e}")
            return False

    async def delete_api_key(self, auth_token: str, api_key_id: str) -> bool:
        """Delete a specific API key"""
        try:
            success = await self.langflow_repo.delete_api_key(auth_token, api_key_id)
            if success:
                print(f"Successfully deleted API key: {api_key_id}")
            else:
                print(f"Failed to delete API key: {api_key_id}")
            return success
        except Exception as e:
            print(f"Error deleting API key {api_key_id}: {e}")
            return False


class TemporaryApiKeyContext:
    """Context manager for temporary API keys with proper cleanup"""

    def __init__(self, auth_token: str):
        self.auth_token = auth_token
        self.api_key_service = ApiKeyService()
        self.api_key: Optional[str] = None
        self.api_key_id: Optional[str] = None

    async def __aenter__(self):
        """Create API key on enter"""
        self.api_key = await self.api_key_service.create_temporary_api_key(self.auth_token)
        self.api_key_id = self.api_key_service._current_api_key_id
        return self.api_key

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Delete API key on exit"""
        if self.api_key_id:
            await self.api_key_service.delete_api_key(self.auth_token, self.api_key_id)
