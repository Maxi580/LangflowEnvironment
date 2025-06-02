import os
import requests
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from .collection_helper import get_ollama_embedding

OLLAMA_URL = os.getenv("INTERNAL_OLLAMA_URL", "http://ollama:11434")
QDRANT_URL = os.getenv("INTERNAL_QDRANT_URL", "http://qdrant:6333")
LANGFLOW_URL = os.getenv("LANGFLOW_INTERNAL_URL", "http://langflow:7860")
DEFAULT_EMBEDDING_MODEL = os.getenv("DEFAULT_EMBEDDING_MODEL", "nomic-embed-text")
DEFAULT_CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
DEFAULT_CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))
DEFAULT_COLLECTION = os.getenv("DEFAULT_COLLECTION", "langflow_documents")


def check_ollama_connection(base_url: str = OLLAMA_URL) -> bool:
    try:
        response = requests.get(f"{base_url}/api/tags")
        if response.status_code == 200:
            print("✓ Ollama connection successful")
            models = response.json().get("models", [])
            if models:
                print(f"  Available models: {', '.join([m.get('name', 'unknown') for m in models])}")
            return True
        else:
            print(f"✗ Ollama connection failed: HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Ollama connection failed: {e}")
        return False


def check_qdrant_connection(url: str = QDRANT_URL, flow_id: str = None) -> bool:
    try:
        response = requests.get(f"{url}/collections")
        if response.status_code == 200:
            print("✓ Qdrant connection successful")
            collections = response.json().get("result", {}).get("collections", [])
            existing_collection_names = [c.get('name', 'unknown') for c in collections]

            if collections:
                print(f"  Existing collections: {', '.join(existing_collection_names)}")

            if flow_id and flow_id not in existing_collection_names:
                try:
                    sample_embedding = get_ollama_embedding(
                        "Sample text for collection initialization",
                        DEFAULT_EMBEDDING_MODEL
                    )
                    vector_size = len(sample_embedding)

                    client = QdrantClient(url=url)
                    client.create_collection(
                        collection_name=flow_id,
                        vectors_config=VectorParams(
                            size=vector_size,
                            distance=Distance.COSINE
                        )
                    )
                    print(f"  ✓ Created new collection for flow: {flow_id}")
                except Exception as e:
                    print(f"  ✗ Failed to create collection for flow ID {flow_id}: {e}")

            return True
        else:
            print(f"✗ Qdrant connection failed: HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Qdrant connection failed: {e}")
        return False


def check_langflow_connection(base_url: str = LANGFLOW_URL) -> bool:
    """Check if Langflow service is running using the health_check endpoint"""
    try:
        url = f"{base_url}/health"
        headers = {
            'Accept': 'application/json'
        }
        response = requests.get(url, headers=headers, timeout=5)

        if response.status_code == 200:
            print("✓ Langflow connection successful")
            return True
        else:
            print(f"✗ Langflow connection failed: HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Langflow connection failed: {e}")
        return False