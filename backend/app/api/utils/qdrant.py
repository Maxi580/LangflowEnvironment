import os
from pathlib import Path
from fastapi import Request

import uuid
from typing import List, Dict, Any, Optional, Tuple
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from ..routes.flows import get_flows
from .embedding import get_text_embedding, get_vector_size, read_file_content

OLLAMA_URL = os.getenv("OLLAMA_INTERNAL_URL")
QDRANT_URL = os.getenv("QDRANT_INTERNAL_URL")
DEFAULT_EMBEDDING_MODEL = os.getenv("DEFAULT_EMBEDDING_MODEL")
DEFAULT_VISION_MODEL = os.getenv("DEFAULT_VISION_MODEL")
DEFAULT_CHUNK_SIZE = int(os.getenv("CHUNK_SIZE"))
DEFAULT_CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP"))

OLLAMA_TAGS_ENDPOINT = os.getenv("OLLAMA_TAGS_ENDPOINT", "/api/tags")
OLLAMA_EMBEDDINGS_ENDPOINT = os.getenv("OLLAMA_EMBEDDINGS_ENDPOINT", "/api/embeddings")
OLLAMA_GENERATE_ENDPOINT = os.getenv("OLLAMA_GENERATE_ENDPOINT", "/api/generate")


def construct_collection_name(flow_id: str):
    return flow_id


async def verify_user_flow_access(request: Request, flow_id: str) -> bool:
    try:
        print(f"Checking user access to flow: {flow_id}")
        flows = await get_flows(request, remove_example_flows=True, header_flows=False, get_all=True)
        user_flow_ids = [flow.get('id') for flow in flows if flow.get('id')]
        has_access = flow_id in user_flow_ids
        return has_access
    except Exception as e:
        print(f"Error checking flow access: {e}")
        return False


def is_file_in_qdrant(file_path: str, collection_name: str, qdrant_url: str = QDRANT_URL) -> bool:
    try:
        client = QdrantClient(url=qdrant_url)
        response = client.scroll(
            collection_name=collection_name,
            scroll_filter={
                "must": [
                    {
                        "key": "metadata.file_path",
                        "match": {
                            "value": file_path
                        }
                    }
                ]
            },
            limit=1
        )
        return len(response[0]) > 0
    except Exception as e:
        print(f"Error checking if file exists in Qdrant: {e}")
        return False


def upload_to_qdrant(
        file_path: str,
        file_name: str,
        file_id: str,
        flow_id: str = None,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
        qdrant_url: str = QDRANT_URL,
        include_images: bool = True,
) -> bool:
    try:
        print(f"Processing file: {file_path}")

        collection_name = flow_id
        print(f"Using collection name: {collection_name}")

        try:
            content, file_type = read_file_content(file_path, include_images)
            print(f"File type detected: {file_type}")
            print(f"File size: {len(content)} characters")
            if include_images:
                print("✓ Including embedded image descriptions")
        except ValueError as e:
            print(f"Error: {str(e)}")
            return False

        vector_size = get_vector_size()
        print(f"Vector size: {vector_size}")

        client = QdrantClient(url=qdrant_url)

        collections = client.get_collections().collections
        collection_names = [collection.name for collection in collections]

        if collection_name not in collection_names:
            print(f"Creating new collection: {collection_name}")
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=vector_size,
                    distance=Distance.COSINE
                )
            )
        else:
            print(f"Using existing collection: {collection_name}")

        chunks = []
        for i in range(0, len(content), chunk_size - chunk_overlap):
            chunk = content[i:i + chunk_size]
            if chunk:
                chunks.append(chunk)

        print(f"Created {len(chunks)} chunks")

        points = []
        for chunk_idx, chunk in enumerate(chunks):
            if chunk_idx % 5 == 0:
                print(f"Processing chunk {chunk_idx + 1}/{len(chunks)}")

            embedding = get_text_embedding(chunk)
            point_id = str(uuid.uuid4())

            points.append({
                "id": point_id,
                "vector": embedding,
                "payload": {
                    "page_content": chunk,
                    "metadata": {
                        "file_path": file_path,
                        "file_id": file_id,
                        "chunk_idx": chunk_idx,
                        "filename": file_name,
                        "file_type": file_type,
                        "flow_id": flow_id,
                        "includes_images": include_images
                    }
                }
            })

        if points:
            client.upsert(
                collection_name=collection_name,
                points=points
            )
            print(f"Uploaded {len(points)} points to Qdrant")
            return True
        else:
            print("No points to upload")
            return False

    except Exception as e:
        print(f"Error processing file {file_path}: {e}")
        return False


