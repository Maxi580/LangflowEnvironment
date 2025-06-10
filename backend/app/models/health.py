from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass
from pydantic import BaseModel


@dataclass
class ServiceHealthStatus:
    is_healthy: bool
    service_name: str
    error_message: Optional[str] = None
    response_time_ms: Optional[float] = None
    additional_info: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "status": "connected" if self.is_healthy else "disconnected",
            "service": self.service_name
        }

        if self.error_message:
            result["error"] = self.error_message

        if self.response_time_ms is not None:
            result["response_time_ms"] = self.response_time_ms

        if self.additional_info:
            result.update(self.additional_info)

        return result


@dataclass
class SystemHealthStatus:
    is_healthy: bool
    timestamp: datetime
    services: Dict[str, ServiceHealthStatus]
    version: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": "healthy" if self.is_healthy else "degraded",
            "timestamp": self.timestamp.isoformat(),
            "requests": {
                name: service.to_dict() if hasattr(service, 'to_dict')
                else {"status": "connected" if service.is_healthy else "disconnected", "service": name}
                for name, service in self.services.items()
            },
            "version": self.version
        }


class ServiceHealth(BaseModel):
    status: str
    service: str
    error: Optional[str] = None
    response_time_ms: Optional[float] = None


class SystemHealth(BaseModel):
    status: str
    timestamp: str
    services: Dict[str, ServiceHealth]
    version: str