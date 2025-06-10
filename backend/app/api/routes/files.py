from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, BackgroundTasks
import os
import uuid
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, List

from ..utils.jwt_helper import get_user_token
from ..utils.qdrant import (
    upload_to_qdrant,
    delete_file_from_qdrant,
    get_files_from_collection,
    is_file_in_qdrant,
    construct_collection_name,
    verify_user_flow_access
)
from ..utils.embedding import test_embedding_model
from ..utils.health_checks import check_qdrant_connection
from ..utils.processing_status import processing_tracker
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams


QDRANT_URL = os.getenv("QDRANT_INTERNAL_URL")
COLLECTIONS_BASE_ENDPOINT = os.getenv("COLLECTIONS_BASE_ENDPOINT")
BACKEND_UPLOAD_DIR = os.getenv("BACKEND_UPLOAD_DIR")
COLLECTIONS_FILES_ENDPOINT = os.getenv("COLLECTIONS_FILES_ENDPOINT")
COLLECTIONS_UPLOAD_ENDPOINT = os.getenv("COLLECTIONS_UPLOAD_ENDPOINT")
COLLECTIONS_PROCESSING_ENDPOINT = os.getenv("COLLECTIONS_PROCESSING_ENDPOINT")

router = APIRouter(prefix=COLLECTIONS_BASE_ENDPOINT, tags=["collections"])


