from fastapi import APIRouter, HTTPException, Request
import requests
import json
import os
import time
from typing import Dict, Any, Optional
from pydantic import BaseModel

from ..utils.jwt_helper import get_user_token

LANGFLOW_URL = os.getenv("LANGFLOW_INTERNAL_URL", "http://langflow:7860")

router = APIRouter(prefix="/api/messages", tags=["messages"])


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


def extract_bot_response(data: Dict[str, Any]) -> str:
    """
    Extracts the actual text message from LangFlow's complex response structure
    """
    try:
        if data.get("outputs") and len(data["outputs"]) > 0:
            first_output = data["outputs"][0]

            if first_output.get("outputs") and len(first_output["outputs"]) == 0:
                return "No response received from LangFlow. The agent may not have generated any output."

            if first_output.get("outputs") and len(first_output["outputs"]) > 0:
                message_output = first_output["outputs"][0]

                if message_output.get("messages") and len(message_output["messages"]) > 0:
                    return message_output["messages"][0].get("message", "")

                if message_output.get("results", {}).get("message", {}).get("text"):
                    return message_output["results"]["message"]["text"]

                if message_output.get("message", {}).get("message"):
                    return message_output["message"]["message"]

        if data.get("result"):
            return str(data["result"])

        if data.get("output"):
            return str(data["output"])

        if isinstance(data, str):
            return data

        if (data.get("outputs") and len(data["outputs"]) > 0 and
                data["outputs"][0].get("outputs") and len(data["outputs"][0]["outputs"]) == 0):
            return "No response received from LangFlow. The agent may not have generated any output."

        json_str = json.dumps(data)[:100]
        return f"Response format unexpected. Please check your LangFlow configuration. Raw response: {json_str}..."

    except Exception as err:
        print(f"Error extracting bot response: {err}")
        return "Failed to parse response. Please check your LangFlow configuration."


@router.post("/send", response_model=MessageResponse)
async def send_message(
        request: Request,
        message_request: MessageRequest
) -> MessageResponse:
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid Langflow access token found")

        if not message_request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        if not message_request.flow_id:
            raise HTTPException(status_code=400, detail="Flow ID is required")

        session_id = message_request.session_id or f"session_{int(time.time())}_{os.urandom(4).hex()}"

        payload = {
            "input_value": message_request.message,
            "output_type": "chat",
            "input_type": "chat",
            "session_id": session_id
        }

        url = f"{LANGFLOW_URL}/api/v1/run/{message_request.flow_id}"
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}',
        }

        print(f"Sending message to LangFlow: {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")

        response = requests.post(url, headers=headers, json=payload, timeout=30)

        print(f"LangFlow response status: {response.status_code}")

        if not response.ok:
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Langflow token expired or invalid")
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
    Get information about a chat session (placeholder for future implementation)
    """
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid Langflow access token found")

        # For now, just return basic session info
        # In the future, this could fetch conversation history from LangFlow
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