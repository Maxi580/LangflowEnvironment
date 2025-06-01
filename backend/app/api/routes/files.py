from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, BackgroundTasks
import os
import uuid
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, List
from pydantic import BaseModel

from ..utils.jwt_helper import get_user_token
from ..utils.file_service import (
    upload_to_qdrant,
    delete_file_from_qdrant,
    get_files_from_collection,
    is_file_in_qdrant,
    test_embedding_model
)
from ..utils.connection import check_qdrant_connection
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

QDRANT_URL = os.getenv("INTERNAL_QDRANT_URL", "http://qdrant:6333")
OLLAMA_URL = os.getenv("INTERNAL_OLLAMA_URL", "http://ollama:11434")
COLLECTIONS_BASE_ENDPOINT = os.getenv("COLLECTIONS_BASE_ENDPOINT", "/api/v1/collections")
BACKEND_UPLOAD_DIR = os.getenv("BACKEND_UPLOAD_DIR", "/app/uploads")

router = APIRouter(prefix=COLLECTIONS_BASE_ENDPOINT, tags=["collections"])


class CollectionCreateRequest(BaseModel):
    collection_name: str
    embedding_model: Optional[str] = "nomic-embed-text"


class FileDeleteRequest(BaseModel):
    file_path: str
    collection_name: str


