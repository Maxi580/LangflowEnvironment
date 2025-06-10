from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import os

from ...services.health_service import HealthService

HEALTH_BASE_ENDPOINT = os.getenv("HEALTH_BASE_ENDPOINT")
HEALTH_OLLAMA_ENDPOINT = os.getenv("HEALTH_OLLAMA_ENDPOINT")
HEALTH_QDRANT_ENDPOINT = os.getenv("HEALTH_QDRANT_ENDPOINT")
HEALTH_LANGFLOW_ENDPOINT = os.getenv("HEALTH_LANGFLOW_ENDPOINT")
HEALTH_CHECK_ENDPOINT = os.getenv("HEALTH_CHECK_ENDPOINT", "")

router = APIRouter(prefix=HEALTH_BASE_ENDPOINT, tags=["health"])
health_service = HealthService()


@router.get(HEALTH_CHECK_ENDPOINT)
async def health_check() -> Dict[str, Any]:
    """Get overall system health status"""
    return await health_service.get_system_health()


@router.get(HEALTH_OLLAMA_ENDPOINT)
async def check_ollama() -> Dict[str, Any]:
    """Check if Ollama service is running"""
    status = await health_service.check_ollama_health()
    if not status.is_healthy:
        raise HTTPException(status_code=503, detail=status.error_message)
    return status.to_dict()


@router.get(HEALTH_QDRANT_ENDPOINT)
async def check_qdrant() -> Dict[str, Any]:
    """Check if Qdrant service is running"""
    status = await health_service.check_qdrant_health()
    if not status.is_healthy:
        raise HTTPException(status_code=503, detail=status.error_message)
    return status.to_dict()


@router.get(HEALTH_LANGFLOW_ENDPOINT)
async def check_langflow() -> Dict[str, Any]:
    """Check if Langflow service is running"""
    status = await health_service.check_langflow_health()
    if not status.is_healthy:
        raise HTTPException(status_code=503, detail=status.error_message)
    return status.to_dict()
