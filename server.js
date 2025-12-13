// Simple WebSocket server for multiplayer poker sync
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const server = createServer();
const wss = new WebSocketServer({ server });

// Store game states by room
const gameStates = new Map();
const roomClients = new Map();
// Store chat messages by room (last 50 messages per room)
const roomChats = new Map();

// Helper to get player counts for all rooms
const getRoomPlayerCounts = () => {
    const counts = {};
    gameStates.forEach((state, roomId) => {
        counts[roomId] = state?.players?.length || 0;
    });
    return counts;
};

// Broadcast room counts to all connected clients
const broadcastRoomCounts = () => {
    const counts = getRoomPlayerCounts();
    const message = JSON.stringify({ type: 'ROOM_COUNTS', counts });
    console.log(`📢 Broadcasting room counts to ${wss.clients.size} clients:`, counts);
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(message);
        }
    });
};

wss.on('connection', (ws) => {
    console.log('Client connected');
    let currentRoom = null;

    // Send current room counts to new client
    ws.send(JSON.stringify({ type: 'ROOM_COUNTS', counts: getRoomPlayerCounts() }));

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            // Only log roomId for messages that have it
            if (message.roomId) {
                console.log('Received:', message.type, 'room:', message.roomId);
            } else {
                console.log('Received:', message.type);
            }

            switch (message.type) {
                case 'GET_ROOM_COUNTS':
                    const counts = getRoomPlayerCounts();
                    console.log('📊 Room counts:', counts);
                    ws.send(JSON.stringify({ type: 'ROOM_COUNTS', counts }));
                    break;

                case 'JOIN_ROOM':
                    currentRoom = message.roomId;
                    if (!roomClients.has(currentRoom)) {
                        roomClients.set(currentRoom, new Set());
                    }
                    roomClients.get(currentRoom).add(ws);

                    // Send current state to new client
                    const state = gameStates.get(currentRoom);
                    if (state) {
                        ws.send(JSON.stringify({ type: 'STATE_UPDATE', state }));
                    }
                    console.log(`Client joined room ${currentRoom}. Total clients: ${roomClients.get(currentRoom).size}`);
                    break;

                case 'UPDATE_STATE':
                    console.log('📊 Storing state:', {
                        phase: message.state?.phase,
                        players: message.state?.players?.length,
                        communityCards: message.state?.communityCards?.length,
                        pot: message.state?.pot
                    });
                    gameStates.set(message.roomId, message.state);
                    // Broadcast to all clients in room
                    const clients = roomClients.get(message.roomId);
                    if (clients) {
                        const broadcast = JSON.stringify({ type: 'STATE_UPDATE', state: message.state });
                        console.log(`📤 Broadcasting to ${clients.size} clients`);
                        clients.forEach(client => {
                            if (client.readyState === 1) { // WebSocket.OPEN = 1
                                client.send(broadcast);
                            }
                        });
                    }
                    // Broadcast updated room counts to all clients
                    broadcastRoomCounts();
                    break;

                case 'GET_STATE':
                    const roomState = gameStates.get(message.roomId);
                    ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: roomState || null }));
                    break;

                case 'RESET_ROOM':
                    console.log(`🗑️ Resetting room ${message.roomId}`);
                    gameStates.delete(message.roomId);
                    // Notify all clients in room
                    const roomClientsToReset = roomClients.get(message.roomId);
                    if (roomClientsToReset) {
                        const resetMsg = JSON.stringify({ type: 'ROOM_RESET' });
                        roomClientsToReset.forEach(client => {
                            if (client.readyState === 1) {
                                client.send(resetMsg);
                            }
                        });
                    }
                    // Broadcast updated room counts to all clients
                    broadcastRoomCounts();
                    break;

                case 'CHAT_MESSAGE':
                    // Store and broadcast chat message
                    const chatRoomId = message.roomId;
                    const chatMsg = {
                        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        playerName: message.playerName,
                        message: message.message,
                        timestamp: Date.now(),
                        type: message.msgType || 'chat',
                    };

                    // Store message (keep last 50)
                    if (!roomChats.has(chatRoomId)) {
                        roomChats.set(chatRoomId, []);
                    }
                    const chatHistory = roomChats.get(chatRoomId);
                    chatHistory.push(chatMsg);
                    if (chatHistory.length > 50) {
                        chatHistory.shift();
                    }

                    // Broadcast to all clients in room
                    const chatClients = roomClients.get(chatRoomId);
                    if (chatClients) {
                        const chatBroadcast = JSON.stringify({ type: 'CHAT_MESSAGE', message: chatMsg });
                        chatClients.forEach(client => {
                            if (client.readyState === 1) {
                                client.send(chatBroadcast);
                            }
                        });
                    }
                    console.log(`💬 [${chatRoomId}] ${message.playerName}: ${message.message}`);
                    break;

                case 'GET_CHAT_HISTORY':
                    // Send chat history to requesting client
                    const historyRoomId = message.roomId;
                    const history = roomChats.get(historyRoomId) || [];
                    ws.send(JSON.stringify({ type: 'CHAT_HISTORY', messages: history }));
                    break;
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (currentRoom && roomClients.has(currentRoom)) {
            roomClients.get(currentRoom).delete(ws);
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
