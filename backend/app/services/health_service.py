from datetime import datetime
from typing import Dict, Any
from ..external.ollama_repository import OllamaRepository
from ..external.qdrant_repository import QdrantRepository
from ..external.langflow_repository import LangflowRepository
from ..models.health import ServiceHealthStatus, SystemHealthStatus


class HealthService:
    def __init__(self):
        self.ollama_repo = OllamaRepository()
        self.qdrant_repo = QdrantRepository()
        self.langflow_repo = LangflowRepository()

    async def get_system_health(self) -> Dict[str, Any]:
        """Get overall system health with all service statuses"""
        ollama_status = await self.check_ollama_health()
        qdrant_status = await self.check_qdrant_health()
        langflow_status = await self.check_langflow_health()

        all_healthy = all([
            ollama_status.is_healthy,
            qdrant_status.is_healthy,
            langflow_status.is_healthy
        ])

        system_status = SystemHealthStatus(
            is_healthy=all_healthy,
            timestamp=datetime.utcnow(),
            services={
                "ollama": ollama_status,
                "qdrant": qdrant_status,
                "langflow": langflow_status,
                "api": ServiceHealthStatus(is_healthy=True, service_name="api")
            },
            version="1.0.0"
        )

        return system_status.to_dict()

    async def check_ollama_health(self) -> ServiceHealthStatus:
        """Check Ollama service health"""
        try:
            is_healthy = await self.ollama_repo.check_connection()
            return ServiceHealthStatus(
                is_healthy=is_healthy,
                service_name="ollama",
                error_message=None if is_healthy else "Ollama service is not available"
            )
        except Exception as e:
            return ServiceHealthStatus(
                is_healthy=False,
                service_name="ollama",
                error_message=f"Ollama health check failed: {str(e)}"
            )

    async def check_qdrant_health(self) -> ServiceHealthStatus:
        """Check Qdrant service health"""
        try:
            is_healthy = await self.qdrant_repo.check_connection()
            return ServiceHealthStatus(
                is_healthy=is_healthy,
                service_name="qdrant",
                error_message=None if is_healthy else "Qdrant service is not available"
            )
        except Exception as e:
            return ServiceHealthStatus(
                is_healthy=False,
                service_name="qdrant",
                error_message=f"Qdrant health check failed: {str(e)}"
            )

    async def check_langflow_health(self) -> ServiceHealthStatus:
        """Check Langflow service health"""
        try:
            is_healthy = await self.langflow_repo.check_connection()
            return ServiceHealthStatus(
                is_healthy=is_healthy,
                service_name="langflow",
                error_message=None if is_healthy else "Langflow service is not available"
            )
        except Exception as e:
            return ServiceHealthStatus(
                is_healthy=False,
                service_name="langflow",
                error_message=f"Langflow health check failed: {str(e)}"
            )