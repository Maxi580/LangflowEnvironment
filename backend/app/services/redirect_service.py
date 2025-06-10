import os
from fastapi import Request
from fastapi.responses import RedirectResponse

from ..models.redirect import RedirectResult, LangflowRedirectConfig
from ..utils.jwt_helper import get_user_tokens, get_token_max_age

LANGFLOW_URL = os.getenv("LANGFLOW_URL")
MINIMUM_TOKEN_VALIDITY = 60


class RedirectService:
    def __init__(self):
        self.langflow_url = LANGFLOW_URL

    async def create_langflow_redirect(self, request: Request) -> RedirectResponse:
        """Create a redirect response to Langflow with automatic login setup"""

        # Analyze user tokens and determine redirect strategy
        redirect_result = await self._analyze_redirect_requirements(request)

        if not redirect_result.should_auto_login:
            # Simple redirect without auto-login
            return self._create_simple_redirect()

        # Create redirect with auto-login cookies
        return self._create_auto_login_redirect(request, redirect_result.config)

    async def _analyze_redirect_requirements(self, request: Request) -> RedirectResult:
        """Analyze user tokens and determine what kind of redirect to create"""
        access_token, refresh_token = get_user_tokens(request)

        # No tokens - simple redirect
        if not access_token or not refresh_token:
            return RedirectResult(
                should_auto_login=False,
                reason="No valid tokens found",
                config=None
            )

        # Check token validity
        access_token_max_age = get_token_max_age(access_token)
        if access_token_max_age < MINIMUM_TOKEN_VALIDITY:
            return RedirectResult(
                should_auto_login=False,
                reason=f"Access token expires too soon ({access_token_max_age}s remaining)",
                config=None
            )

        # Tokens are valid - prepare auto-login
        refresh_token_max_age = get_token_max_age(refresh_token)

        config = LangflowRedirectConfig(
            access_token=access_token,
            refresh_token=refresh_token if refresh_token_max_age > 0 else None,
            access_token_max_age=access_token_max_age,
            refresh_token_max_age=refresh_token_max_age if refresh_token_max_age > 0 else None,
            target_url=f"{self.langflow_url}/"
        )

        return RedirectResult(
            should_auto_login=True,
            reason="Valid tokens found",
            config=config
        )

    def _create_simple_redirect(self) -> RedirectResponse:
        """Create a simple redirect without auto-login"""
        target_url = f"{self.langflow_url}/"
        return RedirectResponse(url=target_url, status_code=302)

    def _create_auto_login_redirect(self, request: Request, config: LangflowRedirectConfig) -> RedirectResponse:
        """Create a redirect with auto-login cookies"""
        redirect_response = RedirectResponse(url=config.target_url, status_code=302)

        # Set auto-login cookies
        self._set_langflow_auto_login_cookies(redirect_response, request, config)

        return redirect_response

    def _set_langflow_auto_login_cookies(self, response: RedirectResponse,
                                         request: Request, config: LangflowRedirectConfig):
        """Set the necessary cookies for Langflow auto-login"""

        # Base cookie configuration
        base_cookie_config = {
            "path": "/",
            "secure": request.url.scheme == "https",
            "samesite": "lax"
        }

        # Access token cookie (not httponly so Langflow frontend can read it)
        access_cookie_config = {
            **base_cookie_config,
            "httponly": False,
            "max_age": config.access_token_max_age
        }

        response.set_cookie(
            key="access_token_lf",
            value=config.access_token,
            **access_cookie_config
        )

        # Auto-login flag cookie
        response.set_cookie(
            key="auto_login_lf",
            value="login",
            **access_cookie_config
        )

        # Sidebar state cookie (UX preference)
        response.set_cookie(
            key="sidebarstate",
            value="true",
            **access_cookie_config
        )

        # Refresh token cookie (httponly for security)
        if config.refresh_token and config.refresh_token_max_age:
            refresh_cookie_config = {
                **base_cookie_config,
                "httponly": True,
                "max_age": config.refresh_token_max_age
            }

            response.set_cookie(
                key="refresh_token_lf",
                value=config.refresh_token,
                **refresh_cookie_config
            )

    def get_langflow_url(self) -> str:
        """Get the configured Langflow URL"""
        return self.langflow_url

    async def validate_redirect_permissions(self, request: Request) -> bool:
        """Validate if user has permission to redirect to Langflow"""
        # Could add additional permission checks here if needed
        # For now, anyone with valid tokens can redirect
        access_token, _ = get_user_tokens(request)
        return access_token is not None
