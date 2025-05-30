from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from ..utils.jwt_helper import get_user_tokens, get_token_max_age
import os
from typing import Optional

LANGFLOW_EXTERNAL_URL = os.getenv("LANGFLOW_EXTERNAL_URL")
REDIRECT_BASE_ENDPOINT = os.getenv("REDIRECT_BASE_ENDPOINT")
REDIRECT_LANGFLOW_ENDPOINT = os.getenv("REDIRECT_LANGFLOW_ENDPOINT")

router = APIRouter(prefix=REDIRECT_BASE_ENDPOINT, tags=["redirect"])


@router.get(REDIRECT_LANGFLOW_ENDPOINT)
async def redirect_to_langflow(
        request: Request,
        redirect_url: Optional[str] = None
):
    """Redirect to Langflow with automatic login"""
    access_token, refresh_token = get_user_tokens(request)

    if not access_token or not refresh_token:
        return RedirectResponse(url="/login", status_code=302)

    access_token_max_age = get_token_max_age(access_token)
    if access_token_max_age < 60:
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