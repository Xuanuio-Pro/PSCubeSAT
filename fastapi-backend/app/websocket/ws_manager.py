import asyncio
import json
from typing import Dict, Set

from fastapi import WebSocket
from loguru import logger

SEND_TIMEOUT_SECONDS = 2.0


class ConnectionManager:
    def __init__(self) -> None:
        # Lưu tập hợp socket theo từng thiết bị: {"cube_01": {ws1, ws2}, "cube_02": {ws3}}
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, device_uid: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if device_uid not in self._connections:
            self._connections[device_uid] = set()
        self._connections[device_uid].add(websocket)
        logger.info(
            f"[WS] Client vào room [{device_uid}]. "
            f"Tổng client: {self.count} | Số room: {len(self._connections)}"
        )

    def disconnect(self, device_uid: str, websocket: WebSocket) -> None:
        if device_uid in self._connections:
            self._connections[device_uid].discard(websocket)
            if not self._connections[device_uid]:
                del self._connections[device_uid]
        logger.info(
            f"[WS] Client rời room [{device_uid}]. "
            f"Tổng client: {self.count} | Số room: {len(self._connections)}"
        )

    async def send_to_device(self, device_uid: str, data: dict) -> None:
        """Gửi dữ liệu Realtime CHỈ cho các client đang xem thiết bị này."""
        connections = self._connections.get(device_uid)
        if not connections:
            return

        message = json.dumps(data, ensure_ascii=False)

        async def _send(ws: WebSocket) -> WebSocket | None:
            try:
                logger.debug(f"[WS] Gửi tới client ({device_uid}): {message[:80]}")
                await asyncio.wait_for(ws.send_text(message), timeout=SEND_TIMEOUT_SECONDS)
                return None
            except Exception as e:
                logger.warning(f"[WS] Lỗi gửi tin tới client ({device_uid}): {e}")
                return ws  # Trả về websocket lỗi để xóa

        # Gửi đồng thời tới tất cả client trong room (không bị nghẽn do client mạng chậm)
        results = await asyncio.gather(*[_send(ws) for ws in connections], return_exceptions=True)

        # Lọc các socket bị đứt kết nối (dead)
        dead_sockets = {res for res in results if isinstance(res, WebSocket)}
        for ws in dead_sockets:
            connections.discard(ws)

        # Dọn dẹp room nếu không còn ai kết nối
        if not connections:
            self._connections.pop(device_uid, None)

    async def close_device(self, device_uid: str) -> None:
        sockets = self._connections.pop(device_uid, set())

        async def close(ws):
            try:
                await asyncio.wait_for(ws.close(code=1008), timeout=2)
            except Exception:
                pass

        await asyncio.gather(*(close(ws) for ws in sockets))

    @property
    def count(self) -> int:
        """Tổng số WebSocket client thực tế đang kết nối trên toàn hệ thống."""
        return sum(len(sockets) for sockets in self._connections.values())


ws_manager = ConnectionManager()
