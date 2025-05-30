from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
import requests
import json
import os
import jwt
from typing import Dict, Any, Optional, List

from ..utils.jwt_helper import get_user_token

LANGFLOW_URL = os.getenv("LANGFLOW_INTERNAL_URL")
LF_FLOWS_BASE_ENDPOINT = os.getenv("LF_FLOWS_BASE_ENDPOINT")
LF_FLOWS_UPLOAD_ENDPOINT = os.getenv("LF_FLOWS_UPLOAD_ENDPOINT")
FLOWS_BASE_ENDPOINT = os.getenv("FLOWS_BASE_ENDPOINT")
FLOWS_UPLOAD_ENDPOINT = os.getenv("FLOWS_UPLOAD_ENDPOINT")

router = APIRouter(prefix=FLOWS_BASE_ENDPOINT, tags=["flows"])


@router.get("")
async def get_flows(
        request: Request,
        remove_example_flows: bool = True,
        header_flows: bool = False,
        get_all: bool = True
) -> List[Dict[str, Any]]:
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid Langflow access token found")

        params = {
            'get_all': str(get_all).lower(),
            'remove_example_flows': str(remove_example_flows).lower(),
            'header_flows': str(header_flows).lower()
        }

        url = f"{LANGFLOW_URL}{LF_FLOWS_BASE_ENDPOINT}"
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        }

        print(f"Making GET request to: {url}")
        print(f"With params: {params}")

        response = requests.get(url, headers=headers, params=params)

        print(f"Langflow response status: {response.status_code}")

        if not response.ok:
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Langflow token expired or invalid")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Langflow error: {response.text}"
            )

        flows = response.json()
        print(f"Retrieved {len(flows)} flows")

        return flows

    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        print(f"Connection error to Langflow: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to Langflow: {str(e)}")
    except Exception as e:
        print(f"Error getting flows: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting flows: {str(e)}")


@router.post(FLOWS_UPLOAD_ENDPOINT)
async def upload_flow(
        request: Request,
        file: UploadFile = File(...),
        folder_id: Optional[str] = Form(None)
) -> Dict[str, Any]:
    """Upload a flow file to Langflow"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid Langflow access token found")

        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        if not file.filename.lower().endswith('.json'):
            raise HTTPException(status_code=400, detail="Only JSON files are supported")

        try:
            file_content = await file.read()
            json.loads(file_content.decode('utf-8'))
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

        print(f"Uploading file: {file.filename} ({len(file_content)} bytes)")

        files = {
            'file': (file.filename, file_content, file.content_type or 'application/json')
        }

        data = {}
        if folder_id:
            data['folder_id'] = folder_id

        url = f"{LANGFLOW_URL}{LF_FLOWS_UPLOAD_ENDPOINT}"
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        }

        print(f"Making POST request to: {url}")

        response = requests.post(url, headers=headers, files=files, data=data)

        print(f"Langflow upload response status: {response.status_code}")

        if not response.ok:
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Langflow token expired or invalid")
            if response.status_code == 422:
                try:
                    error_detail = response.json()
                    raise HTTPException(status_code=422, detail=f"Langflow validation error: {error_detail}")
                except:
                    raise HTTPException(status_code=422, detail=f"Langflow validation error: {response.text}")
            print(f"Upload error response: {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Upload failed: {response.text}"
            )

        result = response.json()

        if isinstance(result, list) and len(result) > 0:
            flow = result[0]
            print(f"Successfully uploaded flow: {flow.get('name', 'Unknown')}")
            return flow
        else:
            print("Successfully uploaded flow")
            return result

    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        print(f"Connection error to Langflow: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to Langflow: {str(e)}")
    except Exception as e:
        print(f"Error uploading flow: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading flow: {str(e)}")


@router.delete("/{flow_id}")
async def delete_flow(request: Request, flow_id: str) -> Dict[str, Any]:
    """Delete a specific flow"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid Langflow access token found")

        url = f"{LANGFLOW_URL}{LF_FLOWS_BASE_ENDPOINT.rstrip('/')}/{flow_id}"
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        }

        print(f"Making DELETE request to: {url}")

        response = requests.delete(url, headers=headers)

        print(f"Langflow delete response status: {response.status_code}")

        if not response.ok:
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Langflow token expired or invalid")
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Flow not found")
            print(f"Delete error response: {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Delete failed: {response.text}"
            )

        print(f"Successfully deleted flow: {flow_id}")

        try:
            result = response.json()
            return result
        except:
            return {
                "success": True,
                "message": "Flow deleted successfully",
                "flow_id": flow_id
            }

    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        print(f"Connection error to Langflow: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to Langflow: {str(e)}")
    except Exception as e:
        print(f"Error deleting flow: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting flow: {str(e)}")


@router.delete("")
async def delete_multiple_flows(
        request: Request,
        flow_ids: List[str]
) -> Dict[str, Any]:
    """Delete multiple flows"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid Langflow access token found")

        if not flow_ids:
            raise HTTPException(status_code=400, detail="No flow IDs provided")

        url = f"{LANGFLOW_URL}{LF_FLOWS_BASE_ENDPOINT}"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }

        print(f"Making bulk DELETE request to: {url}")
        print(f"Deleting {len(flow_ids)} flows")

        response = requests.delete(url, headers=headers, json=flow_ids)

        print(f"Langflow bulk delete response status: {response.status_code}")

        if not response.ok:
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Langflow token expired or invalid")
            print(f"Bulk delete error response: {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Bulk delete failed: {response.text}"
            )

        result = response.json()
        print(f"Successfully deleted {result.get('deleted', len(flow_ids))} flows")

        return result

    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        print(f"Connection error to Langflow: {e}")
        raise HTTPException(status_code=503, detail=f"Could not connect to Langflow: {str(e)}")
    except Exception as e:
        print(f"Error deleting flows: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting flows: {str(e)}")