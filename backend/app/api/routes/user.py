from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
import requests
import json
import os
import time
import jwt
from typing import Dict, Any, Optional, Tuple
from pydantic import BaseModel

LANGFLOW_URL = os.getenv("LANGFLOW_INTERNAL_URL", "http://langflow:7860")
SUPERUSER_USERNAME = os.getenv("BACKEND_LF_USERNAME")
SUPERUSER_PASSWORD = os.getenv("BACKEND_LF_PASSWORD")
TOKEN_EXPIRY_BUFFER = 300

router = APIRouter(prefix="/api/users", tags=["users"])

token_cache = {
    "token": Optional[str],
    "expiry": 0
}


class UserCreate(BaseModel):
    username: str
    password: str


def get_token_expiry(token: str) -> int:
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get("exp", 0)
    except Exception as e:
        print(f"Error decoding token: {e}")
        return 0


def get_admin_token() -> str:
    global token_cache
    current_time = time.time()

    if (token_cache["token"] and
            token_cache["expiry"] > current_time + TOKEN_EXPIRY_BUFFER):
        return token_cache["token"]

    login_url = f"{LANGFLOW_URL}/api/v1/login"

    payload = {
        "username": "admin",
        "password": "admin",
        "grant_type": "password"
    }

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    }

    try:
        response = requests.post(login_url, headers=headers, data=payload)
        response.raise_for_status()
        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("Access token not found in response")

        expiry = get_token_expiry(access_token)

        token_cache["token"] = access_token
        token_cache["expiry"] = expiry

        print(f"New admin token obtained, expires in {int((expiry - current_time) / 60)} minutes")
        return access_token
    except requests.exceptions.RequestException as e:
        print(f"Error getting admin token: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to Langflow: {str(e)}")
    except Exception as e:
        print(f"Error in get_admin_token: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting admin token: {str(e)}")


@router.post("")
async def create_user(user: UserCreate) -> Dict[str, Any]:
    """Create a new user in Langflow"""
    try:
        admin_token = get_admin_token()
        print("Admin Token is: ", admin_token)

        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {admin_token}'
        }

        create_url = f"{LANGFLOW_URL}/api/v1/users/"
        create_payload = json.dumps({
            "username": user.username,
            "password": user.password
        })

        create_response = requests.post(create_url, headers=headers, data=create_payload)

        if create_response.status_code not in (200, 201):
            return {
                "success": False,
                "message": f"Failed to create user: {create_response.text}",
                "status_code": create_response.status_code
            }

        user_data = create_response.json()
        user_id = user_data.get("id")

        if not user_id:
            return {
                "success": False,
                "message": "User created but ID not found in response",
                "user_data": user_data
            }

        patch_url = f"{LANGFLOW_URL}/api/v1/users/{user_id}"
        patch_payload = json.dumps({
            "is_active": True,
            "is_superuser": False
        })

        patch_response = requests.patch(patch_url, headers=headers, data=patch_payload)

        if patch_response.status_code not in (200, 204):
            return {
                "success": False,
                "message": f"User created but activation failed: {patch_response.text}",
                "user_id": user_id,
                "status_code": patch_response.status_code
            }

        return {
            "success": True,
            "message": "User created and activated successfully",
            "user_id": user_id,
            "username": user.username
        }

    except HTTPException as e:
        raise
    except Exception as e:
        print(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")


@router.delete("/{user_id}")
async def delete_user(user_id: str) -> Dict[str, Any]:
    try:
        admin_token = get_admin_token()

        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {admin_token}'
        }

        delete_url = f"{LANGFLOW_URL}/api/v1/users/{user_id}"
        delete_response = requests.delete(delete_url, headers=headers)

        if delete_response.status_code not in (200, 204):
            return {
                "success": False,
                "message": f"Failed to delete user: {delete_response.text}",
                "status_code": delete_response.status_code
            }

        return {
            "success": True,
            "message": f"User with ID '{user_id}' deleted successfully",
            "user_id": user_id
        }

    except HTTPException as e:
        raise
    except Exception as e:
        print(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting user: {str(e)}")