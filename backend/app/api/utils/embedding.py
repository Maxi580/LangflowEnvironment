import os
import time
import base64
from functools import lru_cache

import requests
from typing import List, Dict, Any, Optional

OLLAMA_URL = os.getenv("OLLAMA_INTERNAL_URL")
DEFAULT_EMBEDDING_MODEL = os.getenv("DEFAULT_EMBEDDING_MODEL")
DEFAULT_VISION_MODEL = os.getenv("DEFAULT_VISION_MODEL")

OLLAMA_EMBEDDINGS_ENDPOINT = os.getenv("OLLAMA_EMBEDDINGS_ENDPOINT")
OLLAMA_GENERATE_ENDPOINT = os.getenv("OLLAMA_GENERATE_ENDPOINT")
OLLAMA_TAGS_ENDPOINT = os.getenv("OLLAMA_TAGS_ENDPOINT")


@lru_cache(maxsize=5)
def get_vector_size(model_name: Optional[str] = None) -> int:
    """
    Get vector size for embedding model with caching
    Only embeds sample text once per model

    Args:
        model_name: Name of the model (defaults to DEFAULT_EMBEDDING_MODEL)

    Returns:
        Vector size for the model
    """
    if model_name is None:
        model_name = DEFAULT_EMBEDDING_MODEL

    print(f"Getting vector size for model: {model_name}")

    sample_embedding = get_text_embedding("Sample text for dimension detection")
    vector_size = len(sample_embedding)

    print(f"Vector size for model '{model_name}': {vector_size}")
    return vector_size


