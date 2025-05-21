from datetime import datetime
from fastapi import APIRouter, HTTPException
from ..utils.connection import check_langflow_connection, check_qdrant_connection, check_ollama_connection
from typing import Dict, Any
import os

OLLAMA_URL = os.getenv("INTERNAL_OLLAMA_URL", "http://ollama:11434")
QDRANT_URL = os.getenv("INTERNAL_QDRANT_URL", "http://qdrant:6333")

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_check() -> Dict[str, Any]:
    ollama_status = check_ollama_connection()
    qdrant_status = check_qdrant_connection()
    langflow_status = check_langflow_connection()

    all_healthy = ollama_status and qdrant_status and langflow_status

    return {
        "status": "healthy" if all_healthy else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "ollama": "connected" if ollama_status else "disconnected",
            "qdrant": "connected" if qdrant_status else "disconnected",
            "langflow": "connected" if langflow_status else "disconnected",
            "api": "running"
        },
        "version": "1.0.0"
    }


@router.get("/ollama")
async def check_ollama() -> Dict[str, Any]:
    """Check if Ollama service is running"""
    is_connected = check_ollama_connection()
    if not is_connected:
        raise HTTPException(status_code=503, detail="Ollama service is not available")
    return {"status": "connected", "service": "ollama"}


@router.get("/qdrant")
async def check_qdrant() -> Dict[str, Any]:
    """Check if Qdrant service is running"""
    is_connected = check_qdrant_connection()
    if not is_connected:
        raise HTTPException(status_code=503, detail="Qdrant service is not available")
    return {"status": "connected", "service": "qdrant"}


@router.get("/langflow")
async def check_langflow() -> Dict[str, Any]:
    """Check if Langflow service is running"""
    is_connected = check_langflow_connection()
    if not is_connected:
        raise HTTPException(status_code=503, detail="Langflow service is not available")
    return {"status": "connected", "service": "langflow"}
