from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
import os

from ...services.redirect_service import RedirectService

REDIRECT_BASE_ENDPOINT = os.getenv("REDIRECT_BASE_ENDPOINT")
REDIRECT_LANGFLOW_ENDPOINT = os.getenv("REDIRECT_LANGFLOW_ENDPOINT")

router = APIRouter(prefix=REDIRECT_BASE_ENDPOINT, tags=["redirect"])
redirect_service = RedirectService()


@router.get(REDIRECT_LANGFLOW_ENDPOINT)
async def redirect_to_langflow(request: Request) -> RedirectResponse:
    """Redirect to Langflow with automatic login"""
    return await redirect_service.create_langflow_redirect(request)