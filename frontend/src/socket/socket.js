import { io } from 'socket.io-client';

// Connect once at app startup (not lazily per-page) since presence and
// incoming messages need to be tracked globally, not just while a specific
// chat window is open.
const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
  autoConnect: false,
});

export default socket;