def delete_file_from_qdrant(
        file_path: str,
        flow_id: str = None,
        qdrant_url: str = QDRANT_URL
) -> bool:
    try:
        collection_name = flow_id
        client = QdrantClient(url=qdrant_url)

        response = client.scroll(
            collection_name=collection_name,
            scroll_filter={
                "must": [
                    {
                        "key": "metadata.file_path",
                        "match": {
                            "value": file_path
                        }
                    }
                ]
            },
            with_payload=False,
            with_vectors=False
        )

        point_ids = [point.id for point in response[0]]

        if not point_ids:
            print(f"No points found for file: {file_path}")
            return True

        client.delete(
            collection_name=collection_name,
            points_selector=point_ids
        )

        print(f"✓ Deleted {len(point_ids)} points for file: {file_path}")
        return True

    except Exception as e:
        print(f"✗ Error deleting file from Qdrant: {e}")
        return False


def get_files_from_collection(
        collection_name: str,
        qdrant_url: str = QDRANT_URL
) -> List[Dict[str, Any]]:
    """
    Query Qdrant for all files in a specific collection

    Args:
        collection_name: Name of the collection (flow_id)
        qdrant_url: URL of Qdrant server

    Returns:
        List of file information dictionaries
    """
    try:
        client = QdrantClient(url=qdrant_url)

        collections = client.get_collections().collections
        collection_names = [collection.name for collection in collections]

        if collection_name not in collection_names:
            print(f"Collection '{collection_name}' does not exist")
            return []

        response = client.scroll(
            collection_name=collection_name,
            scroll_filter={},
            with_payload=True,
            with_vectors=False,
            limit=1000
        )

        file_info_by_path = {}
        for point in response[0]:
            if "metadata" in point.payload:
                metadata = point.payload["metadata"]
                file_path = metadata.get("file_path")

                if file_path and file_path not in file_info_by_path:
                    file_info_by_path[file_path] = {
                        "file_id": metadata.get("file_id"),
                        "file_path": file_path,
                        "file_name": metadata.get("filename"),
                        "file_type": metadata.get("file_type"),
                        "flow_id": metadata.get("flow_id"),
                        "includes_images": metadata.get("includes_images", False)
                    }

        files = []
        for file_path, info in file_info_by_path.items():
            path_obj = Path(file_path)
            if path_obj.exists() and path_obj.is_file():
                info["file_size"] = os.path.getsize(file_path)
                files.append(info)
            else:
                print(f"File not found on disk: {file_path}")

        return files

    except Exception as e:
        print(f"Error querying Qdrant for files in collection {collection_name}: {e}")
        return []


def delete_single_collection(flow_id: str, qdrant_url: str = QDRANT_URL) -> Dict[str, Any]:
    """
    Delete a single Qdrant collection by flow_id
    Returns result with success status and details
    """
    try:
        collection_name = construct_collection_name(flow_id)
        client = QdrantClient(url=qdrant_url)

        collections = client.get_collections().collections
        existing_collection_names = [c.name for c in collections]

        if collection_name not in existing_collection_names:
            return {
                "success": False,
                "error": "not_found",
                "message": f"Collection for flow '{flow_id}' not found",
                "flow_id": flow_id,
                "collection_name": collection_name
            }

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

    except Exception as e:
        error_msg = f"Error deleting collection for flow {flow_id}: {str(e)}"
        print(error_msg)
        return {
            "success": False,
            "error": "deletion_failed",
            "message": error_msg,
            "flow_id": flow_id,
            "collection_name": construct_collection_name(flow_id)
        }


def delete_multiple_collections(flow_ids: List[str], qdrant_url: str = QDRANT_URL) -> Dict[str, Any]:
    results = {
        "success_count": 0,
        "error_count": 0,
        "successful_deletions": [],
        "failed_deletions": [],
        "total_points_deleted": 0
    }

    for flow_id in flow_ids:
        deletion_result = delete_single_collection(flow_id, qdrant_url)

        if deletion_result["success"]:
            results["success_count"] += 1
            results["successful_deletions"].append(deletion_result)
            results["total_points_deleted"] += deletion_result.get("points_deleted", 0)
        else:
            results["error_count"] += 1
            results["failed_deletions"].append(deletion_result)

    return results
