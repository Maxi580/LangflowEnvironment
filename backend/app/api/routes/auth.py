from fastapi import APIRouter, Response, Cookie
from fastapi.responses import RedirectResponse
import os
from typing import Optional

LANGFLOW_EXTERNAL_URL = os.getenv("LANGFLOW_EXTERNAL_URL", "http://localhost:7860")
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/test-cookies")
async def test_cookies(
        access_token: Optional[str] = Cookie(None, alias="access_token"),
        refresh_token: Optional[str] = Cookie(None, alias="refresh_token")
):
    return {
        "access_token_received": access_token is not None,
        "refresh_token_received": refresh_token is not None,
        "access_token_preview": access_token[:50] + "..." if access_token else None,
        "refresh_token_preview": refresh_token[:50] + "..." if refresh_token else None,
    }


@router.get("/redirect-langflow")
async def redirect_to_langflow(
        redirect_url: Optional[str] = None,
        access_token: Optional[str] = Cookie(None, alias="access_token"),
        refresh_token: Optional[str] = Cookie(None, alias="refresh_token")
):
    target_url = redirect_url or f"{LANGFLOW_EXTERNAL_URL}/"

    redirect_response = RedirectResponse(url=target_url, status_code=302)

    if access_token:
        print(f"Setting cookies for access_token: {access_token[:20]}...")

        redirect_response.set_cookie(
            key="access_token_lf",
            value=access_token,
            path="/",
            secure=False,
            httponly=False,
            samesite="lax"
        )

        redirect_response.set_cookie(
            key="auto_login_lf",
            value="login",
            path="/",
            secure=False,
            httponly=False,
            samesite="lax"
        )

        redirect_response.set_cookie(
            key="apikey_tkn_lflw",
            value="None",
            path="/",
            secure=False,
            httponly=False,
            samesite="lax"
        )

        redirect_response.set_cookie(
            key="sidebarstate",
            value="true",
            path="/",
            secure=False,
            httponly=False,
            samesite="lax"
        )
    else:
        print("No access_token found in cookies")

    if refresh_token:
        print(f"Setting refresh_token: {refresh_token[:20]}...")
        redirect_response.set_cookie(
            key="refresh_token_lf",
            value=refresh_token,
            path="/",
            secure=False,
            httponly=True,
            samesite="lax"
        )
    else:
        print("No refresh_token found in cookies")

    return redirect_response
