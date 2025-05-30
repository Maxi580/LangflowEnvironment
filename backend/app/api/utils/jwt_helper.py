from fastapi import Request
import jwt
import time
from typing import Optional, Tuple


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
