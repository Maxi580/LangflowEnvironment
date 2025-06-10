import time
import os
from typing import Dict, Any, List
from datetime import datetime
from fastapi import Request

from ..services.flow_service import FlowService
from ..repositories.langflow_repository import LangflowRepository
from ..models.message import MessageRequest, MessageResponse, SessionInfo, ChatSession
from ..utils.jwt_helper import get_user_id_from_request, get_user_info_from_request


class MessageService:
    def __init__(self):
        self.flow_service = FlowService()
        self.langflow_repo = LangflowRepository()
        # Sessions organized by user_id for proper multi-user support
        self._active_sessions: Dict[str, Dict[str, ChatSession]] = {}

    async def send_message_to_flow(self, request: Request, message_request: MessageRequest) -> MessageResponse:
        """Send a message to a flow and return the response"""
        await self._validate_message_request(request, message_request)

        user_id = get_user_id_from_request(request)
        if not user_id:
            raise ValueError("Unable to extract user ID from authentication token")

        session_id = message_request.session_id or self._generate_session_id()

        try:
            payload = await self.flow_service.prepare_flow_execution_payload(
                request=request,
                flow_id=message_request.flow_id,
                message=message_request.message,
                session_id=session_id
            )

            execution_result = await self.flow_service.execute_flow(
                request=request,
                flow_id=message_request.flow_id,
                payload=payload
            )

            await self._update_session_info(
                session_id=session_id,
                flow_id=message_request.flow_id,
                user_id=user_id,
                request=request
            )

            response = MessageResponse(
                success=True,
                response=execution_result.response,
                session_id=session_id,
                flow_id=message_request.flow_id,
                raw_response=execution_result.raw_response,
                timestamp=datetime.utcnow()
            )

            print(
                f"Successfully processed message for user {user_id}, flow {message_request.flow_id}, session {session_id}")
            return response

        except Exception as e:
            error_response = MessageResponse(
                success=False,
                response="I apologize, but I encountered an error processing your message. Please try again.",
                session_id=session_id,
                flow_id=message_request.flow_id,
                error=str(e),
                timestamp=datetime.utcnow()
            )

            print(f"Error processing message for user {user_id}, flow {message_request.flow_id}: {e}")

            if "authentication" in str(e).lower():
                raise ValueError(f"Authentication failed: {str(e)}")
            elif "not found" in str(e).lower():
                raise ValueError(f"Flow not found: {str(e)}")
            elif "access denied" in str(e).lower():
                raise ValueError(f"Access denied: {str(e)}")
            elif "timeout" in str(e).lower():
                raise TimeoutError(f"Request timed out: {str(e)}")
            elif "connect" in str(e).lower():
                raise ConnectionError(f"Connection failed: {str(e)}")
            else:
                raise Exception(f"Message processing failed: {str(e)}")

    async def get_session_information(self, request: Request, session_id: str) -> SessionInfo:
        """Get information about a specific chat session (user-scoped)"""
        user_id = get_user_id_from_request(request)
        if not user_id:
            raise ValueError("No valid authentication token found")

        # Check if user has this session
        user_sessions = self._active_sessions.get(user_id, {})
        session = user_sessions.get(session_id)

        if session:
            # Verify session belongs to this user
            if session.user_id != user_id:
                raise ValueError(f"Access denied: Session '{session_id}' does not belong to current user")

            return SessionInfo(
                session_id=session_id,
                status=session.status,
                message="Session information retrieved",
                created_at=session.created_at,
                last_activity=session.last_message_at
            )
        else:
            # Session not found for this user
            raise ValueError(f"Session '{session_id}' not found")

    async def get_user_sessions(self, request: Request) -> List[Dict[str, Any]]:
        """Get all active sessions for the current user"""
        user_id = get_user_id_from_request(request)
        if not user_id:
            raise ValueError("No valid authentication token found")

        # Get sessions for this specific user
        user_sessions = self._active_sessions.get(user_id, {})

        sessions_list = []
        for session_id, session in user_sessions.items():
            sessions_list.append({
                "session_id": session_id,
                "flow_id": session.flow_id,
                "status": session.status,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "last_message_at": session.last_message_at.isoformat() if session.last_message_at else None,
                "message_count": session.message_count
            })

        print(f"Retrieved {len(sessions_list)} sessions for user {user_id}")
        return sessions_list

    async def end_chat_session(self, request: Request, session_id: str) -> SessionInfo:
        """End a specific chat session (user-scoped)"""
        user_id = get_user_id_from_request(request)
        if not user_id:
            raise ValueError("No valid authentication token found")

        # Check if user has this session
        user_sessions = self._active_sessions.get(user_id, {})
        session = user_sessions.get(session_id)

        if not session:
            raise ValueError(f"Session '{session_id}' not found")

        # Verify session belongs to this user
        if session.user_id != user_id:
            raise ValueError(f"Access denied: Session '{session_id}' does not belong to current user")

        # Mark session as ended
        session.status = "ended"
        session.last_message_at = datetime.utcnow()

        print(f"Ended session {session_id} for user {user_id}")

        return SessionInfo(
            session_id=session_id,
            status="ended",
            message="Session ended successfully",
            created_at=session.created_at,
            last_activity=session.last_message_at
        )

    async def _validate_message_request(self, request: Request, message_request: MessageRequest):
        """Validate the message request"""
        # Check authentication and extract user info
        user_info = get_user_info_from_request(request)
        if not user_info or not user_info.get("user_id"):
            raise ValueError("No valid authentication token found")

        # Check if token is not expired
        access_info = user_info.get("access_token_info", {})
        if access_info.get("is_expired", True):
            raise ValueError("Authentication token has expired")

        # Validate message content
        if not message_request.message or not message_request.message.strip():
            raise ValueError("Message cannot be empty")

        # Validate flow ID
        if not message_request.flow_id:
            raise ValueError("Flow ID is required")

        # Verify user has access to the flow
        has_access = await self.flow_service.validate_user_flow_access(request, message_request.flow_id)
        if not has_access:
            raise ValueError(f"Access denied: You don't have permission to use flow '{message_request.flow_id}'")

    def _generate_session_id(self) -> str:
        """Generate a unique session ID"""
        timestamp = int(time.time())
        random_part = os.urandom(4).hex()
        return f"session_{timestamp}_{random_part}"

    async def _update_session_info(self, session_id: str, flow_id: str, user_id: str, request: Request):
        """Update or create session tracking information with proper user association"""
        current_time = datetime.utcnow()

        if user_id not in self._active_sessions:
            self._active_sessions[user_id] = {}

        user_sessions = self._active_sessions[user_id]

        if session_id in user_sessions:
            session = user_sessions[session_id]
            session.last_message_at = current_time
            session.message_count += 1
            print(f"Updated session {session_id} for user {user_id} (message #{session.message_count})")
        else:
            session = ChatSession(
                session_id=session_id,
                flow_id=flow_id,
                user_id=user_id,
                created_at=current_time,
                last_message_at=current_time,
                message_count=1,
                status="active"
            )
            user_sessions[session_id] = session
            print(f"Created new session {session_id} for user {user_id} with flow {flow_id}")

    async def cleanup_expired_sessions(self, max_age_hours: int = 24) -> Dict[str, int]:
        """Clean up old/expired sessions for all users"""
        cutoff_time = datetime.utcnow().timestamp() - (max_age_hours * 3600)
        cleanup_stats = {
            "total_expired_sessions": 0,
            "users_affected": 0,
            "empty_users_removed": 0
        }

        users_to_remove = []

        for user_id, user_sessions in self._active_sessions.items():
            expired_sessions = []

            for session_id, session in user_sessions.items():
                last_activity = session.last_message_at or session.created_at
                if last_activity and last_activity.timestamp() < cutoff_time:
                    expired_sessions.append(session_id)

            # Remove expired sessions for this user
            for session_id in expired_sessions:
                del user_sessions[session_id]
                cleanup_stats["total_expired_sessions"] += 1

            if expired_sessions:
                cleanup_stats["users_affected"] += 1
                print(f"Cleaned up {len(expired_sessions)} expired sessions for user {user_id}")

            # Mark users with no sessions for removal
            if not user_sessions:
                users_to_remove.append(user_id)

        # Remove users with no active sessions
        for user_id in users_to_remove:
            del self._active_sessions[user_id]
            cleanup_stats["empty_users_removed"] += 1

        print(f"Session cleanup completed: {cleanup_stats}")
        return cleanup_stats

    async def get_session_stats(self) -> Dict[str, Any]:
        """Get statistics about current sessions"""
        total_sessions = 0
        total_users = len(self._active_sessions)
        sessions_by_status = {"active": 0, "ended": 0}

        for user_sessions in self._active_sessions.values():
            total_sessions += len(user_sessions)
            for session in user_sessions.values():
                sessions_by_status[session.status] = sessions_by_status.get(session.status, 0) + 1

        return {
            "total_users_with_sessions": total_users,
            "total_sessions": total_sessions,
            "sessions_by_status": sessions_by_status,
            "average_sessions_per_user": round(total_sessions / total_users, 2) if total_users > 0 else 0
        }
