from fastapi import APIRouter, HTTPException, Request
import requests
import json
import os
import time
from typing import Dict, Any, Optional
from pydantic import BaseModel

from ..utils.jwt_helper import get_user_token
from ..utils.api_key import TemporaryApiKey, create_api_key_headers

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
        # Check if we have the basic structure
        if not data.get("outputs") or not isinstance(data["outputs"], list):
            return "Invalid response structure from LangFlow."

        # Check if outputs array is empty
        if len(data["outputs"]) == 0:
            return "No response provided by the agent."

        first_output = data["outputs"][0]

        # Check if the first output has outputs field
        if not first_output.get("outputs"):
            return "No response provided by the agent."

        # Check if outputs array within first output is empty
        if len(first_output["outputs"]) == 0:
            return "No response provided by the agent."

        # Now we know we have at least one output, let's try to extract the message
        message_output = first_output["outputs"][0]

        # Method 1: Check messages array (most common for chat outputs)
        if (message_output.get("messages") and
                isinstance(message_output["messages"], list) and
                len(message_output["messages"]) > 0):

            message = message_output["messages"][0].get("message", "").strip()
            if message:
                return message

        # Method 2: Check results.message.text
        if (message_output.get("results", {}).get("message", {}).get("text")):
            text = message_output["results"]["message"]["text"].strip()
            if text:
                return text

        # Method 3: Check outputs.message.message
        if (message_output.get("outputs", {}).get("message", {}).get("message")):
            message = message_output["outputs"]["message"]["message"].strip()
            if message:
                return message

        # Method 4: Check direct message field
        if message_output.get("message", {}).get("message"):
            message = message_output["message"]["message"].strip()
            if message:
                return message

        # Method 5: Check artifacts
        if (message_output.get("artifacts", {}).get("message")):
            message = str(message_output["artifacts"]["message"]).strip()
            if message:
                return message

        # Method 6: Check if there's any text-like content
        for key in ["text", "content", "response", "output"]:
            if message_output.get(key):
                content = str(message_output[key]).strip()
                if content:
                    return content

        return "No response provided by the agent."

    except KeyError as e:
        print(f"Missing expected key in response: {e}")
        return "Response structure incomplete."
    except Exception as err:
        print(f"Error extracting bot response: {err}")
        return "Failed to parse response from the agent."


@router.post("/send", response_model=MessageResponse)
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

        payload = {
            "input_value": message_request.message,
            "output_type": "chat",
            "input_type": "chat",
            "session_id": session_id
        }

        print(f"Processing message request - Flow: {message_request.flow_id}, Session: {session_id}")

        # Use temporary API key to make request to Langflow
        with TemporaryApiKey(user_token) as api_key:
            url = f"{LANGFLOW_URL}/api/v1/run/{message_request.flow_id}"
            headers = create_api_key_headers(api_key)

            print(f"Sending message to LangFlow: {url}")
            print(f"Using x-api-key header")
            print(f"Payload: {json.dumps(payload, indent=2)}")

            response = requests.post(url, headers=headers, json=payload, timeout=30)

            print(f"LangFlow response status: {response.status_code}")

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