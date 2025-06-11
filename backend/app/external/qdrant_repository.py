import os
import uuid
import requests
from typing import Dict, Any, List, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from ..models.document import DocumentChunk, CollectionInfo


class QdrantRepository:
    def __init__(self):
        self.url = os.getenv("QDRANT_INTERNAL_URL", "http://qdrant:6333")
        self.collections_endpoint = os.getenv("QDRANT_COLLECTIONS_ENDPOINT", "/collections")
        self.client = QdrantClient(url=self.url)

    async def check_connection(self) -> bool:
        """Check if Qdrant service is reachable"""
        try:
            response = requests.get(f"{self.url}{self.collections_endpoint}", timeout=5)
            return response.status_code == 200
        except Exception:
            return False

    async def create_collection(self, collection_name: str, vector_size: int) -> CollectionInfo:
        """Create a new collection"""
        try:
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=vector_size,
                    distance=Distance.COSINE
                )
            )

            collection_info = self.client.get_collection(collection_name)
            return CollectionInfo(
                name=collection_name,
                vectors_count=collection_info.vectors_count,
                points_count=collection_info.points_count,
                status=collection_info.status,
                vector_size=collection_info.config.params.vectors.size,
                distance=collection_info.config.params.vectors.distance.name
            )
        except Exception as e:
            raise Exception(f"Failed to create collection: {str(e)}")

    async def delete_collection(self, collection_name: str) -> bool:
        """Delete a collection"""
        try:
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]

            if collection_name not in collection_names:
                return True

            self.client.delete_collection(collection_name)
            return True
        except Exception:
            return False

    async def collection_exists(self, collection_name: str) -> bool:
        """Check if collection exists"""
        try:
            collections = self.client.get_collections().collections
            return collection_name in [c.name for c in collections]
        except Exception:
            return False

    async def get_collection_info(self, collection_name: str) -> Optional[CollectionInfo]:
        """Get detailed information about a collection"""
        try:
            if not await self.collection_exists(collection_name):
                return None

            collection_info = self.client.get_collection(collection_name)
            return CollectionInfo(
                name=collection_name,
                vectors_count=collection_info.vectors_count,
                points_count=collection_info.points_count,
                status=collection_info.status,
                vector_size=collection_info.config.params.vectors.size,
                distance=collection_info.config.params.vectors.distance.name
            )
        except Exception as e:
            raise Exception(f"Failed to get collection info: {str(e)}")

    async def upload_documents(self, collection_name: str, chunks: List[DocumentChunk]) -> bool:
        """Upload document chunks to collection"""
        try:
            points = []
            for chunk in chunks:
                point_id = str(uuid.uuid4())
                points.append({
                    "id": point_id,
                    "vector": chunk.embedding,
                    "payload": {
                        "page_content": chunk.content,
                        "metadata": chunk.metadata
                    }
                })

            if points:
                self.client.upsert(
                    collection_name=collection_name,
                    points=points
                )
                return True
            return False
        except Exception as e:
            raise Exception(f"Failed to upload documents: {str(e)}")

    async def delete_documents_by_file_path(self, collection_name: str, file_path: str) -> int:
        """Delete all documents from a specific file"""
        try:
            # First, find all points with this file path
            response = self.client.scroll(
                collection_name=collection_name,
                scroll_filter={
                    "must": [
                        {
                            "key": "metadata.file_path",
                            "match": {"value": file_path}
                        }
                    ]
                },
                with_payload=False,
                with_vectors=False
            )

            point_ids = [point.id for point in response[0]]

            if point_ids:
                self.client.delete(
                    collection_name=collection_name,
                    points_selector=point_ids
                )

            return len(point_ids)
        except Exception as e:
            raise Exception(f"Failed to delete documents: {str(e)}")

    async def check_file_exists(self, collection_name: str, file_path: str) -> bool:
        """Check if file already exists in collection"""
        try:
            response = self.client.scroll(
                collection_name=collection_name,
                scroll_filter={
                    "must": [
                        {
                            "key": "metadata.file_path",
                            "match": {"value": file_path}
                        }
                    ]
                },
                limit=1
            )
            return len(response[0]) > 0
        except Exception:
            return False

    async def get_files_in_collection(self, collection_name: str) -> List[Dict[str, Any]]:
        """Get all unique files in a collection"""
        try:
            if not await self.collection_exists(collection_name):
                return []

            response = self.client.scroll(
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
                            "file_size": metadata.get("file_size"),
                            "flow_id": metadata.get("flow_id"),
                            "includes_images": metadata.get("includes_images", False)
                        }

            return list(file_info_by_path.values())
        except Exception as e:
            raise Exception(f"Failed to get files in collection: {str(e)}")
