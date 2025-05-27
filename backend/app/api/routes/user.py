from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request, Response
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


@router.post("/login")
async def login(
        user: UserCreate,
        request: Request,
        response: Response
) -> Dict[str, Any]:
    try:
        login_url = f"{LANGFLOW_URL}/api/v1/login"

        payload = {
            "username": user.username,
            "password": user.password,
            "grant_type": "password"
        }

        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        }

        langflow_response = requests.post(login_url, headers=headers, data=payload)

        if not langflow_response.ok:
            error_detail = "Invalid credentials"
            try:
                error_data = langflow_response.json()
                error_detail = error_data.get("detail", error_detail)
            except:
                pass

            return {
                "success": False,
                "message": error_detail,
                "status_code": langflow_response.status_code
            }

        token_data = langflow_response.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        token_type = token_data.get("token_type", "bearer")

        if not access_token:
            return {
                "success": False,
                "message": "No access token received from Langflow"
            }

        try:
            user_info = jwt.decode(access_token, options={"verify_signature": False})
            user_id = user_info.get("sub") or user_info.get("user_id")
            token_expiry = user_info.get("exp", 0)

            current_time = int(time.time())
            access_token_max_age = max(0, token_expiry - current_time)

        except Exception as e:
            print(f"Error decoding token: {e}")
            return {
                "success": False,
                "message": "Invalid token format received"
            }

        refresh_token_max_age = 86400
        if refresh_token:
            try:
                refresh_info = jwt.decode(refresh_token, options={"verify_signature": False})
                refresh_expiry = refresh_info.get("exp", 0)
                if refresh_expiry > 0:
                    refresh_token_max_age = max(0, refresh_expiry - current_time)
            except Exception as e:
                print(f"Error decoding refresh token, using default expiry: {e}")

        port = str(request.url.port or (443 if request.url.scheme == "https" else 80))

        response.set_cookie(
            key=f"p{port}_access_token",
            value=access_token,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="strict",
            max_age=access_token_max_age,
            path="/"
        )

        if refresh_token:
            response.set_cookie(
                key=f"p{port}_refresh_token",
                value=refresh_token,
                httponly=True,
                secure=request.url.scheme == "https",
                samesite="strict",
                max_age=refresh_token_max_age,
                path="/"
            )

        response.set_cookie(
            key=f"p{port}_username",
            value=user.username,
            httponly=False,
            secure=request.url.scheme == "https",
            samesite="strict",
            max_age=access_token_max_age,
            path="/"
        )

        if user_id:
            response.set_cookie(
                key=f"p{port}_user_id",
                value=str(user_id),
                httponly=False,
                secure=request.url.scheme == "https",
                samesite="strict",
                max_age=access_token_max_age,
                path="/"
            )

        return {
            "success": True,
            "message": "Login successful - secure cookies set",
            "user": {
                "username": user.username,
                "userId": user_id,
                "tokenExpiry": token_expiry
            },
            "token_type": token_type
        }

    except requests.exceptions.RequestException as e:
        print(f"Langflow connection error: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Could not connect to Langflow: {str(e)}"
        )
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/refresh-token")
async def refresh_token(request: Request, response: Response) -> Dict[str, Any]:
    """
    Refresh access token using httpOnly refresh token
    Frontend calls this when getting 401 errors
    """
    try:
        port = str(request.url.port or (443 if request.url.scheme == "https" else 80))
        refresh_token = request.cookies.get(f"p{port}_refresh_token")

        if not refresh_token:
            return {
                "success": False,
                "message": "No refresh token found",
                "should_login": True
            }

        refresh_url = f"{LANGFLOW_URL}/api/v1/refresh"

        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

        cookies = {
            'refresh_token_lf': refresh_token
        }

        langflow_response = requests.post(
            refresh_url,
            headers=headers,
            cookies=cookies
        )

        if not langflow_response.ok:
            return {
                "success": False,
                "message": "Refresh token expired or invalid",
                "should_login": True
            }

        token_data = langflow_response.json()
        new_access_token = token_data.get("access_token")
        new_refresh_token = token_data.get("refresh_token")

        if not new_access_token:
            return {
                "success": False,
                "message": "Invalid refresh response from Langflow",
                "should_login": True
            }

        try:
            user_info = jwt.decode(new_access_token, options={"verify_signature": False})
            user_id = user_info.get("sub") or user_info.get("user_id")
            token_expiry = user_info.get("exp", 0)

            current_time = int(time.time())
            access_token_max_age = max(0, token_expiry - current_time)

        except Exception as e:
            print(f"Error decoding refreshed token: {e}")
            return {
                "success": False,
                "message": "Invalid token format in refresh response",
                "should_login": True
            }

        refresh_token_max_age = 86400
        if new_refresh_token:
            try:
                refresh_info = jwt.decode(new_refresh_token, options={"verify_signature": False})
                refresh_expiry = refresh_info.get("exp", 0)
                if refresh_expiry > 0:
                    refresh_token_max_age = max(0, refresh_expiry - current_time)
            except Exception as e:
                print(f"Error decoding new refresh token, using default expiry: {e}")

        response.set_cookie(
            key=f"p{port}_access_token",
            value=new_access_token,
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="strict",
            max_age=access_token_max_age,
            path="/"
        )

        if new_refresh_token:
            response.set_cookie(
                key=f"p{port}_refresh_token",
                value=new_refresh_token,
                httponly=True,
                secure=request.url.scheme == "https",
                samesite="strict",
                max_age=refresh_token_max_age,
                path="/"
            )

        return {
            "success": True,
            "message": "Token refreshed successfully",
            "user": {
                "userId": user_id,
                "tokenExpiry": token_expiry
            }
        }

    except requests.exceptions.RequestException as e:
        print(f"Langflow refresh error: {e}")
        return {
            "success": False,
            "message": "Could not connect to Langflow for refresh",
            "should_login": True
        }
    except Exception as e:
        print(f"Token refresh error: {e}")
        return {
            "success": False,
            "message": f"Token refresh failed: {str(e)}",
            "should_login": True
        }


