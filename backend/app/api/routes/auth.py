from fastapi import APIRouter, Cookie, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from typing import Optional
import os

LANGFLOW_EXTERNAL_URL = os.getenv("LANGFLOW_EXTERNAL_URL", "http://localhost:7860")

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/redirect-langflow")
async def redirect_to_langflow(
        redirect_url: Optional[str] = Query(None, description="Target URL in Langflow"),
        open_new_tab: Optional[bool] = Query(False, description="Open in new tab"),
        access_token: Optional[str] = Cookie(None, alias="access_token"),
        refresh_token: Optional[str] = Cookie(None, alias="refresh_token")
):
    """
    Redirect to Langflow with automatic authentication via cookies.
    This implements an SSO-like flow where users authenticate once with the backend
    and get seamlessly redirected to Langflow already logged in.
    """
    target_url = redirect_url or f"{LANGFLOW_EXTERNAL_URL}/"

    # If opening in new tab, return HTML with JavaScript
    if open_new_tab:
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Redirecting to Langflow...</title>
            <script>
                // Set cookies before opening new tab
                {f'document.cookie = "access_token_lf={access_token}; path=/; samesite=lax";' if access_token else ''}
                {f'document.cookie = "refresh_token_lf={refresh_token}; path=/; samesite=lax; httponly";' if refresh_token else ''}
                document.cookie = "auto_login_lf=login; path=/; samesite=lax";
                document.cookie = "apikey_tkn_lflw=None; path=/; samesite=lax";
                document.cookie = "sidebarstate=true; path=/; samesite=lax";

                // Open new tab
                window.open('{target_url}', '_blank');

                // Close current tab or show success message
                document.body.innerHTML = '<div style="text-align:center; margin-top:50px;"><h2>Langflow opened in new tab!</h2><p>You can close this window.</p></div>';
            </script>
        </head>
        <body>
            <div style="text-align:center; margin-top:50px;">
                <h2>Opening Langflow...</h2>
                <p>If the new tab doesn't open automatically, <a href="{target_url}" target="_blank">click here</a></p>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)

    # Traditional redirect (same tab)
    redirect_response = RedirectResponse(url=target_url, status_code=302)

    if access_token:
        print("Setting authentication cookies for Langflow SSO")

        # More secure cookie settings
        redirect_response.set_cookie(
            key="access_token_lf",
            value=access_token,
            path="/",
            secure=False,  # Set to True in production with HTTPS
            httponly=True,  # Prevent XSS attacks
            samesite="lax",
            max_age=3600  # 1 hour expiry
        )

        # Auto-login flag
        redirect_response.set_cookie(
            key="auto_login_lf",
            value="login",
            path="/",
            secure=False,
            httponly=False,
            samesite="lax"
        )

        # Langflow specific cookies
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
        print("No access_token found - user may need to login to Langflow manually")

    if refresh_token:
        redirect_response.set_cookie(
            key="refresh_token_lf",
            value=refresh_token,
            path="/",
            secure=False,  # Set to True in production
            httponly=True,  # Always httponly for refresh tokens
            samesite="lax",
            max_age=86400  # 24 hours
        )

    return redirect_response


@router.get("/langflow-sso-url")
async def get_langflow_sso_url(
        redirect_url: Optional[str] = Query(None),
        access_token: Optional[str] = Cookie(None, alias="access_token")
) -> dict:
    """
    Alternative approach: Return the URL with token as query parameter
    for client-side handling (less secure but more flexible)
    """
    target_url = redirect_url or f"{LANGFLOW_EXTERNAL_URL}/"

    if access_token:
        # Add token as query parameter (use with caution)
        separator = "&" if "?" in target_url else "?"
        target_url = f"{target_url}{separator}token={access_token}"

    return {
        "url": target_url,
        "authenticated": bool(access_token),
        "message": "Open this URL in a new tab for authenticated access"
    }