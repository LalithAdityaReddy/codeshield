from fastapi import WebSocket
from typing import Dict, List
import json


class WebSocketManager:
    def __init__(self):
        # active_connections: session_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        print(f"WebSocket connected: {session_id}")

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            print(f"WebSocket disconnected: {session_id}")

    async def send_message(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            await websocket.send_text(json.dumps(message))

    async def broadcast(self, message: dict):
        for session_id, websocket in self.active_connections.items():
            await websocket.send_text(json.dumps(message))

    def get_active_sessions(self) -> List[str]:
        return list(self.active_connections.keys())


# Global instance
manager = WebSocketManager()