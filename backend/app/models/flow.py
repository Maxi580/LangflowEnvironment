from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

from .message import GeneratedFileData


class FlowUpload(BaseModel):
    """Request model for uploading a flow"""
    filename: str
    content: bytes
    folder_id: Optional[str] = None


class FlowComponent(BaseModel):
    """Individual component within a flow"""
    id: str
    type: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class Flow(BaseModel):
    """Flow data model"""
    id: str
    name: str
    description: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    is_component: bool = False
    updated_at: Optional[datetime] = None
    folder_id: Optional[str] = None
    user_id: Optional[str] = None


class FlowComponentInfo(BaseModel):
    """Information about components in a flow"""
    flow_id: str
    flow_name: Optional[str] = None
    total_components: int
    component_ids: List[str]
    qdrant_component_ids: List[str] = []


class FlowExecution(BaseModel):
    """Flow execution request"""
    flow_id: str
    input_value: str
    session_id: Optional[str] = None
    tweaks: Optional[Dict[str, Any]] = None
    output_type: str = "chat"
    input_type: str = "chat"


class FlowExecutionResult(BaseModel):
    """Result of flow execution"""
    success: bool
    flow_id: str
    session_id: str
    response: str
    generated_files: List[Optional[GeneratedFileData]] = []
    execution_time: Optional[float] = None
    error: Optional[str] = None


class FlowDeletionResult(BaseModel):
    success: bool
    flow_id: str
    message: str
    collections_cleaned: bool = False
    collection_cleanup_details: Optional[Dict[str, Any]] = None
    collection_cleanup_error: Optional[str] = None
