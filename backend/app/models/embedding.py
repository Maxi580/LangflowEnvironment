from pydantic import BaseModel
from typing import List, Optional


class EmbeddingRequest(BaseModel):
    """Request model for text embedding"""
    text: str
    model: Optional[str] = None


class EmbeddingResponse(BaseModel):
    """Response model for text embedding"""
    embedding: List[float]
    model: str
    prompt: str
    vector_size: Optional[int] = None


class ModelInfo(BaseModel):
    """Information about an available model"""
    name: str
    size: int
    digest: str
    modified_at: str
    model_type: Optional[str] = None  # embedding, vision, chat


class ModelCategories(BaseModel):
    """Categorized models by type"""
    embedding: List[str]
    vision: List[str]
    chat: List[str]
    all: List[str]


class ImageDescriptionRequest(BaseModel):
    """Request model for image description"""
    image_data: bytes
    prompt: Optional[str] = None
    model: Optional[str] = None


class ImageDescriptionResponse(BaseModel):
    """Response model for image description"""
    description: str
    model: str
    prompt: str


class ModelTestResult(BaseModel):
    """Result of model testing"""
    success: bool
    model_name: str
    error: Optional[str] = None
    # For embedding models
    vector_size: Optional[int] = None
    response_time_seconds: Optional[float] = None
    sample_values: Optional[List[float]] = None
    test_text: Optional[str] = None
    # For vision models
    available: Optional[bool] = None
    message: Optional[str] = None
