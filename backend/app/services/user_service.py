import os
import time
import jwt
from typing import Optional
from fastapi import Request, Response

from ..repositories.langflow_repository import LangflowRepository
from ..services.flow_service import FlowService
from ..models.user import (
    UserCreate, UserDeletionResult
)
from ..utils.jwt_helper import get_user_token, get_token_expiry

SUPERUSER_USERNAME = os.getenv("BACKEND_LF_USERNAME")
SUPERUSER_PASSWORD = os.getenv("BACKEND_LF_PASSWORD")
TOKEN_EXPIRY_BUFFER = 300
ACCESS_COOKIE_NAME = os.getenv("ACCESS_COOKIE_NAME")
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME")
USERNAME_COOKIE_NAME = os.getenv("USERNAME_COOKIE_NAME")


class UserService:
    def __init__(self):
        self.langflow_repo = LangflowRepository()
        self.flow_service = FlowService()
        # Removed: self.collection_service = CollectionService()
        self._admin_token_cache = {"token": None, "expiry": 0}

    async def _get_admin_token(self) -> str:
        """Get cached admin token or create new one"""
        current_time = time.time()

        if (self._admin_token_cache["token"] and
                self._admin_token_cache["expiry"] > current_time + TOKEN_EXPIRY_BUFFER):
            return self._admin_token_cache["token"]

        # Get new admin token
        token_data = await self.langflow_repo.authenticate_user(
            SUPERUSER_USERNAME, SUPERUSER_PASSWORD
        )

        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("Admin authentication failed")

        expiry = get_token_expiry(access_token)
        self._admin_token_cache["token"] = access_token
        self._admin_token_cache["expiry"] = expiry

        print(f"New admin token obtained, expires in {int((expiry - current_time) / 60)} minutes")
        return access_token

    async def create_user(self, user_data: UserCreate) -> UserDeletionResult:
        """Create a new user and activate them"""
        try:
            admin_token = await self._get_admin_token()

            # Create user
            user_response = await self.langflow_repo.create_user(user_data, admin_token)
            user_id = user_response.get("id")

            if not user_id:
                return UserDeletionResult(
                    success=False,
                    user_id="",
                    message="User created but ID not found in response"
                )

            # Activate user
            activation_success = await self.langflow_repo.activate_user(user_id, admin_token)

            if not activation_success:
                return UserDeletionResult(
                    success=False,
                    user_id=user_id,
                    message="User created but activation failed"
                )

            return UserDeletionResult(
                success=True,
                user_id=user_id,
                message=f"User '{user_data.username}' created and activated successfully"
            )

        except Exception as e:
            return UserDeletionResult(
                success=False,
                user_id="",
                message=f"Failed to create user: {str(e)}"
            )

    async def login_user(self, user_data: UserCreate, request: Request, response: Response) -> UserDeletionResult:
        """Authenticate user and set cookies"""
        try:
            # Authenticate with Langflow
            token_data = await self.langflow_repo.authenticate_user(
                user_data.username, user_data.password
            )

            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")

            if not access_token:
                raise ValueError("Invalid credentials")

            # Parse token information
            user_info = jwt.decode(access_token, options={"verify_signature": False})
            user_id = user_info.get("sub") or user_info.get("user_id")
            token_expiry = user_info.get("exp", 0)

            current_time = int(time.time())
            access_token_max_age = max(0, token_expiry - current_time)

            # Handle refresh token
            refresh_token_max_age = 86400  # Default 24 hours
            if refresh_token:
                try:
                    refresh_info = jwt.decode(refresh_token, options={"verify_signature": False})
                    refresh_expiry = refresh_info.get("exp", 0)
                    if refresh_expiry > 0:
                        refresh_token_max_age = max(0, refresh_expiry - current_time)
                except Exception:
                    pass

            # Set cookies
            self._set_auth_cookies(
                response, request, user_data.username, access_token,
                refresh_token, access_token_max_age, refresh_token_max_age
            )

            return UserDeletionResult(
                success=True,
                user_id=user_id,
                message="Login successful"
            )

        except Exception as e:
            raise ValueError(f"Authentication failed: {str(e)}")

    async def refresh_user_token(self, request: Request, response: Response) -> UserDeletionResult:
        """Refresh user access token"""
        try:
            refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
            if not refresh_token:
                raise ValueError("No refresh token found")

            # Refresh token with Langflow
            token_data = await self.langflow_repo.refresh_token(refresh_token)

            new_access_token = token_data.get("access_token")
            new_refresh_token = token_data.get("refresh_token")

            if not new_access_token:
                raise ValueError("Invalid refresh response from Langflow")

            # Parse new token
            user_info = jwt.decode(new_access_token, options={"verify_signature": False})
            user_id = user_info.get("sub") or user_info.get("user_id")
            token_expiry = user_info.get("exp", 0)

            current_time = int(time.time())
            access_token_max_age = max(0, token_expiry - current_time)

            # Set new cookies
            self._set_access_cookie(response, request, new_access_token, access_token_max_age)

            if new_refresh_token:
                refresh_info = jwt.decode(new_refresh_token, options={"verify_signature": False})
                refresh_expiry = refresh_info.get("exp", 0)
                refresh_token_max_age = max(0, refresh_expiry - current_time)
                self._set_refresh_cookie(response, request, new_refresh_token, refresh_token_max_age)

            return UserDeletionResult(
                success=True,
                user_id=user_id,
                message="Token refreshed successfully"
            )

        except Exception as e:
            raise ValueError(f"Token refresh failed: {str(e)}")

    async def logout_user(self, request: Request, response: Response) -> UserDeletionResult:
        """Logout user and clear cookies"""
        try:
            access_token = request.cookies.get(ACCESS_COOKIE_NAME)
            langflow_logout_success = False

            if access_token:
                langflow_logout_success = await self.langflow_repo.logout_user(access_token)

            cookies_cleared = self._clear_all_cookies(request, response)

            return UserDeletionResult(
                success=True,
                user_id="",
                message=f"Logout completed - cleared {cookies_cleared} cookies",
                flows_found=1 if langflow_logout_success else 0
            )

        except Exception as e:
            # Clear cookies even if logout fails
            cookies_cleared = self._clear_all_cookies(request, response)
            return UserDeletionResult(
                success=True,
                user_id="",
                message=f"Logout completed with errors - cleared {cookies_cleared} cookies"
            )

    async def verify_authentication(self, request: Request) -> dict:
        """Verify if user is authenticated"""
        try:
            access_token = request.cookies.get(ACCESS_COOKIE_NAME)
            username = request.cookies.get(USERNAME_COOKIE_NAME)

            if not access_token:
                return {"authenticated": False, "message": "No access token found"}

            jwt_info = jwt.decode(access_token, options={"verify_signature": False})
            token_expiry = jwt_info.get("exp", 0)
            current_time = int(time.time())

            if token_expiry <= current_time:
                return {"authenticated": False, "message": "Access token expired"}

            user_id = jwt_info.get("sub") or jwt_info.get("user_id")

            return {
                "authenticated": True,
                "user": {
                    "username": username,
                    "userId": user_id,
                    "tokenExpiry": token_expiry
                },
                "message": "User is authenticated"
            }

        except Exception:
            return {"authenticated": False, "message": "Invalid access token"}

    async def get_auth_status(self, request: Request) -> dict:
        """Get detailed authentication status"""
        try:
            access_token = request.cookies.get(ACCESS_COOKIE_NAME)
            refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)

            if not access_token:
                return {
                    "authenticated": False,
                    "user": None,
                    "tokens": {
                        "hasAccessToken": False,
                        "hasRefreshToken": bool(refresh_token)
                    },
                    "message": "No access token found"
                }

            # Parse tokens
            jwt_info = jwt.decode(access_token, options={"verify_signature": False})
            access_token_expiry = jwt_info.get("exp", 0)
            current_time = int(time.time())
            access_token_valid = access_token_expiry > current_time

            refresh_token_valid = False
            refresh_token_expiry = None
            if refresh_token:
                try:
                    refresh_info = jwt.decode(refresh_token, options={"verify_signature": False})
                    refresh_token_expiry = refresh_info.get("exp", 0)
                    refresh_token_valid = refresh_token_expiry > current_time
                except Exception:
                    pass

            is_authenticated = access_token_valid or refresh_token_valid

            return {
                "authenticated": is_authenticated,
                "user": {"tokenExpiry": access_token_expiry} if is_authenticated else None,
                "tokens": {
                    "hasAccessToken": bool(access_token),
                    "hasRefreshToken": bool(refresh_token),
                    "accessTokenValid": access_token_valid,
                    "refreshTokenValid": refresh_token_valid,
                    "accessTokenExpiry": access_token_expiry,
                    "refreshTokenExpiry": refresh_token_expiry
                },
                "message": "Authentication status retrieved"
            }

        except Exception:
            return {
                "authenticated": False,
                "user": None,
                "tokens": {"hasAccessToken": False, "hasRefreshToken": False},
                "message": "Invalid token format"
            }

    async def delete_user_with_cleanup(self, request: Request, user_id: str) -> UserDeletionResult:
        """Delete user and clean up associated flows and collections"""
        try:
            user_token = get_user_token(request)
            if not user_token:
                return UserDeletionResult(
                    success=False,
                    user_id=user_id,
                    message="No valid authentication token found"
                )

            admin_token = await self._get_admin_token()

            # Clean up user's flows and collections
            cleanup_results = await self._cleanup_user_flows_and_collections(user_token)

            # Delete user from Langflow
            deletion_success = await self.langflow_repo.delete_user(user_id, admin_token)

            if not deletion_success:
                return UserDeletionResult(
                    success=False,
                    user_id=user_id,
                    message="Failed to delete user from Langflow",
                    **cleanup_results
                )

            return UserDeletionResult(
                success=True,
                user_id=user_id,
                message=f"User '{user_id}' deleted successfully",
                **cleanup_results
            )

        except Exception as e:
            return UserDeletionResult(
                success=False,
                user_id=user_id,
                message=f"Error deleting user: {str(e)}"
            )

    async def _cleanup_user_flows_and_collections(self, user_token: str) -> dict:
        """Clean up user's flows and collections"""
        cleanup_results = {
            "flows_found": 0,
            "collections_deleted": 0,
            "deleted_collections": [],
            "cleanup_errors": []
        }

        try:
            # Get user's flows
            user_flows = await self.flow_service.get_user_flows(user_token)
            cleanup_results["flows_found"] = len(user_flows)

            if user_flows:
                flow_ids = [flow.get('id') for flow in user_flows if flow.get('id')]

                if flow_ids:
                    # Use flow_service's internal collection deletion method
                    deletion_results = await self.flow_service._delete_multiple_collections_internal(flow_ids)

                    cleanup_results["collections_deleted"] = deletion_results.get("success_count", 0)
                    cleanup_results["deleted_collections"] = deletion_results.get("successful_deletions", [])

                    if deletion_results.get("failed_deletions"):
                        cleanup_results["cleanup_errors"].extend([
                            failure["message"] for failure in deletion_results["failed_deletions"]
                        ])

            return cleanup_results

        except Exception as e:
            cleanup_results["cleanup_errors"].append(f"Error during cleanup: {str(e)}")
            return cleanup_results

    def _set_auth_cookies(self, response: Response, request: Request, username: str,
                          access_token: str, refresh_token: Optional[str],
                          access_max_age: int, refresh_max_age: int):
        """Set authentication cookies"""
        cookie_config = {
            "path": "/",
            "secure": request.url.scheme == "https",
            "samesite": "strict"
        }

        # Username cookie (not httponly for frontend access)
        response.set_cookie(
            key=USERNAME_COOKIE_NAME,
            value=username,
            httponly=False,
            max_age=access_max_age,
            **cookie_config
        )

        # Access token cookie (httponly)
        response.set_cookie(
            key=ACCESS_COOKIE_NAME,
            value=access_token,
            httponly=True,
            max_age=access_max_age,
            **cookie_config
        )

        # Refresh token cookie (httponly)
        if refresh_token:
            response.set_cookie(
                key=REFRESH_COOKIE_NAME,
                value=refresh_token,
                httponly=True,
                max_age=refresh_max_age,
                **cookie_config
            )

    def _set_access_cookie(self, response: Response, request: Request,
                           access_token: str, max_age: int):
        """Set only access token cookie"""
        response.set_cookie(
            key=ACCESS_COOKIE_NAME,
            value=access_token,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="strict",
            max_age=max_age,
            path="/"
        )

    def _set_refresh_cookie(self, response: Response, request: Request,
                            refresh_token: str, max_age: int):
        """Set only refresh token cookie"""
        response.set_cookie(
            key=REFRESH_COOKIE_NAME,
            value=refresh_token,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="strict",
            max_age=max_age,
            path="/"
        )

    def _clear_all_cookies(self, request: Request, response: Response) -> int:
        """Clear all cookies and return count"""
        all_cookies = request.cookies

        for cookie_name in all_cookies.keys():
            response.delete_cookie(
                key=cookie_name,
                path="/",
                secure=request.url.scheme == "https",
                samesite="strict"
            )

        return len(all_cookies)
