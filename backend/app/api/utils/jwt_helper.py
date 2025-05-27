from fastapi import Request
import jwt
from typing import Optional


def is_valid_langflow_jwt(token: str) -> bool:
    """
    Check if token is a valid Langflow JWT with type 'access'
    """
    try:
        # Decode without verification to check structure
        decoded = jwt.decode(token, options={"verify_signature": False})

        # Check if it has the required fields for Langflow access token
        has_sub = "sub" in decoded
        has_type = decoded.get("type") == "access"
        has_exp = "exp" in decoded

        return has_sub and has_type and has_exp

    except Exception as e:
        print(f"Error checking JWT: {e}")
        return False


def get_user_token(request: Request) -> Optional[str]:
    """
    Smart JWT extraction - finds the correct Langflow access token from cookies
    """
    try:
        # Get all cookies
        all_cookies = request.cookies

        print(f"Found {len(all_cookies)} cookies")

        # Look through all cookies to find a valid Langflow JWT
        for cookie_name, cookie_value in all_cookies.items():
            print(f"Checking cookie: {cookie_name}")

            # Skip obviously non-JWT cookies
            if not cookie_value or len(cookie_value) < 50:
                continue

            # Check if this looks like a JWT (has 3 parts separated by dots)
            if cookie_value.count('.') != 2:
                continue

            # Validate if it's a Langflow access token
            if is_valid_langflow_jwt(cookie_value):
                print(f"Found valid Langflow JWT in cookie: {cookie_name}")
                return cookie_value

        print("No valid Langflow JWT found in cookies")
        return None

    except Exception as e:
        print(f"Error extracting user token: {e}")
        return None
