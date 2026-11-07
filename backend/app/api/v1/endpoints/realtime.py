import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.core.broadcaster import broadcaster, serialize_event_data

logger = logging.getLogger("app.realtime")
router = APIRouter()


@router.get("/events")
async def sse_events_stream(
    request: Request, token: Optional[str] = Query(None)
):
    """
    Server-Sent Events (SSE) stream for real-time dashboard and status synchronization.
    Supports native automatic reconnects, keepalive pings, and works over all standard HTTP/HTTPS connections.
    """

    async def event_generator():
        queue = await broadcaster.subscribe()
        try:
            # Send initial connected handshake
            init_payload = {"type": "CONNECTED", "data": {"status": "ok"}}
            yield f"event: message\ndata: {serialize_event_data(init_payload)}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for up to 15s for next broadcast event; send comment ping if idle
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    json_str = serialize_event_data(event)
                    yield f"event: message\ndata: {json_str}\n\n"
                except asyncio.TimeoutError:
                    # SSE keepalive comment line to prevent proxies and mobile browsers from timing out
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.websocket("/ws")
async def websocket_stream(websocket: WebSocket, token: Optional[str] = Query(None)):
    """
    WebSocket endpoint for real-time bidirectional communication.
    """
    await websocket.accept()
    queue = await broadcaster.subscribe()
    try:
        await websocket.send_text(
            serialize_event_data({"type": "CONNECTED", "data": {"status": "ok"}})
        )
        while True:
            send_task = asyncio.create_task(queue.get())
            recv_task = asyncio.create_task(websocket.receive_text())
            done, pending = await asyncio.wait(
                [send_task, recv_task], return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()

            for task in done:
                res = task.result()
                if task == send_task:
                    await websocket.send_text(serialize_event_data(res))
                elif task == recv_task:
                    if res == "ping":
                        await websocket.send_text(
                            serialize_event_data({"type": "PONG", "data": {}})
                        )
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    except Exception as e:
        logger.debug(f"[Realtime] WebSocket error: {e}")
    finally:
        await broadcaster.unsubscribe(queue)

