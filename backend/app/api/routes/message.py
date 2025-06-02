from fastapi import APIRouter, HTTPException, Request
import requests
import json
import os
import time
from typing import Dict, Any, Optional
from pydantic import BaseModel

from .flows import get_component_ids
from ..utils.jwt_helper import get_user_token
from ..utils.api_key import TemporaryApiKey, create_api_key_headers
from ..utils.message_helper import extract_bot_response

LANGFLOW_URL = os.getenv("LANGFLOW_INTERNAL_URL")
LF_RUN_FLOW_ENDPOINT = os.getenv("LF_RUN_FLOW_ENDPOINT")
MESSAGES_BASE_ENDPOINT = os.getenv("MESSAGES_BASE_ENDPOINT")
MESSAGES_SEND_ENDPOINT = os.getenv("MESSAGES_SEND_ENDPOINT")

router = APIRouter(prefix=MESSAGES_BASE_ENDPOINT, tags=["messages"])


class MessageRequest(BaseModel):
    message: str
    flow_id: str
    session_id: Optional[str] = None


class MessageResponse(BaseModel):
    success: bool
    response: str
    session_id: str
    raw_response: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.post(MESSAGES_SEND_ENDPOINT, response_model=MessageResponse)
async def send_message(
        request: Request,
        message_request: MessageRequest
) -> MessageResponse:
    try:
        # Get user token for API key creation
        user_token = get_user_token(request)
        if not user_token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not message_request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        if not message_request.flow_id:
            raise HTTPException(status_code=400, detail="Flow ID is required")

        session_id = message_request.session_id or f"session_{int(time.time())}_{os.urandom(4).hex()}"

        print(f"Getting component IDs for flow: {message_request.flow_id}")

        component_data = await get_component_ids(request, message_request.flow_id)
        component_ids = component_data.get('component_ids', [])

        qdrant_component_ids = [
            comp_id for comp_id in component_ids
            if 'qdrant' in comp_id.lower()
        ]

        print(f"Found {len(component_ids)} total components")
        print(f"Found {len(qdrant_component_ids)} Qdrant components: {qdrant_component_ids}")

        payload = {
            "input_value": message_request.message,
            "output_type": "chat",
            "input_type": "chat",
            "session_id": session_id
        }

        if qdrant_component_ids:
            tweaks = {}
            for qdrant_id in qdrant_component_ids:
                tweaks[qdrant_id] = {
                    "collection_name": message_request.flow_id
                }
            payload["tweaks"] = tweaks
            print(f"Added collection_name tweaks for Qdrant components: {list(tweaks.keys())}")

        print(f"Processing message request - Flow: {message_request.flow_id}, Session: {session_id}")

        with TemporaryApiKey(user_token) as api_key:
            url = f"{LANGFLOW_URL}{LF_RUN_FLOW_ENDPOINT.format(flow_id=message_request.flow_id)}"
            headers = create_api_key_headers(api_key)

            response = requests.post(url, headers=headers, json=payload, timeout=3600)

            if not response.ok:
                if response.status_code == 401:
                    raise HTTPException(status_code=401, detail="Langflow authentication failed")
                if response.status_code == 404:
                    raise HTTPException(status_code=404, detail="Flow not found")

                error_text = response.text
                print(f"LangFlow error response: {error_text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"LangFlow error: {error_text}"
                )

            response_data = response.json()
            print(f"LangFlow raw response: {json.dumps(response_data, indent=2)}")

        bot_response = extract_bot_response(response_data)

        return MessageResponse(
            success=True,
            response=bot_response,
            session_id=session_id,
            raw_response=response_data
        )

    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        print("LangFlow request timeout")
        raise HTTPException(status_code=504, detail="Request to LangFlow timed out")
    except requests.exceptions.RequestException as e:
        print(f"Connection error to Langflow: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to Langflow: {str(e)}")
    except json.JSONDecodeError as e:
        print(f"Error parsing LangFlow response: {e}")
        raise HTTPException(status_code=502, detail="Invalid response format from LangFlow")
    except Exception as e:
        print(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=f"Error sending message: {str(e)}")


@router.get("/session/{session_id}")
async def get_session_info(
        request: Request,
        session_id: str
) -> Dict[str, Any]:
    """
    Get information about a chat session
    """
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        return {
            "session_id": session_id,
            "status": "active",
            "message": "Session information retrieved"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting session info: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting session info: {str(e)}")