@router.post("/{flow_id}")
async def create_collection(
        request: Request,
        flow_id: str,
) -> Dict[str, Any]:
    """Create a new Qdrant collection using flow_id as collection name"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        if not flow_id.strip():
            raise HTTPException(status_code=400, detail="Flow ID cannot be empty")

        has_access = await verify_user_flow_access(request, flow_id)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You don't have permission to access flow '{flow_id}'"
            )

        collection_name = construct_collection_name(flow_id)

        test_result = test_embedding_model()
        if not test_result["success"]:
            raise HTTPException(
                status_code=500,
                detail=f"Could not detect vector size for model: {test_result['error']}"
            )

        vector_size = test_result["vector_size"]
        print(f"Detected vector size: {vector_size}")

        client = QdrantClient(url=QDRANT_URL)

        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_name in existing_collection_names:
            collection_info = client.get_collection(collection_name)
            return {
                "success": True,
                "message": "Collection already exists",
                "collection": {
                    "name": collection_name,
                    "flow_id": flow_id,
                    "vectors_count": collection_info.vectors_count,
                    "points_count": collection_info.points_count,
                    "status": collection_info.status,
                    "config": {
                        "vector_size": collection_info.config.params.vectors.size,
                        "distance": collection_info.config.params.vectors.distance.name
                    }
                },
                "created": False
            }

        print(f"Creating collection '{collection_name}' for flow_id '{flow_id}' with vector size {vector_size}")

        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=vector_size,
                distance=Distance.COSINE
            )
        )

        print(f"Successfully created collection: {collection_name}")

        collection_info = client.get_collection(collection_name)

        return {
            "success": True,
            "message": "Collection created successfully",
            "collection": {
                "name": collection_name,
                "flow_id": flow_id,
                "vectors_count": collection_info.vectors_count,
                "points_count": collection_info.points_count,
                "status": collection_info.status,
                "config": {
                    "vector_size": collection_info.config.params.vectors.size,
                    "distance": collection_info.config.params.vectors.distance.name
                }
            },
            "created": True
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating collection: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating collection: {str(e)}")


@router.delete("/{flow_id}")
async def delete_collection(
        request: Request,
        flow_id: str
) -> Dict[str, Any]:
    """Delete a Qdrant collection using flow_id"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        if not flow_id.strip():
            raise HTTPException(status_code=400, detail="Flow ID cannot be empty")

        has_access = await verify_user_flow_access(request, flow_id)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You don't have permission to access flow '{flow_id}'"
            )

        collection_name = construct_collection_name(flow_id)

        client = QdrantClient(url=QDRANT_URL)

        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_name not in existing_collection_names:
            raise HTTPException(
                status_code=404,
                detail=f"Collection for flow '{flow_id}' not found"
            )

        collection_info = client.get_collection(collection_name)
        points_count = collection_info.points_count

        client.delete_collection(collection_name)

        print(f"Deleted collection: {collection_name} for flow: {flow_id} (had {points_count} points)")

        return {
            "success": True,
            "message": f"Collection for flow '{flow_id}' deleted successfully",
            "flow_id": flow_id,
            "collection_name": collection_name,
            "points_deleted": points_count
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting collection: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting collection: {str(e)}")


@router.get(f"/{{flow_id}}{COLLECTIONS_FILES_ENDPOINT}")
async def list_files_in_collection(
        request: Request,
        flow_id: str
) -> Dict[str, Any]:
    """List all files in a specific collection using flow_id"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        if not flow_id.strip():
            raise HTTPException(status_code=400, detail="Flow ID cannot be empty")

        has_access = await verify_user_flow_access(request, flow_id)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You don't have permission to access flow '{flow_id}'"
            )

        collection_name = construct_collection_name(flow_id)

        client = QdrantClient(url=QDRANT_URL)
        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_name not in existing_collection_names:
            raise HTTPException(
                status_code=404,
                detail=f"Collection for flow '{flow_id}' not found"
            )

        files = get_files_from_collection(collection_name)

        return {
            "success": True,
            "flow_id": flow_id,
            "collection_name": collection_name,
            "files": files,
            "total_files": len(files)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing files in collection: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing files in collection: {str(e)}")

@router.get(f"/{{flow_id}}{COLLECTIONS_PROCESSING_ENDPOINT}")
async def get_processing_files(
        request: Request,
        flow_id: str
) -> Dict[str, Any]:
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not flow_id.strip():
            raise HTTPException(status_code=400, detail="Flow ID cannot be empty")

        has_access = await verify_user_flow_access(request, flow_id)
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
        print(f"Error getting processing files: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting processing files: {str(e)}")


@router.post(f"/{{flow_id}}{COLLECTIONS_UPLOAD_ENDPOINT}")
async def upload_file_to_collection(
        request: Request,
        flow_id: str,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        chunk_size: Optional[int] = Form(1000),
        chunk_overlap: Optional[int] = Form(200)
) -> Dict[str, Any]:
    """Upload a file to a specific collection using flow_id"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        if not flow_id.strip():
            raise HTTPException(status_code=400, detail="Flow ID cannot be empty")

        has_access = await verify_user_flow_access(request, flow_id)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You don't have permission to access flow '{flow_id}'"
            )

        collection_name = construct_collection_name(flow_id)

        client = QdrantClient(url=QDRANT_URL)
        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_name not in existing_collection_names:
            raise HTTPException(
                status_code=404,
                detail=f"Collection for flow '{flow_id}' not found. Please create the collection first."
            )

        upload_dir = Path(BACKEND_UPLOAD_DIR) / collection_name
        upload_dir.mkdir(parents=True, exist_ok=True)

        file_id = str(uuid.uuid4())
        safe_filename = f"{file_id}_{file.filename}"
        file_path = upload_dir / safe_filename

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

        if is_file_in_qdrant(str(file_path), collection_name):
            file_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=409,
                detail=f"File '{file.filename}' already exists in collection for flow '{flow_id}'"
            )

        print(f"Uploaded file to: {file_path}")
        print(f"File size: {file_path.stat().st_size} bytes")

        file_info = {
            "file_id": file_id,
            "filename": file.filename,
            "file_path": str(file_path),
            "flow_id": flow_id,
            "collection_name": collection_name,
            "file_size": file_path.stat().st_size,
            "processing": True
        }
        processing_tracker.add_file(file_id, file_info)

        def process_file():
            try:
                print(f"Starting background processing for file: {file_path}")
                success = upload_to_qdrant(
                    file_path=str(file_path),
                    file_name=file.filename,
                    file_id=file_id,
                    flow_id=collection_name,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                )

                if not success:
                    print(f"❌ Failed to process file: {file_path}")
                    processing_tracker.update_file(file_id, {"status": "failed", "error": "Processing failed"})
                    file_path.unlink(missing_ok=True)
                else:
                    processing_tracker.remove_file(file_id)
                    print(f"✅ Successfully processed file: {file_path}")

            except Exception as e:
                print(f"❌ Error processing file in background: {e}")
                processing_tracker.update_file(file_id, {"status": "failed", "error": str(e)})
                file_path.unlink(missing_ok=True)

        background_tasks.add_task(process_file)

        return {
            "success": True,
            "message": f"File '{file.filename}' uploaded successfully and is being processed",
            "file_info": file_info
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.delete(f"/{{flow_id}}{COLLECTIONS_FILES_ENDPOINT}")
async def delete_file_from_collection(
        request: Request,
        flow_id: str,
        file_path: str
) -> Dict[str, Any]:
    """Delete a specific file from a collection using flow_id"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        if not flow_id.strip():
            raise HTTPException(status_code=400, detail="Flow ID cannot be empty")

        has_access = await verify_user_flow_access(request, flow_id)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You don't have permission to access flow '{flow_id}'"
            )

        collection_name = construct_collection_name(flow_id)

        # Check if collection exists
        client = QdrantClient(url=QDRANT_URL)
        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_name not in existing_collection_names:
            raise HTTPException(
                status_code=404,
                detail=f"Collection for flow '{flow_id}' not found"
            )

        # Check if file exists in Qdrant
        if not is_file_in_qdrant(file_path, collection_name):
            raise HTTPException(
                status_code=404,
                detail=f"File not found in collection for flow '{flow_id}'"
            )

        # Delete file from Qdrant using helper function
        success = delete_file_from_qdrant(
            file_path=file_path,
            flow_id=collection_name
        )

        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete file from Qdrant collection"
            )

        file_path_obj = Path(file_path)
        physical_file_deleted = False
        if file_path_obj.exists():
            try:
                file_path_obj.unlink()
                print(f"Deleted physical file: {file_path_obj}")
                physical_file_deleted = True
            except Exception as e:
                print(f"Warning: Could not delete physical file {file_path_obj}: {e}")

        return {
            "success": True,
            "message": f"File deleted successfully from collection for flow '{flow_id}'",
            "file_path": file_path,
            "flow_id": flow_id,
            "collection_name": collection_name,
            "qdrant_deleted": True,
            "physical_file_deleted": physical_file_deleted
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")
