from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any
import os

from ...services.message_service import MessageService
from ...models.message import MessageRequest, MessageResponse

MESSAGES_BASE_ENDPOINT = os.getenv("MESSAGES_BASE_ENDPOINT")
MESSAGES_SEND_ENDPOINT = os.getenv("MESSAGES_SEND_ENDPOINT")
MESSAGES_SESSION_INFO_ENDPOINT = os.getenv("MESSAGES_SESSION_INFO_ENDPOINT")
MESSAGES_LIST_SESSIONS_ENDPOINT = os.getenv("MESSAGES_LIST_SESSIONS_ENDPOINT")
MESSAGES_END_SESSION_ENDPOINT = os.getenv("MESSAGES_END_SESSION_ENDPOINT")

router = APIRouter(prefix=MESSAGES_BASE_ENDPOINT, tags=["messages"])
message_service = MessageService()


@router.post(MESSAGES_SEND_ENDPOINT, response_model=MessageResponse)
async def send_message(
        request: Request,
        message_request: MessageRequest
) -> MessageResponse:
    """Send a message to a flow and get response"""
    try:
        result = await message_service.send_message_to_flow(request, message_request)
        return result
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        elif "empty" in error_msg.lower() or "required" in error_msg.lower():
            raise HTTPException(status_code=400, detail=error_msg)
        elif "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        elif "access denied" in error_msg.lower():
            raise HTTPException(status_code=403, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail="Request to Langflow timed out")
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=f"Could not connect to Langflow: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending message: {str(e)}")


@router.get(MESSAGES_SESSION_INFO_ENDPOINT)
async def get_session_info(
        request: Request,
        session_id: str
) -> Dict[str, Any]:
    """Get information about a chat session"""
    try:
        session_info = await message_service.get_session_information(request, session_id)
        return session_info.dict()
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        elif "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting session info: {str(e)}")


@router.get(MESSAGES_LIST_SESSIONS_ENDPOINT)
async def list_user_sessions(request: Request) -> Dict[str, Any]:
    """List all active sessions for the user"""
    try:
        sessions = await message_service.get_user_sessions(request)
        return {
            "success": True,
            "sessions": sessions,
            "total_sessions": len(sessions)
        }
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing sessions: {str(e)}")


@router.delete(MESSAGES_END_SESSION_ENDPOINT)
async def end_session(request: Request, session_id: str) -> Dict[str, Any]:
    """End a specific chat session"""
    try:
        result = await message_service.end_chat_session(request, session_id)
        return result.dict()
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        elif "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ending session: {str(e)}")
