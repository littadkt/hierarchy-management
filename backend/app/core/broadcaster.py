import asyncio
import json
import logging
import uuid
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional, Set, Union

logger = logging.getLogger("app.realtime")


class SafeJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder handling UUIDs, datetimes, and Enums."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        return super().default(obj)


def serialize_event_data(data: Any) -> str:
    return json.dumps(data, cls=SafeJSONEncoder)


class EventBroadcaster:
    """
    Central in-memory pub-sub event broadcaster for real-time SSE & WebSocket updates.
    Notifies connected clients immediately when task statuses, purchase orders,
    wholesale orders, or approvals change.
    """

    def __init__(self):
        self._queues: Set[asyncio.Queue] = set()
        self._lock: Optional[asyncio.Lock] = None

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=200)
        async with self._get_lock():
            self._queues.add(q)
            logger.info(
                f"[Realtime] Client subscribed. Active listeners: {len(self._queues)}"
            )
        return q

    async def unsubscribe(self, q: asyncio.Queue) -> None:
        async with self._get_lock():
            self._queues.discard(q)
            logger.info(
                f"[Realtime] Client unsubscribed. Active listeners: {len(self._queues)}"
            )

    async def broadcast(
        self, event_type_or_payload: Union[str, Dict[str, Any]], data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Asynchronously broadcast an event to all connected listeners."""
        if isinstance(event_type_or_payload, dict):
            payload = dict(event_type_or_payload)
            if "timestamp" not in payload:
                payload["timestamp"] = datetime.now(timezone.utc).isoformat()
        else:
            payload = {
                "type": str(event_type_or_payload),
                "data": data or {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        async with self._get_lock():
            if not self._queues:
                return
            dead_queues = set()
            for q in list(self._queues):
                try:
                    q.put_nowait(payload)
                except asyncio.QueueFull:
                    try:
                        q.get_nowait()
                        q.put_nowait(payload)
                    except Exception:
                        dead_queues.add(q)
                except Exception:
                    dead_queues.add(q)

            for q in dead_queues:
                self._queues.discard(q)

    def broadcast_sync(
        self, event_type_or_payload: Union[str, Dict[str, Any]], data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Safely schedule a broadcast from synchronous context if event loop is running."""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.broadcast(event_type_or_payload, data))
        except RuntimeError:
            pass


broadcaster = EventBroadcaster()

