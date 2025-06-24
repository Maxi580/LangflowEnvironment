import hashlib
import threading
from typing import Dict, Optional
from collections import OrderedDict


class ImageDescriptionCache:
    def __init__(self, max_size: int = 1000):
        self._cache: OrderedDict[str, str] = OrderedDict()
        self._lock = threading.Lock()
        self.max_size = max_size
        self._hits = 0
        self._misses = 0

    def _compute_image_hash(self, image_data: bytes) -> str:
        """Compute SHA-256 hash of image data"""
        return hashlib.sha256(image_data).hexdigest()

    def get_description(self, image_data: bytes) -> Optional[str]:
        """Get cached description for image data and move to end (most recent)"""
        image_hash = self._compute_image_hash(image_data)
        with self._lock:
            if image_hash in self._cache:
                # Move to end (most recently used)
                description = self._cache.pop(image_hash)
                self._cache[image_hash] = description
                self._hits += 1
                return description
            else:
                self._misses += 1
                return None

    def store_description(self, image_data: bytes, description: str) -> None:
        """Store description for image data"""
        image_hash = self._compute_image_hash(image_data)
        with self._lock:
            if image_hash in self._cache:
                self._cache.pop(image_hash)
                self._cache[image_hash] = description
            else:
                # Add new item
                if len(self._cache) >= self.max_size:
                    oldest_key, _ = self._cache.popitem(last=False)
                    print(f"Evicted LRU image from cache: {oldest_key[:12]}...")

                self._cache[image_hash] = description

    def clear(self) -> None:
        """Clear all cached descriptions"""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0

    def get_cache_stats(self) -> Dict[str, any]:
        """Get cache statistics"""
        with self._lock:
            hit_rate = self._hits / (self._hits + self._misses) if (self._hits + self._misses) > 0 else 0
            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(hit_rate * 100, 2)
            }
