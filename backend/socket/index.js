const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const setupCallSocket = require('./callSocket');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:3000', 'https://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Middleware pour authentifier les connexions
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'votre_secret_jwt');
      socket.user = decoded; // { id: userId, ... }
      next();
    } catch (err) {
      console.error('Socket authentication error:', err.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected via socket: ${socket.user.id} (Socket ID: ${socket.id})`);
    
    // Rejoindre une room personnelle avec son ID pour recevoir des notifications
    socket.join(`user:${socket.user.id}`);

    // Initialiser les événements liés aux appels
    setupCallSocket(io, socket);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id} (Socket ID: ${socket.id})`);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized');
  }
  return io;
};

module.exports = { initSocket, getIo };
