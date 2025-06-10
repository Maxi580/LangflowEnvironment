from fastapi import Request
import jwt
import time
from typing import Optional, Tuple, Dict, Any


def _is_valid_langflow_token(token: str, token_type: str) -> bool:
    """
    Check if token is a valid Langflow JWT with specified type
    """
    try:
        # Decode without verification to check structure
        decoded = jwt.decode(token, options={"verify_signature": False})

        # Check if it has the required fields for Langflow token
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


def get_user_id_from_token(token: str) -> Optional[str]:
    """
    Extract user ID from JWT token

    Args:
        token: JWT token string

    Returns:
        User ID string if found, None otherwise
    """
    try:
        decoded = jwt.decode(token, options={"verify_signature": False})
        user_id = decoded.get("sub")

        if user_id:
            print(f"Extracted user ID: {user_id}")
            return user_id
        else:
            print("No 'sub' field found in token")
            return None

    except Exception as e:
        print(f"Error extracting user ID from token: {e}")
        return None


def get_user_id_from_request(request: Request) -> Optional[str]:
    """
    Extract user ID from request by getting access token first

    Args:
        request: FastAPI request object

    Returns:
        User ID string if found, None otherwise
    """
    access_token = get_user_token(request)
    if not access_token:
        print("No access token found in request")
        return None

    return get_user_id_from_token(access_token)


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

        # Calculate time remaining
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
