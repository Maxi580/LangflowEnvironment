import os
import requests
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams  # Import correct models


def get_ollama_embedding(text: str, model: str = "nomic-embed-text", base_url: str = "http://localhost:11434") -> List[
    float]:
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


def check_ollama_connection(base_url: str = "http://localhost:11434") -> bool:
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


def check_qdrant_connection(url: str = "http://localhost:6333") -> bool:
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


def upload_files_to_qdrant(
        file_paths: List[str],
        collection_name: str = "my_documents",
        qdrant_url: str = "http://localhost:6333",
        ollama_url: str = "http://localhost:11434",
        ollama_model: str = "nomic-embed-text",
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        print_embeddings: bool = False
) -> None:
    """
    Process files and upload to Qdrant using Ollama embeddings, matching Langflow's format

    Args:
        file_paths: List of file paths to process
        collection_name: Name of Qdrant collection
        qdrant_url: URL of Qdrant server
        ollama_url: URL of Ollama server
        ollama_model: Embedding model name
        chunk_size: Size of text chunks
        chunk_overlap: Overlap between chunks
        print_embeddings: Whether to print embedding details
    """
    if not check_ollama_connection(ollama_url):
        print("Please make sure Ollama is running and accessible")
        return

    if not check_qdrant_connection(qdrant_url):
        print("Please make sure Qdrant is running and accessible")
        return

    try:
        print(f"Testing embedding with model '{ollama_model}'...")
        sample_embedding = get_ollama_embedding("Sample text for dimension testing",
                                                ollama_model,
                                                ollama_url)
        vector_size = len(sample_embedding)
        print(f"✓ Embedding successful: vector size is {vector_size}")

        if print_embeddings:
            print(f"  Sample embedding (first 5 dimensions): {sample_embedding[:5]}")
    except Exception as e:
        print(f"✗ Failed to get sample embedding: {e}")
        return

    try:
        print(f"Connecting to Qdrant at {qdrant_url}...")
        client = QdrantClient(url=qdrant_url)
    except Exception as e:
        print(f"✗ Failed to initialize Qdrant client: {e}")
        return

    collections = client.get_collections().collections
    collection_names = [collection.name for collection in collections]

    if collection_name not in collection_names:
        print(f"Creating new collection: {collection_name}")

        try:
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=vector_size,
                    distance=Distance.COSINE
                )
            )
            print(f"✓ Collection '{collection_name}' created successfully")
        except Exception as e:
            print(f"✗ Failed to create collection: {e}")
            return
    else:
        print(f"Using existing collection: {collection_name}")

    for file_idx, file_path in enumerate(file_paths):
        if not os.path.exists(file_path):
            print(f"✗ File not found: {file_path}")
            continue

        print(f"Processing file {file_idx + 1}/{len(file_paths)}: {file_path}")

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            print(f"  File size: {len(content)} characters")

            chunks = []
            for i in range(0, len(content), chunk_size - chunk_overlap):
                chunk = content[i:i + chunk_size]
                if chunk:
                    chunks.append(chunk)

            print(f"  Created {len(chunks)} chunks")

            points = []
            for chunk_idx, chunk in enumerate(chunks):
                try:
                    embedding = get_ollama_embedding(chunk, ollama_model, ollama_url)

                    point_id = file_idx * 10000 + chunk_idx

                    # Using Langflow-compatible structure
                    points.append({
                        "id": point_id,
                        "vector": embedding,
                        "payload": {
                            "page_content": chunk,  # Langflow uses page_content instead of text
                            "metadata": {  # Nested metadata structure
                                "file_path": file_path,  # Langflow seems to use file_path in metadata
                                "chunk_idx": chunk_idx,
                                "filename": os.path.basename(file_path)
                            }
                        }
                    })

                    if chunk_idx % 5 == 0 or chunk_idx == len(chunks) - 1:
                        print(f"  Processed chunk {chunk_idx + 1}/{len(chunks)}")

                except Exception as e:
                    print(f"  ✗ Error embedding chunk {chunk_idx}: {e}")

            if points:
                client.upsert(
                    collection_name=collection_name,
                    points=points
                )
                print(f"  ✓ Uploaded {len(points)} points to Qdrant")
            else:
                print("  ✗ No points to upload")

        except Exception as e:
            print(f"✗ Error processing file {file_path}: {e}")

    print(f"Finished processing {len(file_paths)} files")

    try:
        collection_info = client.get_collection(collection_name=collection_name)
        print(f"\nCollection '{collection_name}' info:")
        print(f"  Vector size: {collection_info.config.params.vectors.size}")
        print(f"  Distance: {collection_info.config.params.vectors.distance}")
        print(f"  Points count: {collection_info.vectors_count}")
    except Exception as e:
        print(f"✗ Failed to get collection info: {e}")


if __name__ == "__main__":
    upload_files_to_qdrant(
        file_paths=["file.txt"],
        collection_name="langflow_compatible_collection",
        qdrant_url="http://localhost:6333",
        ollama_url="http://localhost:11434",
        ollama_model="nomic-embed-text",
        print_embeddings=True
    )