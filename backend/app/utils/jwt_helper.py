from fastapi import Request
import jwt
import time
import os
from typing import Optional, Tuple, Dict, Any
from ..external.langflow_repository import LangflowRepository

_admin_token_cache: Dict[str, Any] = {"token": None, "expiry": 0}

SUPERUSER_USERNAME = os.getenv("BACKEND_LF_USERNAME")
SUPERUSER_PASSWORD = os.getenv("BACKEND_LF_PASSWORD")
TOKEN_EXPIRY_BUFFER = 300


def _is_valid_langflow_token(token: str, token_type: str) -> bool:
    """
    Check if token is a valid Langflow JWT with specified type
    """
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})

        has_sub = "sub" in decoded
        has_type = decoded.get("type") == token_type
        has_exp = "exp" in decoded

        return has_sub and has_type and has_exp

    except Exception as e:
        print(f"Error checking {token_type} JWT: {e}")
        return False


def get_user_tokens(request: Request) -> Tuple[Optional[str], Optional[str]]:
    """
    Smart JWT extraction - finds both access and refresh Langflow tokens from cookies
    Returns: (access_token, refresh_token)
    """
    access_token = None
    refresh_token = None

    try:
        all_cookies = request.cookies
        print(f"Found {len(all_cookies)} cookies")

        # Look through all cookies to find valid Langflow JWTs
        for cookie_name, cookie_value in all_cookies.items():
            print(f"Checking cookie: {cookie_name}")

            # Skip obviously non-JWT cookies
            if not cookie_value or len(cookie_value) < 50:
                continue

            # Check if this looks like a JWT (has 3 parts separated by dots)
            if cookie_value.count('.') != 2:
                continue

            # Check for access token
            if not access_token and _is_valid_langflow_token(cookie_value, "access"):
                print(f"Found valid Langflow access JWT in cookie: {cookie_name}")
                access_token = cookie_value

            # Check for refresh token
            elif not refresh_token and _is_valid_langflow_token(cookie_value, "refresh"):
                print(f"Found valid Langflow refresh JWT in cookie: {cookie_name}")
                refresh_token = cookie_value

            # Stop searching if we found both tokens
            if access_token and refresh_token:
                break

        if not access_token:
            print("No valid Langflow access JWT found in cookies")
        if not refresh_token:
            print("No valid Langflow refresh JWT found in cookies")

        return access_token, refresh_token

    except Exception as e:
        print(f"Error extracting user tokens: {e}")
        return None, None


def get_token_max_age(token: str) -> int:
    """
    Calculate the remaining time in seconds until token expires
    """
    try:
        token_info = jwt.decode(token, options={"verify_signature": False})
        token_expiry = token_info.get("exp", 0)
        current_time = int(time.time())
        return max(0, token_expiry - current_time)
    except:
        return 0


def get_token_expiry(token: str) -> int:
    """
    Get the expiry timestamp from a token
    """
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get("exp", 0)
    except Exception as e:
        print(f"Error decoding token: {e}")
        return 0


def get_user_token(request: Request) -> Optional[str]:
    """
    Legacy function for backward compatibility - returns only access token
    """
    access_token, _ = get_user_tokens(request)
    return access_token


async def get_user_id_from_token(token: str) -> Optional[str]:
    try:
        langflow_repo = LangflowRepository()
        user_data = await langflow_repo.get_current_user(token)

        user_id = user_data.get("id") or user_data.get("sub")
        print(f"USER_ID FROM TOKEN: {user_id}")

        if user_id:
            print(f"Successfully validated user ID: {user_id}")
            return str(user_id)
        else:
            print("No user ID found in Langflow response")
            return None

    except Exception as e:
        print(f"Error validating user ID with Langflow: {e}")
        return None


async def get_user_id_from_request(request: Request) -> Optional[str]:
    access_token = get_user_token(request)
    if not access_token:
        return None

    try:
        return await get_user_id_from_token(access_token)

    except Exception as e:
        print(f"Error getting user info: {e}")
        return None