def get_text_embedding(text: str) -> List[float]:
    """
    Get text embedding using the configured embedding model

    Args:
        text: Text to embed

    Returns:
        List of float values representing the embedding vector

    Raises:
        ValueError: If embedding request fails or returns invalid data
    """
    url = f"{OLLAMA_URL}{OLLAMA_EMBEDDINGS_ENDPOINT}"
    model = DEFAULT_EMBEDDING_MODEL

    payload = {
        "model": model,
        "prompt": text
    }

    try:
        print(f"Requesting embedding from {url} with model: {model}")
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()

        result = response.json()
        print(f"Ollama API response status: {response.status_code}")

        if not isinstance(result, dict):
            raise ValueError(f"Expected dict response, got {type(result)}")

        embedding = result.get("embedding")
        if embedding is None:
            raise ValueError(f"No embedding field in response. Response keys: {list(result.keys())}")

        if not isinstance(embedding, list):
            raise ValueError(f"Expected list for embedding, got {type(embedding)}")

        if len(embedding) == 0:
            raise ValueError("Received empty embedding")

        # Validate that all elements are numbers
        if not all(isinstance(x, (int, float)) for x in embedding):
            raise ValueError("Embedding contains non-numeric values")

        print(f"Successfully got embedding of size {len(embedding)} for model {model}")
        return embedding

    except requests.exceptions.Timeout:
        print(f"Timeout connecting to Ollama API at {url}")
        raise ValueError(f"Timeout connecting to Ollama API (model: {model})")

    except requests.exceptions.ConnectionError:
        print(f"Connection error to Ollama API at {url}")
        raise ValueError(f"Cannot connect to Ollama API at {OLLAMA_URL} (model: {model})")

    except requests.exceptions.RequestException as e:
        print(f"Request error connecting to Ollama API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                raise ValueError(f"Ollama API error: {error_detail}")
            except:
                raise ValueError(f"Ollama API error: {e.response.text}")
        raise ValueError(f"Error connecting to Ollama API: {str(e)}")

    except ValueError:
        raise

    except Exception as e:
        print(f"Unexpected error getting embedding: {e}")
        raise ValueError(f"Unexpected error getting embedding from model {model}: {str(e)}")


def get_image_description(image_path: str, prompt: str = None) -> str:
    """
    Get image description using the configured vision model

    Args:
        image_path: Path to the image file
        prompt: Custom prompt for image description (optional)

    Returns:
        String description of the image

    Raises:
        ValueError: If image processing fails
        FileNotFoundError: If image file doesn't exist
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    url = f"{OLLAMA_URL}{OLLAMA_GENERATE_ENDPOINT}"
    model = DEFAULT_VISION_MODEL

    if prompt is None:
        prompt = "Describe this image in detail, including objects, people, text, colors, and setting."

    try:
        with open(image_path, "rb") as image_file:
            image_data = base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        raise ValueError(f"Failed to read image file {image_path}: {str(e)}")

    payload = {
        "model": model,
        "prompt": prompt,
        "images": [image_data],
        "stream": False
    }

    try:
        print(f"Requesting image description from {url} with model: {model}")
        response = requests.post(url, json=payload, timeout=120)
        response.raise_for_status()

        result = response.json()
        description = result.get("response", "").strip()

        if not description:
            raise ValueError("Empty response from vision model")

        print(f"Successfully got image description of length {len(description)}")
        return description

    except requests.exceptions.Timeout:
        print(f"Timeout connecting to Ollama API at {url}")
        raise ValueError(f"Timeout connecting to Ollama API (model: {model})")

    except requests.exceptions.ConnectionError:
        print(f"Connection error to Ollama API at {url}")
        raise ValueError(f"Cannot connect to Ollama API at {OLLAMA_URL} (model: {model})")

    except requests.exceptions.RequestException as e:
        print(f"Request error connecting to Ollama API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
                raise ValueError(f"Ollama API error: {error_detail}")
            except:
                raise ValueError(f"Ollama API error: {e.response.text}")
        raise ValueError(f"Error connecting to Ollama API: {str(e)}")

    except Exception as e:
        print(f"Unexpected error getting image description: {e}")
        raise ValueError(f"Unexpected error getting image description from model {model}: {str(e)}")


def test_embedding_model() -> Dict[str, Any]:
    """
    Test the configured embedding model

    Returns:
        Dictionary with test results including model info, performance metrics
    """
    try:
        model = DEFAULT_EMBEDDING_MODEL
        test_text = "This is a test sentence for embedding dimension detection."

        start_time = time.time()
        embedding = get_text_embedding(test_text)
        response_time = time.time() - start_time

        return {
            "success": True,
            "model_name": model,
            "vector_size": len(embedding),
            "response_time_seconds": round(response_time, 3),
            "sample_values": embedding[:5] if len(embedding) >= 5 else embedding,
            "test_text": test_text
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "vector_size": None,
            "model_name": DEFAULT_EMBEDDING_MODEL
        }


def test_vision_model() -> Dict[str, Any]:
    """
    Test if the configured vision model is available

    Returns:
        Dictionary with test results
    """
    model = DEFAULT_VISION_MODEL

    try:
        url = f"{OLLAMA_URL}{OLLAMA_TAGS_ENDPOINT}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        data = response.json()
        available_models = [model["name"] for model in data.get("models", [])]

        is_available = model in available_models

        return {
            "success": is_available,
            "model_name": model,
            "available": is_available,
            "message": f"Vision model '{model}' is {'available' if is_available else 'not available'}"
        }

    except Exception as e:
        return {
            "success": False,
            "model_name": model,
            "available": False,
            "error": str(e)
        }


def get_embedding_info() -> Dict[str, Any]:
    """
    Get information about current embedding configuration

    Returns:
        Dictionary with current model configuration and capabilities
    """
    return {
        "embedding_model": DEFAULT_EMBEDDING_MODEL,
        "vision_model": DEFAULT_VISION_MODEL,
        "ollama_url": OLLAMA_URL,
        "embedding_endpoint": OLLAMA_EMBEDDINGS_ENDPOINT,
        "vision_endpoint": OLLAMA_GENERATE_ENDPOINT,
        "vector_size": get_vector_size()
    }


def clear_vector_cache():
    get_vector_size.cache_clear()
    print("Vector size cache cleared")
