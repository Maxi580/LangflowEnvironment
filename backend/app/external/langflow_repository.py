import requests
import json
import os
from typing import Dict, Any, List, Optional
from ..models.user import UserCreate
from ..models.message import LangflowMessageResponse, GeneratedFileData
from ..utils.message_parsing import extract_bot_response_with_files


class LangflowRepository:
    def __init__(self):
        self.base_url = os.getenv("LANGFLOW_INTERNAL_URL")
        self.health_endpoint = os.getenv("LANGFLOW_HEALTH_ENDPOINT", "/health")
        self.auth_login_endpoint = os.getenv("LF_AUTH_LOGIN_ENDPOINT")
        self.auth_refresh_endpoint = os.getenv("LF_AUTH_REFRESH_ENDPOINT")
        self.auth_logout_endpoint = os.getenv("LF_AUTH_LOGOUT_ENDPOINT")
        self.users_endpoint = os.getenv("LF_USERS_BASE_ENDPOINT")
        self.flows_endpoint = os.getenv("LF_FLOWS_BASE_ENDPOINT")
        self.flows_upload_endpoint = os.getenv("LF_FLOWS_UPLOAD_ENDPOINT")
        self.run_flow_endpoint = os.getenv("LF_RUN_FLOW_ENDPOINT")
        self.user_whoami_endpoint = os.getenv("LF_USER_WHOAMI")

    async def check_connection(self) -> bool:
        """Check if Langflow service is reachable"""
        try:
            url = f"{self.base_url}{self.health_endpoint}"
            response = requests.get(url, timeout=5)
            return response.status_code == 200
        except Exception:
            return False

    async def authenticate_user(self, username: str, password: str) -> Dict[str, Any]:
        url = f"{self.base_url}{self.auth_login_endpoint}"
        payload = {
            "username": username,
            "password": password,
            "grant_type": "password"
        }
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        }

        response = requests.post(url, headers=headers, data=payload)
        if not response.ok:
            raise Exception(f"Authentication failed: {response.text}")

        return response.json()

    async def get_current_user(self, access_token: str) -> Dict[str, Any]:
        url = f"{self.base_url}{self.user_whoami_endpoint}"
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {access_token}'
        }

        response = requests.get(url, headers=headers, timeout=10)
        if not response.ok:
            raise Exception(f"User validation failed: {response.status_code} - {response.text}")

        return response.json()

    async def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        url = f"{self.base_url}{self.auth_refresh_endpoint}"
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
        cookies = {'refresh_token_lf': refresh_token}

        response = requests.post(url, headers=headers, cookies=cookies)
        if not response.ok:
            raise Exception(f"Token refresh failed: {response.text}")

        return response.json()

    async def logout_user(self, access_token: str) -> bool:
        try:
            url = f"{self.base_url}{self.auth_logout_endpoint}"
            headers = {
                'Accept': 'application/json',
                'Authorization': f'Bearer {access_token}'
            }
            response = requests.post(url, headers=headers, timeout=5)
            return response.ok
        except Exception:
            return False

    async def create_user(self, user_data: UserCreate, admin_token: str) -> Dict[str, Any]:
        url = f"{self.base_url}{self.users_endpoint}"
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {admin_token}'
        }
        payload = json.dumps({
            "username": user_data.username,
            "password": user_data.password
        })

        response = requests.post(url, headers=headers, data=payload)
        if not response.ok:
            raise Exception(f"User creation failed: {response.text}")

        return response.json()

    async def activate_user(self, user_id: str, admin_token: str) -> bool:
        url = f"{self.base_url}{self.users_endpoint.rstrip('/')}/{user_id}"
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {admin_token}'
        }
        payload = json.dumps({
            "is_active": True,
            "is_superuser": False
        })

        response = requests.patch(url, headers=headers, data=payload)
        return response.status_code in (200, 204)

    async def delete_user(self, user_id: str, admin_token: str) -> bool:
        url = f"{self.base_url}{self.users_endpoint.rstrip('/')}/{user_id}"
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {admin_token}'
        }

        response = requests.delete(url, headers=headers)
        return response.status_code in (200, 204)

    async def get_flows(self, token: str, remove_example_flows: bool = True,
                        header_flows: bool = False, get_all: bool = True) -> List[Dict[str, Any]]:
        params = {
            'get_all': str(get_all).lower(),
            'remove_example_flows': str(remove_example_flows).lower(),
            'header_flows': str(header_flows).lower()
        }

        url = f"{self.base_url}{self.flows_endpoint}"
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        }

        response = requests.get(url, headers=headers, params=params)
        if not response.ok:
            raise Exception(f"Failed to get flows: {response.text}")

        return response.json()

    async def get_all_flows_as_admin(self, token: str) -> List[Dict[str, Any]]:
        url = f"{self.base_url}{self.flows_endpoint}"
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        }

        params = {
            'get_all': 'true',
            'remove_example_flows': 'false',
            'header_flows': 'false'
        }

        response = requests.get(url, headers=headers, params=params, timeout=30)
        if not response.ok:
            raise Exception(f"Failed to get all flows: HTTP {response.status_code} - {response.text}")

        flows = response.json()
        print(f"📊 Retrieved {len(flows)} total flows from Langflow")
        return flows

    async def get_flow_by_id(self, flow_id: str, token: str) -> Dict[str, Any]:
        url = f"{self.base_url}{self.flows_endpoint.rstrip('/')}/{flow_id}"
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        }

        response = requests.get(url, headers=headers)
        if not response.ok:
            raise Exception(f"Failed to get flow: {response.text}")

        return response.json()

    async def upload_flow(self, file_content: bytes, filename: str,
                          token: str, folder_id: Optional[str] = None) -> Dict[str, Any]:
        files = {
            'file': (filename, file_content, 'application/json')
        }
        data = {}
        if folder_id:
            data['folder_id'] = folder_id

        url = f"{self.base_url}{self.flows_upload_endpoint}"
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        }

        response = requests.post(url, headers=headers, files=files, data=data)
        if not response.ok:
            raise Exception(f"Flow upload failed: {response.text}")

        return response.json()

    async def delete_flow(self, flow_id: str, token: str) -> Dict[str, Any]:
        url = f"{self.base_url}{self.flows_endpoint.rstrip('/')}/{flow_id}"
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        }

        response = requests.delete(url, headers=headers)
        if not response.ok:
            raise Exception(f"Flow deletion failed: {response.text}")

        try:
            return response.json()
        except:
            return {"success": True, "message": "Flow deleted successfully", "flow_id": flow_id}

    async def run_flow(self, flow_id: str, payload: Dict[str, Any], api_key: str) -> LangflowMessageResponse:
        url = f"{self.base_url}{self.run_flow_endpoint.format(flow_id=flow_id)}"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'x-api-key': api_key
        }

        response = requests.post(url, headers=headers, json=payload, timeout=3600)
        if not response.ok:
            raise Exception(f"Flow execution failed: {response.text}")

        response_data = response.json()
        extracted_message, file_data = extract_bot_response_with_files(response_data)

        generated_file = None
        if file_data:
            generated_file = GeneratedFileData(
                filename=file_data["filename"],
                content_type=file_data["content_type"],
                size=file_data["size"],
                base64_data=file_data["base64_data"]
            )

        return LangflowMessageResponse(
            extracted_message=extracted_message,
            generated_file=generated_file
        )

    async def create_api_key(self, token: str, name: str, description: str = "") -> Dict[str, Any]:
        """Create a temporary API key"""
        url = f"{self.base_url}/api/v1/api_key/"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        payload = {
            "name": name,
            "description": description
        }

        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if not response.ok:
            raise Exception(f"API key creation failed: {response.text}")

        return response.json()

    async def delete_api_key(self, token: str, api_key_id: str) -> bool:
        """Delete an API key"""
        try:
            url = f"{self.base_url}/api/v1/api_key/{api_key_id}"
            headers = {
                'Accept': 'application/json',
                'Authorization': f'Bearer {token}'
            }

            response = requests.delete(url, headers=headers, timeout=10)
            return response.ok
        except Exception:
            return False
