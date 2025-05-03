import os
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
    """
    Check if Ollama API is reachable

    Args:
        base_url: Ollama API base URL

    Returns:
        True if connection successful, False otherwise
    """
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


def check_qdrant_connection(url: str = QDRANT_URL) -> bool:
    """
    Check if Qdrant API is reachable

    Args:
        url: Qdrant API URL

    Returns:
        True if connection successful, False otherwise
    """
    try:
        response = requests.get(f"{url}/collections")
        if response.status_code == 200:
            print("✓ Qdrant connection successful")
            collections = response.json().get("result", {}).get("collections", [])
            if collections:
                print(f"  Existing collections: {', '.join([c.get('name', 'unknown') for c in collections])}")
            return True
        else:
            print(f"✗ Qdrant connection failed: HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Qdrant connection failed: {e}")
        return False


def get_ollama_embedding(text: str, model: str = DEFAULT_EMBEDDING_MODEL, base_url: str = OLLAMA_URL) -> List[float]:
    """
    Get embeddings directly from Ollama API

    Args:
        text: Text to embed
        model: Embedding model to use (must be available in Ollama)
        base_url: Ollama API base URL

    Returns:
        List of embedding values
    """
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


def is_file_in_qdrant(
        file_path: str,
        collection_name: str = DEFAULT_COLLECTION,
        qdrant_url: str = QDRANT_URL
) -> bool:
    """
    Check if a file is already indexed in Qdrant

    Args:
        file_path: Path to the file
        collection_name: Name of Qdrant collection
        qdrant_url: URL of Qdrant server

    Returns:
        True if file exists in collection, False otherwise
    """
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
    """
    Detect the file type based on extension and content

    Args:
        file_path: Path to the file

    Returns:
        String indicating file type ('text', 'pdf', or 'unknown')
    """
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
    """
    Extract text content from a PDF file

    Args:
        file_path: Path to the PDF file

    Returns:
        Extracted text content
    """
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
    """
    Read content from a file based on its type

    Args:
        file_path: Path to the file

    Returns:
        Tuple of (file_content, file_type)
    """
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
        collection_name: str = DEFAULT_COLLECTION,
        embedding_model: str = DEFAULT_EMBEDDING_MODEL,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
        ollama_url: str = OLLAMA_URL,
        qdrant_url: str = QDRANT_URL,
) -> bool:
    """
    Process file from disk and upload to Qdrant

    Args:
        file_path: Path to the file
        file_name: Original filename
        file_id: Unique ID for this file
        collection_name: Name of Qdrant collection
        embedding_model: Embedding model to use
        chunk_size: Size of text chunks
        chunk_overlap: Overlap between chunks
        ollama_url: URL for Ollama API
        qdrant_url: URL for Qdrant API

    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"Processing file: {file_path}")

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
                        "file_type": file_type
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
        collection_name: str = DEFAULT_COLLECTION,
        qdrant_url: str = QDRANT_URL
) -> bool:
    """
    Delete all points related to a specific file from Qdrant

    Args:
        file_path: Path to the file to delete
        collection_name: Name of Qdrant collection
        qdrant_url: URL of Qdrant server

    Returns:
        True if deletion was successful, False otherwise
    """
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