# LIST COLLECTIONS
@router.get("")
async def list_collections(request: Request) -> Dict[str, Any]:
    """List all Qdrant collections"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        client = QdrantClient(url=QDRANT_URL)
        collections_response = client.get_collections()

        collections_info = []
        for collection in collections_response.collections:
            try:
                collection_info = client.get_collection(collection.name)
                collections_info.append({
                    "name": collection.name,
                    "vectors_count": collection_info.vectors_count,
                    "points_count": collection_info.points_count,
                    "status": collection_info.status,
                    "config": {
                        "vector_size": collection_info.config.params.vectors.size,
                        "distance": collection_info.config.params.vectors.distance.name
                    }
                })
            except Exception as e:
                print(f"Error getting info for collection {collection.name}: {e}")
                collections_info.append({
                    "name": collection.name,
                    "error": str(e)
                })

        return {
            "success": True,
            "collections": collections_info,
            "total_collections": len(collections_info)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing collections: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing collections: {str(e)}")


# CREATE COLLECTION
@router.post("")
async def create_collection(
        request: Request,
        collection_request: CollectionCreateRequest
) -> Dict[str, Any]:
    """Create a new Qdrant collection"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        if not collection_request.collection_name.strip():
            raise HTTPException(status_code=400, detail="Collection name cannot be empty")

        # Test embedding model to get vector size
        print(f"Testing embedding model: {collection_request.embedding_model}")
        test_result = test_embedding_model(collection_request.embedding_model, OLLAMA_URL)

        if not test_result["success"]:
            raise HTTPException(
                status_code=500,
                detail=f"Could not detect vector size for model '{collection_request.embedding_model}': {test_result['error']}"
            )

        vector_size = test_result["vector_size"]
        print(f"Detected vector size: {vector_size}")

        client = QdrantClient(url=QDRANT_URL)

        # Check if collection already exists
        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_request.collection_name in existing_collection_names:
            # Get existing collection info
            collection_info = client.get_collection(collection_request.collection_name)
            return {
                "success": True,
                "message": "Collection already exists",
                "collection": {
                    "name": collection_request.collection_name,
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

        # Create new collection
        print(f"Creating collection '{collection_request.collection_name}' with vector size {vector_size}")

        client.create_collection(
            collection_name=collection_request.collection_name,
            vectors_config=VectorParams(
                size=vector_size,
                distance=Distance.COSINE
            )
        )

        print(f"Successfully created collection: {collection_request.collection_name}")

        # Get info for the newly created collection
        collection_info = client.get_collection(collection_request.collection_name)

        return {
            "success": True,
            "message": "Collection created successfully",
            "collection": {
                "name": collection_request.collection_name,
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


# DELETE COLLECTION
@router.delete("/{collection_name}")
async def delete_collection(
        request: Request,
        collection_name: str
) -> Dict[str, Any]:
    """Delete a Qdrant collection"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        client = QdrantClient(url=QDRANT_URL)

        # Check if collection exists
        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_name not in existing_collection_names:
            raise HTTPException(status_code=404, detail=f"Collection '{collection_name}' not found")

        # Get collection info before deletion
        collection_info = client.get_collection(collection_name)
        points_count = collection_info.points_count

        # Delete the collection
        client.delete_collection(collection_name)

        print(f"Deleted collection: {collection_name} (had {points_count} points)")

        return {
            "success": True,
            "message": f"Collection '{collection_name}' deleted successfully",
            "collection_name": collection_name,
            "points_deleted": points_count
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting collection: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting collection: {str(e)}")


# LIST FILES IN COLLECTION
@router.get("/{collection_name}/files")
async def list_files_in_collection(
        request: Request,
        collection_name: str
) -> Dict[str, Any]:
    """List all files in a specific collection"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        # Check if collection exists
        client = QdrantClient(url=QDRANT_URL)
        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_name not in existing_collection_names:
            raise HTTPException(status_code=404, detail=f"Collection '{collection_name}' not found")

        files = get_files_from_collection(collection_name)

        return {
            "success": True,
            "collection_name": collection_name,
            "files": files,
            "total_files": len(files)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing files in collection: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing files in collection: {str(e)}")


# UPLOAD FILE TO COLLECTION
@router.post("/{collection_name}/files/upload")
async def upload_file_to_collection(
        request: Request,
        collection_name: str,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        embedding_model: Optional[str] = Form("nomic-embed-text"),
        chunk_size: Optional[int] = Form(1000),
        chunk_overlap: Optional[int] = Form(200)
) -> Dict[str, Any]:
    """Upload a file to a specific collection"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        # Check if collection exists
        client = QdrantClient(url=QDRANT_URL)
        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_name not in existing_collection_names:
            raise HTTPException(status_code=404, detail=f"Collection '{collection_name}' not found")

        # Create upload directory if it doesn't exist
        upload_dir = Path(BACKEND_UPLOAD_DIR) / collection_name
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique file ID and save file
        file_id = str(uuid.uuid4())
        safe_filename = f"{file_id}_{file.filename}"
        file_path = upload_dir / safe_filename

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

        # Check if file already exists in collection
        if is_file_in_qdrant(str(file_path), collection_name):
            # Clean up the uploaded file since it already exists
            file_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=409,
                detail=f"File '{file.filename}' already exists in collection '{collection_name}'"
            )

        print(f"Uploaded file to: {file_path}")
        print(f"File size: {file_path.stat().st_size} bytes")

        # Process file in background
        def process_file():
            try:
                print(f"Starting background processing for file: {file_path}")
                success = upload_to_qdrant(
                    file_path=str(file_path),
                    file_name=file.filename,
                    file_id=file_id,
                    flow_id=collection_name,
                    embedding_model=embedding_model,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap
                )

                if not success:
                    print(f"❌ Failed to process file: {file_path}")
                    file_path.unlink(missing_ok=True)
                else:
                    print(f"✅ Successfully processed file: {file_path}")

            except Exception as e:
                print(f"❌ Error processing file in background: {e}")
                file_path.unlink(missing_ok=True)

        background_tasks.add_task(process_file)

        return {
            "success": True,
            "message": f"File '{file.filename}' uploaded successfully and is being processed",
            "file_info": {
                "file_id": file_id,
                "filename": file.filename,
                "file_path": str(file_path),
                "collection_name": collection_name,
                "file_size": file_path.stat().st_size,
                "processing": True
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


# DELETE FILE FROM COLLECTION
@router.delete("/{collection_name}/files")
async def delete_file_from_collection(
        request: Request,
        collection_name: str,
        file_delete_request: FileDeleteRequest
) -> Dict[str, Any]:
    """Delete a specific file from a collection"""
    try:
        token = get_user_token(request)
        if not token:
            raise HTTPException(status_code=401, detail="No valid authentication token found")

        if not check_qdrant_connection():
            raise HTTPException(status_code=503, detail="Qdrant service is not available")

        # Validate that collection_name matches the one in the request body
        if file_delete_request.collection_name != collection_name:
            raise HTTPException(
                status_code=400,
                detail="Collection name in URL must match collection name in request body"
            )

        # Check if collection exists
        client = QdrantClient(url=QDRANT_URL)
        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_name not in existing_collection_names:
            raise HTTPException(status_code=404, detail=f"Collection '{collection_name}' not found")

        # Check if file exists in collection
        if not is_file_in_qdrant(file_delete_request.file_path, collection_name):
            raise HTTPException(
                status_code=404,
                detail=f"File not found in collection '{collection_name}'"
            )

        # Delete file from Qdrant
        success = delete_file_from_qdrant(
            file_path=file_delete_request.file_path,
            flow_id=collection_name
        )

        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete file from Qdrant collection"
            )

        # Also delete the physical file if it exists
        file_path = Path(file_delete_request.file_path)
        if file_path.exists():
            try:
                file_path.unlink()
                print(f"Deleted physical file: {file_path}")
                physical_file_deleted = True
            except Exception as e:
                print(f"Warning: Could not delete physical file {file_path}: {e}")
                physical_file_deleted = False
        else:
            physical_file_deleted = False

        return {
            "success": True,
            "message": f"File deleted successfully from collection '{collection_name}'",
            "file_path": file_delete_request.file_path,
            "collection_name": collection_name,
            "qdrant_deleted": True,
            "physical_file_deleted": physical_file_deleted
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")
