import os
from functools import lru_cache

import requests
import base64
from typing import List, Dict, Any, Optional
from ..models.embedding import EmbeddingResponse, ModelInfo


class OllamaRepository:
    def __init__(self):
        self.base_url = os.getenv("OLLAMA_INTERNAL_URL", "http://ollama:11434")
        self.tags_endpoint = os.getenv("OLLAMA_TAGS_ENDPOINT", "/api/tags")
        self.embeddings_endpoint = os.getenv("OLLAMA_EMBEDDINGS_ENDPOINT", "/api/embeddings")
        self.generate_endpoint = os.getenv("OLLAMA_GENERATE_ENDPOINT", "/api/generate")
        self.default_embedding_model = os.getenv("DEFAULT_EMBEDDING_MODEL", "nomic-embed-text")
        self.default_vision_model = os.getenv("DEFAULT_VISION_MODEL", "llava:7b")

        self._vector_size_cache = {}

    async def check_connection(self) -> bool:
        """Check if Ollama service is reachable"""
        try:
            response = requests.get(f"{self.base_url}{self.tags_endpoint}", timeout=5)
            return response.status_code == 200
        except Exception:
            return False

    # Model Management
    async def get_available_models(self) -> List[ModelInfo]:
        """Get all available models from Ollama"""
        try:
            response = requests.get(f"{self.base_url}{self.tags_endpoint}", timeout=10)
            response.raise_for_status()

            data = response.json()
            models = data.get("models", [])

            return [
                ModelInfo(
                    name=model.get("name", ""),
                    size=model.get("size", 0),
                    digest=model.get("digest", ""),
                    modified_at=model.get("modified_at", "")
                )
                for model in models
            ]
        except Exception as e:
            raise Exception(f"Failed to get available models: {str(e)}")

    async def categorize_models(self) -> Dict[str, List[str]]:
        """Categorize models into embedding, vision, and chat models"""
        try:
            models = await self.get_available_models()
            model_names = [model.name for model in models]

            embedding_models = []
            vision_models = []
            chat_models = []

            for model_name in model_names:
                model_lower = model_name.lower()
                if "embed" in model_lower:
                    embedding_models.append(model_name)
                elif any(vision_name in model_lower for vision_name in ["llava", "bakllava", "moondream"]):
                    vision_models.append(model_name)
                else:
                    chat_models.append(model_name)

            return {
                "embedding": embedding_models,
                "vision": vision_models,
                "chat": chat_models,
                "all": model_names
            }
        except Exception as e:
            raise Exception(f"Failed to categorize models: {str(e)}")

    # Embedding Operations
    async def get_text_embedding(self, text: str, model: Optional[str] = None) -> EmbeddingResponse:
        """Get text embedding using specified or default model"""
        if model is None:
            model = self.default_embedding_model

        url = f"{self.base_url}{self.embeddings_endpoint}"
        payload = {
            "model": model,
            "prompt": text
        }

        try:
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()

            result = response.json()
            embedding = result.get("embedding")

            if not embedding or not isinstance(embedding, list):
                raise ValueError("Invalid embedding response format")

            return EmbeddingResponse(
                embedding=embedding,
                model=model,
                prompt=text
            )
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to get embedding: {str(e)}")
        except Exception as e:
            raise Exception(f"Embedding processing error: {str(e)}")

    async def get_vector_size(self, model: Optional[str] = None) -> int:
        """Get vector size for embedding model"""
        if model is None:
            model = self.default_embedding_model

        if model in self._vector_size_cache:
            return self._vector_size_cache[model]

        sample_response = await self.get_text_embedding("Sample text for dimension detection", model)
        vector_size = len(sample_response.embedding)

        self._vector_size_cache[model] = vector_size

        return vector_size

    async def describe_image(self, image_data: bytes, prompt: Optional[str] = None,
                             model: Optional[str] = None) -> str:
        """Get image description using vision model"""
        if model is None:
            model = self.default_vision_model

        if prompt is None:
            prompt = "Describe this image in detail, including objects, people, text, colors, and setting."

        url = f"{self.base_url}{self.generate_endpoint}"

        image_b64 = base64.b64encode(image_data).decode('utf-8')

        payload = {
            "model": model,
            "prompt": prompt,
            "images": [image_b64],
            "stream": False
        }

        try:
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()

            result = response.json()
            description = result.get("response", "").strip()

            if not description:
                raise ValueError("Empty response from vision model")

            return description
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to describe image: {str(e)}")
        except Exception as e:
            raise Exception(f"Image description error: {str(e)}")

    async def describe_image_from_file(self, image_path: str, prompt: Optional[str] = None,
                                       model: Optional[str] = None) -> str:
        """Get image description from file path"""
        try:
            with open(image_path, "rb") as image_file:
                image_data = image_file.read()
            return await self.describe_image(image_data, prompt, model)
        except FileNotFoundError:
            raise Exception(f"Image file not found: {image_path}")
        except Exception as e:
            raise Exception(f"Failed to process image file: {str(e)}")

    async def test_embedding_model(self, model: Optional[str] = None) -> Dict[str, Any]:
        """Test the embedding model functionality"""
        try:
            if model is None:
                model = self.default_embedding_model

            test_text = "This is a test sentence for embedding dimension detection."
            start_time = __import__('time').time()

            embedding_response = await self.get_text_embedding(test_text, model)
            response_time = __import__('time').time() - start_time

            return {
                "success": True,
                "model_name": model,
                "vector_size": len(embedding_response.embedding),
                "response_time_seconds": round(response_time, 3),
                "sample_values": embedding_response.embedding[:5],
                "test_text": test_text
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "model_name": model or self.default_embedding_model
            }

    async def test_vision_model(self, model: Optional[str] = None) -> Dict[str, Any]:
        """Test if vision model is available"""
        try:
            if model is None:
                model = self.default_vision_model

            available_models = await self.get_available_models()
            model_names = [m.name for m in available_models]
            is_available = model in model_names

            return {
                "success": is_available,
                "model_name": model,
                "available": is_available,
                "message": f"Vision model '{model}' is {'available' if is_available else 'not available'}"
            }
        except Exception as e:
            return {
                "success": False,
                "model_name": model or self.default_vision_model,
                "available": False,
                "error": str(e)
            }
