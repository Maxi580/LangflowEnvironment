from pydantic import BaseModel
from typing import Optional


class LangflowRedirectConfig(BaseModel):
    """Configuration for Langflow redirect with auto-login"""
    access_token: str
    refresh_token: Optional[str] = None
    access_token_max_age: int
    refresh_token_max_age: Optional[int] = None
    target_url: str


class RedirectResult(BaseModel):
    """Result of redirect analysis"""
    should_auto_login: bool
    reason: str
    config: Optional[LangflowRedirectConfig] = None


class RedirectValidation(BaseModel):
    """Validation result for redirect permissions"""
    can_redirect: bool
    reason: str
    has_valid_tokens: bool = False
    token_expiry_seconds: Optional[int] = None
