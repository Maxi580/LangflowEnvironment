import requests
import json
import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from fastapi import HTTPException

LANGFLOW_URL = os.getenv("LANGFLOW_INTERNAL_URL", "http://langflow:7860")


def generate_api_key_name() -> str:
    """Generate a unique API key name using timestamp and random string"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_suffix = str(uuid.uuid4())[:8]
    return f"temp_key_{timestamp}_{random_suffix}"


def create_temporary_api_key(auth_token: str) -> Tuple[str, str]:
    """
    Create a temporary API key for a single request

    Args:
        auth_token: Valid Langflow JWT token

    Returns:
        Tuple of (api_key_value, api_key_id)

    Raises:
        HTTPException: If creation fails
    """
    try:
        url = f"{LANGFLOW_URL}/api/v1/api_key/"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        }

        payload = {
            "name": generate_api_key_name(),
            "description": "Temporary API key for single request"
        }

        print(f"Creating temporary API key...")
        response = requests.post(url, headers=headers, json=payload, timeout=10)

        if not response.ok:
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid or expired auth token")

            error_detail = "Unknown error"
            try:
                error_data = response.json()
                error_detail = error_data.get("detail", str(error_data))
            except:
                error_detail = response.text

            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to create API key: {error_detail}"
            )

        result = response.json()
        api_key_value = result.get("api_key")
        api_key_id = result.get("id")

        if not api_key_value or not api_key_id:
            raise HTTPException(
                status_code=500,
                detail="API key creation response missing required fields"
            )

        print(f"Created temporary API key: {result.get('name')} (ID: {api_key_id})")
        return api_key_value, str(api_key_id)

    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        print(f"Connection error creating API key: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to Langflow: {str(e)}")
    except Exception as e:
        print(f"Unexpected error creating API key: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating API key: {str(e)}")


def delete_api_key(auth_token: str, api_key_id: str) -> bool:
    """
    Delete an API key

    Args:
        auth_token: Valid Langflow JWT token
        api_key_id: ID of the API key to delete

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        url = f"{LANGFLOW_URL}/api/v1/api_key/{api_key_id}"
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        }

        print(f"Deleting API key: {api_key_id}")
        response = requests.delete(url, headers=headers, timeout=10)

        if response.ok:
            print(f"Successfully deleted API key: {api_key_id}")
            return True
        else:
            print(f"Failed to delete API key {api_key_id}: {response.status_code} - {response.text}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"Connection error deleting API key {api_key_id}: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error deleting API key {api_key_id}: {e}")
        return False


def create_api_key_headers(api_key: str) -> Dict[str, str]:
    """
    Create headers for Langflow requests with API key in x-api-key header

    Args:
        api_key: The API key value

    Returns:
        Dict of headers for requests
    """
    return {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': api_key
    }


class TemporaryApiKey:
    """
    Context manager for temporary API keys
    Automatically creates and deletes API key
    """

    def __init__(self, auth_token: str):
        self.auth_token = auth_token
        self.api_key = None
        self.api_key_id = None

    def __enter__(self):
        """Create API key on enter"""
        self.api_key, self.api_key_id = create_temporary_api_key(self.auth_token)
        return self.api_key

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Delete API key on exit"""
        if self.api_key_id:
            success = delete_api_key(self.auth_token, self.api_key_id)
            if not success:
                print(f"Warning: Failed to cleanup API key {self.api_key_id}")

    def get_headers(self) -> Dict[str, str]:
        """Get headers for making requests with API key in x-api-key header"""
        if not self.api_key:
            raise ValueError("API key not created yet")
        return create_api_key_headers(self.api_key)


# Convenience functions for one-off usage
def with_temporary_api_key(auth_token: str, operation_func, *args, **kwargs):
    """
    Execute a function with a temporary API key

    Args:
        auth_token: Valid Langflow JWT token
        operation_func: Function to execute (receives api_key as first argument)
        *args, **kwargs: Additional arguments for operation_func

    Returns:
        Result of operation_func
    """
    with TemporaryApiKey(auth_token) as api_key:
        return operation_func(api_key, *args, **kwargs)


def send_langflow_request_with_temp_key(
        auth_token: str,
        flow_id: str,
        payload: Dict[str, Any],
        timeout: int = 30
) -> Dict[str, Any]:
    """
    Send a request to Langflow using a temporary API key

    Args:
        auth_token: Valid Langflow JWT token
        flow_id: Langflow flow ID
        payload: Request payload
        timeout: Request timeout in seconds

    Returns:
        Langflow response data
    """

    def make_request(api_key: str) -> Dict[str, Any]:
        url = f"{LANGFLOW_URL}/api/v1/run/{flow_id}"
        headers = create_api_key_headers(api_key)

        print(f"Sending request to Langflow flow: {flow_id}")
        print(f"Using x-api-key header")

        response = requests.post(url, headers=headers, json=payload, timeout=timeout)

        if not response.ok:
            error_detail = "Unknown error"
            try:
                error_data = response.json()
                error_detail = error_data.get("detail", str(error_data))
            except:
                error_detail = response.text

            raise HTTPException(
                status_code=response.status_code,
                detail=f"Langflow request failed: {error_detail}"
            )

        return response.json()

    return with_temporary_api_key(auth_token, make_request)