import os
from pathlib import Path

import requests
import uuid
from typing import List, Dict, Any, Optional, Tuple
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
import PyPDF2
import mimetypes
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv("INTERNAL_OLLAMA_URL", "http://ollama:11434")
QDRANT_URL = os.getenv("INTERNAL_QDRANT_URL", "http://qdrant:6333")
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


def get_ollama_embedding(text: str, model: str = DEFAULT_EMBEDDING_MODEL, base_url: str = OLLAMA_URL) -> List[float]:
    url = f"{base_url}/api/embeddings"
    payload = {
        "model": model,
        "prompt": text
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        embedding = result.get("embedding")
        if not embedding:
            raise ValueError(f"No embedding returned from Ollama API: {response.text}")
        return embedding
    except requests.exceptions.RequestException as e:
        print(f"Error connecting to Ollama API: {e}")
        raise


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


def detect_file_type(file_path: str) -> str:
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    if ext == '.pdf':
        return 'pdf'
    elif ext in ['.txt', '.md', '.py', '.js', '.html', '.css', '.json', '.xml', '.csv']:
        return 'text'

    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type:
        if mime_type == 'application/pdf':
            return 'pdf'
        elif mime_type.startswith('text/'):
            return 'text'

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            f.read(1024)
        return 'text'
    except UnicodeDecodeError:
        try:
            with open(file_path, "rb") as f:
                PyPDF2.PdfReader(f)
            return 'pdf'
        except:
            pass

    return 'unknown'


def extract_text_from_pdf(file_path: str) -> str:
    try:
        text = ""
        with open(file_path, "rb") as f:
            pdf_reader = PyPDF2.PdfReader(f)
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n\n"
        return text
    except Exception as e:
        print(f"Error extracting text from PDF {file_path}: {e}")
        raise


def read_file_content(file_path: str) -> Tuple[str, str]:
    file_type = detect_file_type(file_path)

    if file_type == 'text':
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return content, 'text'
    elif file_type == 'pdf':
        content = extract_text_from_pdf(file_path)
        return content, 'pdf'
    else:
        raise ValueError(f"Unsupported file type for {file_path}")


def upload_to_qdrant(
        file_path: str,
        file_name: str,
        file_id: str,
        flow_id: str = None,
        embedding_model: str = DEFAULT_EMBEDDING_MODEL,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
        ollama_url: str = OLLAMA_URL,
        qdrant_url: str = QDRANT_URL,
) -> bool:
    try:
        print(f"Processing file: {file_path}")

        collection_name = flow_id
        print(f"Using collection name: {collection_name}")

        try:
            content, file_type = read_file_content(file_path)
            print(f"File type detected: {file_type}")
            print(f"File size: {len(content)} characters")
        except ValueError as e:
            print(f"Error: {str(e)}")
            return False

        sample_embedding = get_ollama_embedding(
            "Sample text for dimension testing",
            embedding_model,
            ollama_url
        )
        vector_size = len(sample_embedding)
        print(f"Sample embedding size: {vector_size}")

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

            embedding = get_ollama_embedding(chunk, embedding_model, ollama_url)
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
                        "flow_id": flow_id
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
                        "flow_id": metadata.get("flow_id")
                    }

        files = []
        for file_path, info in file_info_by_path.items():
            path_obj = Path(file_path)
            if path_obj.exists() and path_obj.is_file():
                # Add file size
                info["file_size"] = os.path.getsize(file_path)
                files.append(info)
            else:
                print(f"File not found on disk: {file_path}")

        return files

    except Exception as e:
        print(f"Error querying Qdrant for files in collection {collection_name}: {e}")
        return []
