import json, time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks

app = FastAPI()
chat_rooms = {}


class ChatRoom:
    def __init__(self, room_id: str):
        self.websockets = {} # {clientKey: websocket}
        self.room_id = room_id

    async def add_connection(self, websocket: WebSocket):
        await websocket.accept()
        clientKey = self.makeKey(websocket)
        try:
            while True:
                if clientKey in self.websockets:  # if clientKey is already in websockets, then it is a message
                    message_txt = await websocket.receive_text()
                    print(message_txt)
                    message_dict = json.loads(message_txt)
                    send_sock = self.websockets[message_dict['to']]
                    del message_dict['to']
                    await send_sock.send_json({
                        'from': clientKey, 
                        'payload': message_dict['payload'],
                        'transaction': message_dict['transaction']  # offer, answer, ice
                    })
                else:  # if clientKey is not in websockets, then it is a new connection
                    self.websockets[clientKey] = websocket
                    await self.broadcastConnections(websocket)
        except WebSocketDisconnect:
            del self.websockets[clientKey]
            if bool(self.websockets):
                await self.broadcastConnections(websocket)
            else:
                del chat_rooms[self.room_id]  # cleanup to prevent dict from unnecessarily growing
                del self

    @staticmethod
    def makeKey(websocket) -> str:
        return websocket.client.host+':'+str(websocket.client.port)

    async def broadcastConnections(self, websocket: WebSocket):
        for key in self.websockets.keys():
            other_connections = [otherkey for otherkey in self.websockets.keys() if otherkey != key]
            socket = self.websockets[key]
            await socket.send_json({'connections': other_connections})


@app.websocket("/chat/{room_id}")
async def chat(websocket: WebSocket, room_id: str):
    if room_id not in chat_rooms:
        chat_rooms[room_id] = ChatRoom(room_id)
    await chat_rooms[room_id].add_connection(websocket)
