from datetime import datetime, UTC
import threading
from typing import Dict, Any, List


class ProcessingFileTracker:
    """Thread-safe tracker for files being processed in background tasks"""
    def __init__(self):
        self._processing_files: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def add_file(self, file_id: str, file_info: Dict[str, Any]) -> None:
        """Add a file to the processing tracker"""
        with self._lock:
            self._processing_files[file_id] = {
                **file_info,
                "status": "processing",
                "started_at": datetime.now(UTC).isoformat(),
            }
        print(f"Added file to processing tracker: {file_id}")

    def remove_file(self, file_id: str) -> None:
        """Remove a file from the processing tracker (when processing completes)"""
        with self._lock:
            if file_id in self._processing_files:
                del self._processing_files[file_id]
                print(f"Removed file from processing tracker: {file_id}")

    def update_file(self, file_id: str, updates: Dict[str, Any]) -> None:
        """Update file information in the tracker"""
        with self._lock:
            if file_id in self._processing_files:
                self._processing_files[file_id].update(updates)
                self._processing_files[file_id]["last_updated"] = datetime.now(UTC).isoformat()

    def get_files_for_flow(self, flow_id: str) -> List[Dict[str, Any]]:
        """Get all files currently being processed for a specific flow"""
        with self._lock:
            return [
                file_info for file_info in self._processing_files.values()
                if file_info.get("flow_id") == flow_id
            ]

    def is_processing(self, file_id: str) -> bool:
        """Check if a file is currently being processed"""
        with self._lock:
            return file_id in self._processing_files


processing_tracker = ProcessingFileTracker()
