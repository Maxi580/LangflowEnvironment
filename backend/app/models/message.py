from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class MessageRequest(BaseModel):
    message: str
    flow_id: str
    session_id: Optional[str] = None


class GeneratedFileData(BaseModel):
    filename: str
    content_type: str
    size: int
    base64_data: str


class MessageResponse(BaseModel):
    success: bool
    response: str
    generated_files: List[Optional[GeneratedFileData]] = []
    session_id: str
    flow_id: str
    error: Optional[str] = None
    timestamp: Optional[datetime] = None


class LangflowMessageResponse(BaseModel):
    extracted_message: str
    generated_files: List[Optional[GeneratedFileData]] = []


class ChatSession(BaseModel):
    """Chat session information"""
    session_id: str
    flow_id: str
    user_id: Optional[str] = None
    created_at: datetime
    last_message_at: Optional[datetime] = None
    message_count: int = 0
    status: str = "active"


class SessionInfo(BaseModel):
    """Session information response"""
    session_id: str
    status: str
    message: str
    created_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None


class SessionEndResult(BaseModel):
    """Result of ending a session"""
    success: bool
    session_id: str
    message: str
    final_message_count: int = 0


class UserSessionsResponse(BaseModel):
    """Response for listing user sessions"""
    success: bool
    sessions: List[Dict[str, Any]]
    total_sessions: int
