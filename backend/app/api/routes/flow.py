from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from typing import Dict, Any, Optional, List
import os

from ...services.flow_service import FlowService

FLOWS_BASE_ENDPOINT = os.getenv("FLOWS_BASE_ENDPOINT")
FLOWS_UPLOAD_ENDPOINT = os.getenv("FLOWS_UPLOAD_ENDPOINT")
FLOWS_GET_BY_ID_ENDPOINT = os.getenv("FLOWS_GET_BY_ID_ENDPOINT")
FLOWS_COMPONENT_IDS_ENDPOINT = os.getenv("FLOWS_COMPONENT_IDS_ENDPOINT")
FLOWS_DELETE_ENDPOINT = os.getenv("FLOWS_DELETE_ENDPOINT")
FLOWS_DELETE_MULTIPLE_ENDPOINT = os.getenv("FLOWS_DELETE_MULTIPLE_ENDPOINT")
FLOWS_RUN_ENDPOINT = os.getenv("FLOWS_RUN_ENDPOINT")
FLOWS_VALIDATE_ENDPOINT = os.getenv("FLOWS_VALIDATE_ENDPOINT")

router = APIRouter(prefix=FLOWS_BASE_ENDPOINT, tags=["flows"])
flow_service = FlowService()


@router.get(FLOWS_DELETE_MULTIPLE_ENDPOINT)
async def get_flows(
        request: Request,
        remove_example_flows: bool = True,
        header_flows: bool = False,
        get_all: bool = True
) -> List[Dict[str, Any]]:
    """Get user flows"""
    try:
        flows = await flow_service.get_user_flows_from_request(
            request=request,
            remove_example_flows=remove_example_flows,
            header_flows=header_flows,
            get_all=get_all
        )
        return flows
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting flows: {str(e)}")


@router.get(FLOWS_GET_BY_ID_ENDPOINT)
async def get_flow_by_id(request: Request, flow_id: str) -> Dict[str, Any]:
    """Get a specific flow by ID"""
    try:
        flow = await flow_service.get_flow_by_id(request, flow_id)
        return flow
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting flow: {str(e)}")


@router.get(FLOWS_COMPONENT_IDS_ENDPOINT)
async def get_component_ids(request: Request, flow_id: str) -> Dict[str, Any]:
    """Get all component IDs from a specific flow"""
    try:
        component_info = await flow_service.get_flow_component_ids(request, flow_id)
        return component_info.dict()
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting component IDs: {str(e)}")


@router.post(FLOWS_UPLOAD_ENDPOINT)
async def upload_flow(
        request: Request,
        file: UploadFile = File(...),
        folder_id: Optional[str] = Form(None)
) -> Dict[str, Any]:
    """Upload a flow file to Langflow"""
    try:
        result = await flow_service.upload_flow_file(request, file, folder_id)
        return result
    except ValueError as e:
        # Business logic errors (invalid file, etc.)
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading flow: {str(e)}")


@router.delete(FLOWS_DELETE_ENDPOINT)
async def delete_flow(request: Request, flow_id: str) -> Dict[str, Any]:
    """Delete a specific flow and its associated collection"""
    try:
        result = await flow_service.delete_flow(request, flow_id)

        if not result.success:
            if "not found" in result.message.lower():
                raise HTTPException(status_code=404, detail=result.message)
            elif "access denied" in result.message.lower():
                raise HTTPException(status_code=403, detail=result.message)
            else:
                raise HTTPException(status_code=500, detail=result.message)

        return result.dict()
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting flow: {str(e)}")


@router.delete(FLOWS_DELETE_MULTIPLE_ENDPOINT)
async def delete_multiple_flows(
        request: Request,
        flow_ids: List[str]
) -> Dict[str, Any]:
    """Delete multiple flows and their associated collections"""
    try:
        if not flow_ids:
            raise HTTPException(status_code=400, detail="No flow IDs provided")

        result = await flow_service.delete_multiple_flows(request, flow_ids)
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting flows: {str(e)}")


@router.post(FLOWS_RUN_ENDPOINT)
async def run_flow(
        request: Request,
        flow_id: str,
        payload: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute a flow with given payload"""
    try:
        result = await flow_service.execute_flow(request, flow_id, payload)
        return result.dict()
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing flow: {str(e)}")


@router.get(FLOWS_VALIDATE_ENDPOINT)
async def validate_flow_access(request: Request, flow_id: str) -> Dict[str, Any]:
    """Validate if user has access to a specific flow"""
    try:
        has_access = await flow_service.validate_user_flow_access(request, flow_id)
        return {
            "flow_id": flow_id,
            "has_access": has_access,
            "message": "Access granted" if has_access else "Access denied"
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating access: {str(e)}")
