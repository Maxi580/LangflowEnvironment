from datetime import datetime, UTC
import threading
from typing import Dict, Any, List, Optional


class ProcessingFileTracker:
    def __init__(self):
        self._processing_files: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def add_file(self, file_id: str, file_info: Dict[str, Any]) -> None:
        with self._lock:
            self._processing_files[file_id] = {
                **file_info,
                "status": "processing",
                "started_at": datetime.now(UTC).isoformat(),
            }
        print(f"Added file to processing tracker: {file_id}")

    def remove_file(self, file_id: str) -> None:
        with self._lock:
            if file_id in self._processing_files:
                del self._processing_files[file_id]
                print(f"Removed file from processing tracker: {file_id}")

    def update_file(self, file_id: str, updates: Dict[str, Any]) -> None:
        with self._lock:
            if file_id in self._processing_files:
                self._processing_files[file_id].update(updates)
                self._processing_files[file_id]["last_updated"] = datetime.now(UTC).isoformat()

    def get_file(self, file_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._processing_files.get(file_id)

    def get_files_for_flow(self, flow_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return [
                file_info for file_info in self._processing_files.values()
                if file_info.get("flow_id") == flow_id
            ]

    def get_all_files(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._processing_files.values())

    def is_processing(self, file_id: str) -> bool:
        with self._lock:
            return file_id in self._processing_files


processing_tracker = ProcessingFileTracker()
