import re
import base64
import os
from typing import Dict, Any, Optional, Tuple

PPTX_MAGIC_BYTES = os.getenv("PPTX_MAGIC_BYTES")


def extract_generated_files(text: str) -> Tuple[str, Optional[Dict[str, Any]]]:
    pptx_pattern = rf'<{PPTX_MAGIC_BYTES}>\s*filename:([^\n]+)\s*content_type:([^\n]+)\s*size:(\d+)\s*data:([^\n<]+)\s*</{PPTX_MAGIC_BYTES}>'

    match = re.search(pptx_pattern, text, re.MULTILINE | re.DOTALL)

    if not match:
        return text, None

    filename = match.group(1).strip()
    content_type = match.group(2).strip()
    size = int(match.group(3).strip())
    base64_data = match.group(4).strip()

    try:
        file_content = base64.b64decode(base64_data)

        if len(file_content) != size:
            print(f"Warning: File size mismatch. Expected {size}, got {len(file_content)}")

        file_data = {
            "filename": filename,
            "content_type": content_type,
            "size": size,
            "content": file_content,
            "base64_data": base64_data
        }

        cleaned_text = re.sub(pptx_pattern, '', text, flags=re.MULTILINE | re.DOTALL).strip()

        return cleaned_text, file_data

    except Exception as e:
        print(f"Error parsing generated file: {e}")
        return text, None


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


def extract_bot_response_with_files(data: Dict[str, Any]) -> Tuple[str, Optional[Dict[str, Any]]]:
    """
    Enhanced version that returns both the cleaned text and file data

    Returns:
        (response_text, file_data) where file_data is None if no files found
    """
    try:
        raw_response = extract_bot_response(data)

        cleaned_text, file_data = extract_generated_files(raw_response)

        return cleaned_text, file_data

    except Exception as err:
        print(f"Error extracting bot response with files: {err}")
        return "Failed to parse response from the agent.", None
