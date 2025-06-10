from datetime import datetime, UTC
import threading
import asyncio
from typing import Dict, Any, List, Optional


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

    def get_file(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific file"""
        with self._lock:
            return self._processing_files.get(file_id)

    def get_files_for_flow(self, flow_id: str) -> List[Dict[str, Any]]:
        """Get all files currently being processed for a specific flow"""
        with self._lock:
            return [
                file_info for file_info in self._processing_files.values()
                if file_info.get("flow_id") == flow_id
            ]

    def get_all_files(self) -> List[Dict[str, Any]]:
        """Get all files currently being processed"""
        with self._lock:
            return list(self._processing_files.values())

    def is_processing(self, file_id: str) -> bool:
        """Check if a file is currently being processed"""
        with self._lock:
            return file_id in self._processing_files

    def cleanup_stale_files(self, max_age_hours: int = 24) -> int:
        """Clean up files that have been processing for too long"""
        from datetime import timedelta

        cutoff_time = datetime.now(UTC) - timedelta(hours=max_age_hours)
        removed_count = 0

        with self._lock:
            stale_files = []
            for file_id, file_info in self._processing_files.items():
                started_at_str = file_info.get("started_at")
                if started_at_str:
                    try:
                        started_at = datetime.fromisoformat(started_at_str.replace('Z', '+00:00'))
                        if started_at < cutoff_time:
                            stale_files.append(file_id)
                    except ValueError:
                        # Invalid timestamp, consider it stale
                        stale_files.append(file_id)

            for file_id in stale_files:
                del self._processing_files[file_id]
                removed_count += 1
                print(f"Cleaned up stale processing file: {file_id}")

        return removed_count


processing_tracker = ProcessingFileTracker()
