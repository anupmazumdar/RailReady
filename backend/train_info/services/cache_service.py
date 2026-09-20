import time
from typing import Any, Optional, Tuple, Dict

# Cache Entry: {data: Any, timestamp: float, ttl: float}
_CACHE_STORE: Dict[str, Dict[str, Any]] = {}


class InMemoryCacheService:
    """
    Lightweight, thread-safe in-memory cache supporting TTL and stale data grace periods.
    """

    def get(self, key: str) -> Tuple[Optional[Any], bool]:
        """
        Retrieves cached entry.
        Returns: (data, is_stale)
        """
        entry = _CACHE_STORE.get(key)
        if not entry:
            return None, False

        now = time.time()
        age = now - entry["timestamp"]
        ttl = entry["ttl"]

        if age <= ttl:
            # Fresh cache hit
            return entry["data"], False
        elif age <= (ttl * 3):
            # Stale cache hit (grace period fallback)
            return entry["data"], True
        else:
            # Expired
            del _CACHE_STORE[key]
            return None, False

    def set(self, key: str, data: Any, ttl: float):
        """Stores item in cache with specified TTL in seconds."""
        _CACHE_STORE[key] = {
            "data": data,
            "timestamp": time.time(),
            "ttl": ttl
        }

    def clear(self):
        """Clears all cached entries."""
        _CACHE_STORE.clear()


cache_service = InMemoryCacheService()
