import time
import os
import tempfile
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import Request, UploadFile

from ..services.flow_service import FlowService
from ..external.langflow_repository import LangflowRepository
from ..models.message import MessageRequest, MessageResponse, SessionInfo, ChatSession
from ..utils.jwt_helper import get_user_id_from_request, get_user_info_from_request
from ..utils.file_embedding import read_file_content


class MessageService:
    def __init__(self):
        self.flow_service = FlowService()
        self.langflow_repo = LangflowRepository()
        self._active_sessions: Dict[str, Dict[str, ChatSession]] = {}

    async def send_message_with_files(
            self,
            request: Request,
            message_request: Optional[MessageRequest] = None,
            message: Optional[str] = None,
            flow_id: Optional[str] = None,
            session_id: Optional[str] = None,
            attached_files: List[UploadFile] = None,
            include_images: bool = True
    ) -> MessageResponse:
        """
        Send a message with optional file attachments
        Handles both JSON requests (backward compatibility) and form data with files
        """
        if attached_files is None:
            attached_files = []

        final_message_request = self._prepare_message_request(
            message_request, message, flow_id, session_id
        )

        enhanced_message = await self._process_attached_files(
            final_message_request.message, attached_files, include_images
        )

        enhanced_message_request = MessageRequest(
            message=enhanced_message,
            flow_id=final_message_request.flow_id,
            session_id=final_message_request.session_id
        )

        result = await self.send_message_to_flow(request, enhanced_message_request)

        return result

    def _prepare_message_request(
            self,
            message_request: Optional[MessageRequest],
            message: Optional[str],
            flow_id: Optional[str],
            session_id: Optional[str]
    ) -> MessageRequest:
        if message_request is not None:
            return message_request
        else:
            if not message and not flow_id:
                raise ValueError("Either message_request or form data (message, flow_id) must be provided")
            if not flow_id:
                raise ValueError("Flow ID is required")

            return MessageRequest(
                message=message or "",
                flow_id=flow_id,
                session_id=session_id
            )

    async def _process_attached_files(
            self,
            original_message: str,
            attached_files: List[UploadFile],
            include_images: bool = True
    ) -> str:
        """Process attached files and combine with original message"""
        if not attached_files:
            return original_message

        print(f"Processing {len(attached_files)} attached files...")

        file_contents = []
        for file in attached_files:
            if not file.filename:
                continue

            file_content = await self._process_single_file(file, include_images)
            if file_content:
                file_contents.append(file_content)

        enhanced_message = original_message.strip()

        if file_contents:
            if enhanced_message:
                enhanced_message = f"{enhanced_message}\n\n=== ATTACHED FILES CONTENT ===\n" + "\n".join(file_contents)
            else:
                enhanced_message = f"Please analyze the following attached files:\n\n=== ATTACHED FILES CONTENT ===\n" + "\n".join(file_contents)

        return enhanced_message

    async def _process_single_file(
            self,
            file: UploadFile,
            include_images: bool = True
    ) -> str:
        """Process a single uploaded file and return formatted content"""
        try:
            file_id = str(uuid.uuid4())
            temp_dir = Path(tempfile.gettempdir()) / "message_uploads"
            temp_dir.mkdir(exist_ok=True)
            temp_file_path = temp_dir / f"{file_id}_{file.filename}"

            with open(temp_file_path, "wb") as temp_file:
                content = await file.read()
                temp_file.write(content)

            try:
                file_content, file_type = read_file_content(
                    str(temp_file_path),
                    include_images=include_images
                )

                file_header = f"\n\n--- FILE: {file.filename} (Type: {file_type}, Size: {len(content)} bytes) ---\n"
                formatted_content = file_header + file_content

                print(f"✅ Successfully processed file: {file.filename} ({file_type})")
                return formatted_content

            except Exception as e:
                print(f"❌ Error processing file {file.filename}: {e}")
                error_msg = f"Could not process file '{file.filename}': {str(e)}"
                return f"\n\n--- FILE: {file.filename} (PROCESSING FAILED) ---\n{error_msg}\n"

            finally:
                try:
                    temp_file_path.unlink(missing_ok=True)
                except Exception as e:
                    print(f"Warning: Could not delete temp file {temp_file_path}: {e}")

        except Exception as e:
            print(f"❌ Error handling file {file.filename}: {e}")
            error_msg = f"Could not read file '{file.filename}': {str(e)}"
            return f"\n\n--- FILE: {file.filename} (READ FAILED) ---\n{error_msg}\n"


    async def send_message_to_flow(self, request: Request, message_request: MessageRequest) -> MessageResponse:
        """Send a message to a flow and return the response"""
        await self._validate_message_request(request, message_request)

        user_id = await get_user_id_from_request(request)
        if not user_id:
            raise ValueError("Unable to extract user ID from authentication token")

        session_id = message_request.session_id or self._generate_session_id()

        try:
            payload = await self.flow_service.prepare_flow_execution_payload(
                request=request,
                user_id=user_id,
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
                generated_files=execution_result.generated_files,
                session_id=session_id,
                flow_id=message_request.flow_id,
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
        user_id = await get_user_id_from_request(request)
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
        user_id = await get_user_id_from_request(request)
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
        user_id = await get_user_id_from_request(request)
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

        access_info = user_info.get("access_token_info", {})
        if access_info.get("is_expired", True):
            raise ValueError("Authentication token has expired")

        if not message_request.message or not message_request.message.strip():
            pass

        if not message_request.flow_id:
            raise ValueError("Flow ID is required")

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