@router.post("/logout")
async def logout(request: Request, response: Response) -> Dict[str, Any]:
    """
    Logout user by calling Langflow logout endpoint and clearing ALL cookies
    """
    try:
        port = str(request.url.port or (443 if request.url.scheme == "https" else 80))
        access_token = request.cookies.get(f"p{port}_access_token")

        langflow_logout_success = False

        # Call Langflow logout endpoint first
        if access_token:
            try:
                logout_url = f"{LANGFLOW_URL}/api/v1/logout"
                payload = {}
                headers = {
                    'Accept': 'application/json',
                    'Authorization': f'Bearer {access_token}'
                }

                langflow_response = requests.post(logout_url, headers=headers, data=payload, timeout=5)

                if langflow_response.ok:
                    langflow_logout_success = True
                    print("Successfully logged out from Langflow")
                else:
                    print(f"Langflow logout failed with status: {langflow_response.status_code}")

            except requests.exceptions.RequestException as e:
                print(f"Error during Langflow logout: {e}")
            except Exception as e:
                print(f"Unexpected error during Langflow logout: {e}")

        all_cookies = request.cookies
        cookies_cleared = []

        for cookie_name in all_cookies.keys():
            response.set_cookie(
                key=cookie_name,
                value="",
                httponly=True,
                secure=request.url.scheme == "https",
                samesite="strict",
                max_age=0,
                path="/"
            )
            cookies_cleared.append(cookie_name)

        print(f"Cleared {len(cookies_cleared)} cookies: {cookies_cleared}")

        return {
            "success": True,
            "message": f"Logout completed - cleared {len(cookies_cleared)} cookies",
            "langflow_logout": langflow_logout_success,
            "cookies_cleared": len(cookies_cleared)
        }

    except Exception as e:
        print(f"Logout error: {e}")
        return {
            "success": True,
            "message": "Logout completed with errors"
        }


@router.get("/verify-auth")
async def verify_auth(request: Request) -> Dict[str, Any]:
    try:
        port = str(request.url.port or (443 if request.url.scheme == "https" else 80))
        access_token = request.cookies.get(f"p{port}_access_token")
        username = request.cookies.get(f"p{port}_username")
        user_id = request.cookies.get(f"p{port}_user_id")

        if not access_token:
            return {
                "authenticated": False,
                "message": "No access token found"
            }

        try:
            user_info = jwt.decode(access_token, options={"verify_signature": False})
            token_expiry = user_info.get("exp", 0)
            current_time = int(time.time())

            if token_expiry <= current_time:
                return {
                    "authenticated": False,
                    "message": "Access token expired"
                }

            return {
                "authenticated": True,
                "user": {
                    "username": username,
                    "userId": user_id,
                    "tokenExpiry": token_expiry
                },
                "message": "User is authenticated"
            }

        except Exception as e:
            print(f"Error decoding token in verify_auth: {e}")
            return {
                "authenticated": False,
                "message": "Invalid access token"
            }

    except Exception as e:
        print(f"Auth verification error: {e}")
        return {
            "authenticated": False,
            "message": "Authentication verification failed"
        }


@router.get("/auth-status")
async def get_auth_status(request: Request) -> Dict[str, Any]:
    try:
        port = str(request.url.port or (443 if request.url.scheme == "https" else 80))
        access_token = request.cookies.get(f"p{port}_access_token")
        refresh_token = request.cookies.get(f"p{port}_refresh_token")
        username = request.cookies.get(f"p{port}_username")
        user_id = request.cookies.get(f"p{port}_user_id")

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

        try:
            user_info = jwt.decode(access_token, options={"verify_signature": False})
            access_token_expiry = user_info.get("exp", 0)
            current_time = int(time.time())

            access_token_valid = access_token_expiry > current_time

            refresh_token_valid = False
            refresh_token_expiry = None
            if refresh_token:
                try:
                    refresh_info = jwt.decode(refresh_token, options={"verify_signature": False})
                    refresh_token_expiry = refresh_info.get("exp", 0)
                    refresh_token_valid = refresh_token_expiry > current_time
                except Exception as e:
                    print(f"Error decoding refresh token: {e}")

            is_authenticated = access_token_valid or refresh_token_valid

            return {
                "authenticated": is_authenticated,
                "user": {
                    "username": username,
                    "userId": user_id,
                    "tokenExpiry": access_token_expiry
                } if is_authenticated else None,
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

        except Exception as e:
            print(f"Error decoding tokens in auth_status: {e}")
            return {
                "authenticated": False,
                "user": None,
                "tokens": {
                    "hasAccessToken": bool(access_token),
                    "hasRefreshToken": bool(refresh_token),
                    "accessTokenValid": False,
                    "refreshTokenValid": False
                },
                "message": "Invalid token format"
            }

    except Exception as e:
        print(f"Auth status error: {e}")
        return {
            "authenticated": False,
            "user": None,
            "tokens": {
                "hasAccessToken": False,
                "hasRefreshToken": False
            },
            "message": "Failed to get authentication status"
        }


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
