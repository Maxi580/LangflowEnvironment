from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
import os
import jwt
import time
from typing import Optional

LANGFLOW_EXTERNAL_URL = os.getenv("LANGFLOW_EXTERNAL_URL", "http://localhost:7860")
redirect_router = APIRouter(prefix="/api/redirect", tags=["redirect"])


def find_token_in_cookies(request: Request) -> tuple[Optional[str], Optional[str]]:
    access_token = None
    refresh_token = None

    for cookie_name, cookie_value in request.cookies.items():
        if "access_token" in cookie_name and not access_token:
            access_token = cookie_value
        elif "refresh_token" in cookie_name and not refresh_token:
            refresh_token = cookie_value

    return access_token, refresh_token


def get_token_max_age(token: str) -> int:
    try:
        token_info = jwt.decode(token, options={"verify_signature": False})
        token_expiry = token_info.get("exp", 0)
        current_time = int(time.time())
        return max(0, token_expiry - current_time)
    except:
        return 0


@redirect_router.get("/redirect-langflow")
async def redirect_to_langflow(
        request: Request,
        redirect_url: Optional[str] = None
):
    """Redirect to Langflow with automatic login"""
    access_token, refresh_token = find_token_in_cookies(request)

    if not access_token or not refresh_token:
        return RedirectResponse(url="/login", status_code=302)

    access_token_max_age = get_token_max_age(access_token)
    if access_token_max_age < 60:  # Less than 1 minute left
        return RedirectResponse(url="/login", status_code=302)

    target_url = redirect_url or f"{LANGFLOW_EXTERNAL_URL}/"

    redirect_response = RedirectResponse(url=target_url, status_code=302)

    cookie_config = {
        "path": "/",
        "secure": request.url.scheme == "https",
        "httponly": False,
        "samesite": "lax",
        "max_age": access_token_max_age
    }

    redirect_response.set_cookie(key="access_token_lf", value=access_token, **cookie_config)
    redirect_response.set_cookie(key="auto_login_lf", value="login", **cookie_config)
    redirect_response.set_cookie(key="apikey_tkn_lflw", value="None", **cookie_config)
    redirect_response.set_cookie(key="sidebarstate", value="true", **cookie_config)

    refresh_token_max_age = get_token_max_age(refresh_token)
    if refresh_token_max_age > 0:
        refresh_config = cookie_config.copy()
        refresh_config["max_age"] = refresh_token_max_age
        refresh_config["httponly"] = True
        redirect_response.set_cookie(key="refresh_token_lf", value=refresh_token, **refresh_config)

    return redirect_response
