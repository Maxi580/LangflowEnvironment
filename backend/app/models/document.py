from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class DocumentMetadata(BaseModel):
    """Metadata for a document chunk"""
    file_path: str
    file_id: str
    filename: str
    file_type: str
    flow_id: str
    chunk_idx: int
    file_size: int
    includes_images: bool = False
    uploaded_at: Optional[datetime] = None


class DocumentChunk(BaseModel):
    """A chunk of document content with embedding"""
    content: str
    embedding: List[float]
    metadata: DocumentMetadata


class FileUpload(BaseModel):
    """File upload request"""
    filename: str
    content: bytes
    flow_id: str
    chunk_size: int = 1000
    chunk_overlap: int = 200
    include_images: bool = True


class FileInfo(BaseModel):
    """Information about an uploaded file"""
    file_id: str
    file_path: str
    file_name: str
    file_type: str
    flow_id: str
    file_size: Optional[int] = None
    includes_images: bool = False
    uploaded_at: Optional[datetime] = None
    processing: bool = False


class CollectionInfo(BaseModel):
    """Information about a Qdrant collection"""
    name: str
    vectors_count: int
    points_count: int
    status: str
    vector_size: int
    distance: str


class CollectionCreateRequest(BaseModel):
    """Request to create a new collection"""
    flow_id: str
    vector_size: Optional[int] = None


class CollectionCreateResponse(BaseModel):
    """Response from collection creation"""
    success: bool
    message: str
    collection: CollectionInfo
    created: bool  # True if newly created, False if already existed


class FileUploadResponse(BaseModel):
    """Response from file upload"""
    success: bool
    message: str
    file_info: FileInfo


class FileDeletionResponse(BaseModel):
    """Response from file deletion"""
    success: bool
    message: str
    file_path: str
    flow_id: str
    collection_name: str
    qdrant_deleted: bool
    physical_file_deleted: bool


class CollectionFilesResponse(BaseModel):
    """Response from listing files in collection"""
    success: bool
    flow_id: str
    collection_name: str
    files: List[FileInfo]
    total_files: int


class SearchResult(BaseModel):
    """Result from document search"""
    id: str
    score: float
    content: str
    metadata: Dict[str, Any]


class DocumentSearchRequest(BaseModel):
    """Request for document search"""
    query_text: str
    collection_name: str
    limit: int = 10
    model: Optional[str] = None


class DocumentSearchResponse(BaseModel):
    """Response from document search"""
    success: bool
    query: str
    results: List[SearchResult]
    total_results: int
