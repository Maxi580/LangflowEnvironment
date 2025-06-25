import os
import uuid
import requests
from typing import Dict, Any, List, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from ..models.document import DocumentChunk, CollectionInfo


def get_collection_name(user_id: str, flow_id: str) -> str:
    collection_name = f"user_{user_id}_flow_{flow_id}"

    return collection_name


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

    async def create_collection(self, user_id: str, flow_id: str, vector_size: int) -> CollectionInfo:
        try:
            collection_name = get_collection_name(user_id, flow_id)
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

    async def delete_collection(self, user_id: str, flow_id: str) -> bool:
        """Delete a collection"""
        try:
            collection_name = get_collection_name(user_id, flow_id)
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]

            if collection_name not in collection_names:
                return True

            self.client.delete_collection(collection_name)
            return True
        except Exception:
            return False

    async def collection_exists(self, user_id: str, flow_id: str) -> bool:
        """Check if collection exists"""
        try:
            collection_name = get_collection_name(user_id, flow_id)
            collections = self.client.get_collections().collections
            return collection_name in [c.name for c in collections]
        except Exception:
            return False

    async def get_collection_info(self, user_id: str, flow_id: str) -> Optional[CollectionInfo]:
        """Get detailed information about a collection"""
        try:
            if not await self.collection_exists(user_id, flow_id):
                return None

            collection_name = get_collection_name(user_id, flow_id)
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

    async def upload_documents(self, user_id: str, flow_id: str, chunks: List[DocumentChunk]) -> bool:
        """Upload document chunks to collection"""
        try:
            collection_name = get_collection_name(user_id, flow_id)
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

    async def delete_documents_by_file_path(self, user_id: str, flow_id: str, file_path: str) -> int:
        """Delete all documents from a specific file"""
        try:
            collection_name = get_collection_name(user_id, flow_id)
            total_deleted = 0

            while True:
                points, next_page_offset = self.client.scroll(
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
                    with_vectors=False,
                    limit=100
                )

                if not points:
                    break
                point_ids = [point.id for point in points]

                self.client.delete(
                    collection_name=collection_name,
                    points_selector=point_ids
                )

                total_deleted += len(point_ids)
                print(f"Deleted batch of {len(point_ids)} points")

                if len(points) < 100:
                    break

            return total_deleted

        except Exception as e:
            print(f"Error in delete_documents_by_file_path: {e}")
            raise Exception(f"Failed to delete documents: {str(e)}")

    async def check_file_exists(self, user_id: str, flow_id: str, file_path: str) -> bool:
        """Check if file already exists in collection"""
        try:
            collection_name = get_collection_name(user_id, flow_id)
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

    async def get_files_in_collection(self, user_id: str, flow_id: str) -> List[Dict[str, Any]]:
        """Get all unique files in a collection"""
        try:
            if not await self.collection_exists(user_id, flow_id):
                return []

            collection_name = get_collection_name(user_id, flow_id)

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
