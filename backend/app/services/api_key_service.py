import uuid
from datetime import datetime
from typing import Optional

from ..external.langflow_repository import LangflowRepository


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
