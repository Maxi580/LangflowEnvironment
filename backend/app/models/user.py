from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    """Request model for creating a new user"""
    username: str
    password: str


class User(BaseModel):
    """User data model"""
    id: str
    username: str
    is_active: bool = True
    is_superuser: bool = False
    created_at: Optional[datetime] = None


class UserLogin(BaseModel):
    """Request model for user login"""
    username: str
    password: str


class UserTokens(BaseModel):
    """Token information for authenticated user"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_at: Optional[int] = None


class AuthenticatedUser(BaseModel):
    """Complete user info with authentication data"""
    user: User
    tokens: UserTokens


class UserSession(BaseModel):
    """User session information"""
    user_id: str
    username: str
    token_expiry: int
    is_authenticated: bool = True


class UserDeletionResult(BaseModel):
    """Result of user deletion with cleanup info"""
    success: bool
    user_id: str
    flows_found: int = 0
    collections_deleted: int = 0
    deleted_collections: list = []
    cleanup_errors: list = []
    message: str = ""