def get_token_info(token: str) -> Optional[Dict[str, Any]]:
    """
    Get all information from a JWT token

    Args:
        token: JWT token string

    Returns:
        Dictionary with token information, None if invalid
    """
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})

        current_time = int(time.time())
        exp_time = decoded.get("exp", 0)
        time_remaining = max(0, exp_time - current_time)

        return {
            "user_id": decoded.get("sub"),
            "token_type": decoded.get("type"),
            "expires_at": exp_time,
            "time_remaining_seconds": time_remaining,
            "is_expired": time_remaining == 0,
            "raw_payload": decoded
        }

    except Exception as e:
        print(f"Error getting token info: {e}")
        return None


def get_user_info_from_request(request: Request) -> Optional[Dict[str, Any]]:
    """
    Extract comprehensive user information from request

    Args:
        request: FastAPI request object

    Returns:
        Dictionary with user information, None if no valid token
    """
    access_token, refresh_token = get_user_tokens(request)

    if not access_token:
        return None

    access_info = get_token_info(access_token)
    if not access_info:
        return None

    result = {
        "user_id": access_info["user_id"],
        "access_token_info": access_info,
        "has_refresh_token": refresh_token is not None
    }

    # Add refresh token info if available
    if refresh_token:
        refresh_info = get_token_info(refresh_token)
        if refresh_info:
            result["refresh_token_info"] = refresh_info

    return result


def is_token_valid(token: str, min_time_remaining: int = 0) -> bool:
    """
    Check if a token is valid and not expired

    Args:
        token: JWT token string
        min_time_remaining: Minimum seconds that must remain before expiry

    Returns:
        True if token is valid and has enough time remaining
    """
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})

        if not decoded.get("sub") or not decoded.get("exp"):
            return False

        current_time = int(time.time())
        exp_time = decoded.get("exp", 0)
        time_remaining = exp_time - current_time

        return time_remaining > min_time_remaining

    except Exception:
        return False


async def get_admin_token(langflow_repo) -> str:
    """
    Get cached admin token or create new one

    Args:
        langflow_repo: LangflowRepository instance to use for authentication

    Returns:
        Admin access token

    Raises:
        ValueError: If admin credentials are not configured or authentication fails
    """
    global _admin_token_cache

    if not SUPERUSER_USERNAME or not SUPERUSER_PASSWORD:
        raise ValueError("Admin credentials not configured. Set BACKEND_LF_USERNAME and BACKEND_LF_PASSWORD")

    current_time = time.time()

    if (_admin_token_cache["token"] and
            _admin_token_cache["expiry"] > current_time + TOKEN_EXPIRY_BUFFER):
        return _admin_token_cache["token"]

    token_data = await langflow_repo.authenticate_user(
        SUPERUSER_USERNAME, SUPERUSER_PASSWORD
    )

    access_token = token_data.get("access_token")
    if not access_token:
        raise ValueError("Admin authentication failed")

    expiry = get_token_expiry(access_token)
    _admin_token_cache["token"] = access_token
    _admin_token_cache["expiry"] = expiry

    print(f"New admin token obtained, expires in {int((expiry - current_time) / 60)} minutes")
    return access_token


def clear_admin_token_cache():
    """Clear the cached admin token"""
    global _admin_token_cache
    _admin_token_cache = {"token": None, "expiry": 0}
    print("Admin token cache cleared")


def get_admin_token_info() -> Dict[str, Any]:
    """
    Get information about the currently cached admin token

    Returns:
        Dictionary with admin token information
    """
    global _admin_token_cache
    current_time = time.time()

    if not _admin_token_cache["token"]:
        return {
            "has_token": False,
            "message": "No admin token cached"
        }

    time_remaining = max(0, _admin_token_cache["expiry"] - current_time)
    is_valid = time_remaining > TOKEN_EXPIRY_BUFFER

    return {
        "has_token": True,
        "is_valid": is_valid,
        "expires_at": _admin_token_cache["expiry"],
        "time_remaining_seconds": int(time_remaining),
        "time_remaining_minutes": int(time_remaining / 60),
        "will_refresh_in_seconds": int(
            time_remaining - TOKEN_EXPIRY_BUFFER) if time_remaining > TOKEN_EXPIRY_BUFFER else 0
    }
