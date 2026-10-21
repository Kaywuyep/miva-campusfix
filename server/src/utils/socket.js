const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

let io = null;

// Real-time layer: each logged-in browser joins a private room "user:<id>"
function initSocket(httpServer, corsOrigin) {
  io = new Server(httpServer, { cors: { origin: corsOrigin } });

  io.use((socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
  });

  return io;
}

const getIO = () => io;

module.exports = { initSocket, getIO };
