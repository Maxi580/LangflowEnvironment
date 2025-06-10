from fastapi import APIRouter, HTTPException, Request, Response
from typing import Dict, Any
import os

from ...services.user_service import UserService
from ...models.user import UserCreate

USERS_BASE_ENDPOINT = os.getenv("USERS_BASE_ENDPOINT")
USERS_CREATE_ENDPOINT = os.getenv("USERS_CREATE_ENDPOINT", "")
USERS_LOGIN_ENDPOINT = os.getenv("USERS_LOGIN_ENDPOINT")
USERS_REFRESH_TOKEN_ENDPOINT = os.getenv("USERS_REFRESH_TOKEN_ENDPOINT")
USERS_LOGOUT_ENDPOINT = os.getenv("USERS_LOGOUT_ENDPOINT")
USERS_VERIFY_AUTH_ENDPOINT = os.getenv("USERS_VERIFY_AUTH_ENDPOINT")
USERS_AUTH_STATUS_ENDPOINT = os.getenv("USERS_AUTH_STATUS_ENDPOINT")
USERS_DELETE_ENDPOINT = os.getenv("USERS_DELETE_ENDPOINT")

router = APIRouter(prefix=USERS_BASE_ENDPOINT, tags=["users"])
user_service = UserService()


@router.post(USERS_CREATE_ENDPOINT)
async def create_user(user: UserCreate) -> Dict[str, Any]:
    """Create a new user in Langflow"""
    try:
        result = await user_service.create_user(user)
        return result.dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(USERS_LOGIN_ENDPOINT)
async def login(user: UserCreate, request: Request, response: Response) -> Dict[str, Any]:
    """Login user and set authentication cookies"""
    try:
        result = await user_service.login_user(user, request, response)
        return result.dict()
    except ValueError as e:
        # Business logic errors (invalid credentials, etc.)
        return {"success": False, "message": str(e)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@router.post(USERS_REFRESH_TOKEN_ENDPOINT)
async def refresh_token(request: Request, response: Response) -> Dict[str, Any]:
    """Refresh access token using httpOnly refresh token"""
    try:
        result = await user_service.refresh_user_token(request, response)
        return result.dict()
    except ValueError as e:
        # Expected errors like expired tokens
        return {"success": False, "message": str(e), "should_login": True}
    except Exception as e:
        return {"success": False, "message": f"Token refresh failed: {str(e)}", "should_login": True}


@router.post(USERS_LOGOUT_ENDPOINT)
async def logout(request: Request, response: Response) -> Dict[str, Any]:
    """Logout user and clear all cookies"""
    try:
        result = await user_service.logout_user(request, response)
        return result.dict()
    except Exception as e:
        return {"success": True, "message": "Logout completed with errors"}


@router.get(USERS_VERIFY_AUTH_ENDPOINT)
async def verify_auth(request: Request) -> Dict[str, Any]:
    """Verify if user is authenticated"""
    try:
        result = await user_service.verify_authentication(request)
        return result
    except Exception as e:
        return {"authenticated": False, "message": "Authentication verification failed."}


@router.get(USERS_AUTH_STATUS_ENDPOINT)
async def get_auth_status(request: Request) -> Dict[str, Any]:
    """Get detailed authentication status"""
    try:
        result = await user_service.get_auth_status(request)
        return result.dict()
    except Exception as e:
        return {
            "authenticated": False,
            "user": None,
            "tokens": {"hasAccessToken": False, "hasRefreshToken": False},
            "message": "Failed to get authentication status"
        }


@router.delete(USERS_DELETE_ENDPOINT)
async def delete_user(request: Request, user_id: str) -> Dict[str, Any]:
    """Delete a user and clean up all associated flows and collections"""
    try:
        result = await user_service.delete_user_with_cleanup(request, user_id)

        if not result.success:
            raise HTTPException(
                status_code=400 if "access denied" in result.message.lower() else 500,
                detail=result.message
            )

        return result.dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting user: {str(e)}")
