from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, BackgroundTasks
from typing import Dict, Any, Optional
import os

from ...services.flow_service import FlowService
from ...utils.processing_tracker import processing_tracker
from ...utils.jwt_helper import get_user_id_from_request

COLLECTIONS_BASE_ENDPOINT = os.getenv("COLLECTIONS_BASE_ENDPOINT")
COLLECTIONS_CREATE_ENDPOINT = os.getenv("COLLECTIONS_CREATE_ENDPOINT")
COLLECTIONS_DELETE_ENDPOINT = os.getenv("COLLECTIONS_DELETE_ENDPOINT")
COLLECTIONS_FILES_ENDPOINT = os.getenv("COLLECTIONS_FILES_ENDPOINT")
COLLECTIONS_UPLOAD_ENDPOINT = os.getenv("COLLECTIONS_UPLOAD_ENDPOINT")
COLLECTIONS_DELETE_FILE_ENDPOINT = os.getenv("COLLECTIONS_DELETE_FILE_ENDPOINT")
COLLECTIONS_INFO_ENDPOINT = os.getenv("COLLECTIONS_INFO_ENDPOINT")
COLLECTIONS_LIST_FILES_ENDPOINT = os.getenv("COLLECTIONS_LIST_FILES_ENDPOINT")
COLLECTIONS_UPLOAD_TO_COLLECTION_ENDPOINT = os.getenv("COLLECTIONS_UPLOAD_TO_COLLECTION_ENDPOINT")
COLLECTIONS_DELETE_FROM_COLLECTION_ENDPOINT = os.getenv("COLLECTIONS_DELETE_FROM_COLLECTION_ENDPOINT")
COLLECTIONS_PROCESSING_ENDPOINT = os.getenv("COLLECTIONS_PROCESSING_ENDPOINT")
COLLECTIONS_DELETE_PROCESSING_ENDPOINT = os.getenv("COLLECTIONS_DELETE_PROCESSING_ENDPOINT")


router = APIRouter(prefix=COLLECTIONS_BASE_ENDPOINT, tags=["collections"])
flow_service = FlowService()


@router.post(COLLECTIONS_CREATE_ENDPOINT)
async def create_collection(
        request: Request,
        flow_id: str,
) -> Dict[str, Any]:
    """Create a new Qdrant collection using flow_id as collection name"""
    try:
        result = await flow_service.create_collection_for_flow(request, flow_id)
        return result.dict()
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        elif "access denied" in error_msg.lower() or "permission" in error_msg.lower():
            raise HTTPException(status_code=403, detail=error_msg)
        elif "empty" in error_msg.lower() or "invalid" in error_msg.lower():
            raise HTTPException(status_code=400, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail="Qdrant service is not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating collection: {str(e)}")


@router.delete(COLLECTIONS_DELETE_ENDPOINT)
async def delete_collection(
        request: Request,
        flow_id: str
) -> Dict[str, Any]:
    """Delete a Qdrant collection using flow_id"""
    try:
        result = await flow_service.delete_collection_for_flow(request, flow_id)
        return result
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        elif "access denied" in error_msg.lower() or "permission" in error_msg.lower():
            raise HTTPException(status_code=403, detail=error_msg)
        elif "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail="Qdrant service is not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting collection: {str(e)}")


@router.get(COLLECTIONS_LIST_FILES_ENDPOINT)
async def list_files_in_collection(
        request: Request,
        flow_id: str
) -> Dict[str, Any]:
    """List all files in a specific collection using flow_id"""
    try:
        result = await flow_service.list_collection_files(request, flow_id)
        return result.dict()
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        elif "access denied" in error_msg.lower() or "permission" in error_msg.lower():
            raise HTTPException(status_code=403, detail=error_msg)
        elif "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail="Qdrant service is not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")


@router.get(COLLECTIONS_PROCESSING_ENDPOINT)
async def get_processing_files(
        request: Request,
        flow_id: str
) -> Dict[str, Any]:
    """Get all files currently being processed for a specific flow"""
    try:
        user_id = await get_user_id_from_request(request)
        if not user_id:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not flow_id.strip():
            raise HTTPException(status_code=400, detail="Flow ID cannot be empty")

        has_access = await flow_service.validate_user_flow_access(request, flow_id)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You don't have permission to access flow '{flow_id}'"
            )

        processing_files_list = processing_tracker.get_files_for_flow(flow_id)

        return {
            "success": True,
            "flow_id": flow_id,
            "processing_files": processing_files_list,
            "total_processing": len(processing_files_list)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting processing files: {str(e)}")


@router.post(COLLECTIONS_UPLOAD_TO_COLLECTION_ENDPOINT)
async def upload_file_to_collection(
        request: Request,
        flow_id: str,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        chunk_size: Optional[int] = Form(1000),
        chunk_overlap: Optional[int] = Form(200),
        include_images: Optional[bool] = Form(True)
) -> Dict[str, Any]:
    """Upload a file to a specific collection using flow_id"""
    try:
        result = await flow_service.upload_file_to_collection(
            request=request,
            flow_id=flow_id,
            file=file,
            background_tasks=background_tasks,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            include_images=include_images,
        )
        return result.dict()
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        elif "access denied" in error_msg.lower() or "permission" in error_msg.lower():
            raise HTTPException(status_code=403, detail=error_msg)
        elif "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        elif "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
            raise HTTPException(status_code=409, detail=error_msg)
        elif any(word in error_msg.lower() for word in ["filename", "file type", "empty", "invalid"]):
            raise HTTPException(status_code=400, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail="Qdrant service is not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@router.delete(COLLECTIONS_DELETE_PROCESSING_ENDPOINT)
async def delete_processing_file(
        request: Request,
        flow_id: str,
        file_id: str
) -> Dict[str, Any]:
    """Delete a processing file by file_id"""
    try:
        result = await flow_service.delete_processing_file(request, flow_id, file_id)
        return result
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        elif "access denied" in error_msg.lower() or "permission" in error_msg.lower():
            raise HTTPException(status_code=403, detail=error_msg)
        elif "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting processing file: {str(e)}")


@router.delete(COLLECTIONS_DELETE_FROM_COLLECTION_ENDPOINT)
async def delete_file_from_collection(
        request: Request,
        flow_id: str,
        file_path: str
) -> Dict[str, Any]:
    """Delete a specific file from a collection using flow_id"""
    try:
        result = await flow_service.delete_file_from_collection(
            request=request,
            flow_id=flow_id,
            file_path=file_path
        )
        return result.dict()
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        elif "access denied" in error_msg.lower() or "permission" in error_msg.lower():
            raise HTTPException(status_code=403, detail=error_msg)
        elif "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail="Qdrant service is not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")


@router.get(COLLECTIONS_INFO_ENDPOINT)
async def get_collection_info(
        request: Request,
        flow_id: str
) -> Dict[str, Any]:
    """Get detailed information about a collection"""
    try:
        result = await flow_service.get_collection_details(request, flow_id)
        return result
    except ValueError as e:
        error_msg = str(e)
        if "authentication" in error_msg.lower() or "token" in error_msg.lower():
            raise HTTPException(status_code=401, detail=error_msg)
        elif "access denied" in error_msg.lower() or "permission" in error_msg.lower():
            raise HTTPException(status_code=403, detail=error_msg)
        elif "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail="Qdrant service is not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting collection info: {str(e)}")
