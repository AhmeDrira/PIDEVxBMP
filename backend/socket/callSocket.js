const Conversation = require('../models/Conversation');

const setupCallSocket = (io, socket) => {
  const userId = socket.user.id;

  // Stocker l'etat des appels
  const activeCalls = new Map(); // conversationId -> { timer, status }

  socket.on('call:start', async (data, callback) => {
    console.log(`[Backend Socket] call:start received from user ${userId}`, data);
    try {
      const { conversationId, type } = data;
      
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        console.log(`[Backend Socket] Conversation ${conversationId} not found`);
        return callback({ error: 'Conversation not found' });
      }

      if (!conversation.participants.some(p => String(p) === String(userId))) {
        console.log(`[Backend Socket] User ${userId} unauthorized for conv ${conversationId}`);
        return callback({ error: 'Unauthorized' });
      }

      const otherParticipantId = conversation.participants.find(p => String(p) !== String(userId));
      const room = `call:${conversationId}`;
      
      socket.join(room);

      // Timeout si pas de reponse
      const timeoutTimer = setTimeout(() => {
        io.to(room).emit('call:timeout');
        activeCalls.delete(conversationId);
        // Clean room
        io.in(room).socketsLeave(room);
      }, 30000);

      activeCalls.set(conversationId, { timer: timeoutTimer, status: 'calling' });

      // Emettre incoming au destinataire
      io.to(`user:${otherParticipantId}`).emit('call:incoming', {
        conversationId,
        callerId: userId,
        type
      });

      if (callback) callback({ success: true, room });
    } catch (error) {
      console.error('Call start error:', error);
      if (callback) callback({ error: 'Internal server error' });
    }
  });

  socket.on('call:accepted', (data) => {
    const { conversationId } = data;
    const room = `call:${conversationId}`;
    
    // Annuler le timeout
    const callState = activeCalls.get(conversationId);
    if (callState && callState.timer) {
      clearTimeout(callState.timer);
    }
    
    socket.join(room);
    socket.to(room).emit('call:accepted', { accepterId: userId });
  });

  socket.on('call:rejected', (data) => {
    const { conversationId } = data;
    const room = `call:${conversationId}`;
    
    // Annuler le timeout
    const callState = activeCalls.get(conversationId);
    if (callState && callState.timer) {
      clearTimeout(callState.timer);
      activeCalls.delete(conversationId);
    }

    socket.to(room).emit('call:rejected');
    // Clean up all sockets from the room
    io.in(room).socketsLeave(room);
  });

  socket.on('call:join', (data) => {
    const { conversationId } = data;
    socket.join(`call:${conversationId}`);
  });

  socket.on('call:offer', (data) => {
    const { conversationId, offer } = data;
    socket.to(`call:${conversationId}`).emit('call:offer', { offer });
  });

  socket.on('call:answer', (data) => {
    const { conversationId, answer } = data;
    socket.to(`call:${conversationId}`).emit('call:answer', { answer });
  });

  socket.on('call:ice-candidate', (data) => {
    const { conversationId, candidate } = data;
    socket.to(`call:${conversationId}`).emit('call:ice-candidate', { candidate });
  });

  socket.on('call:end', (data) => {
    const { conversationId } = data;
    const room = `call:${conversationId}`;
    
    const callState = activeCalls.get(conversationId);
    if (callState && callState.timer) {
      clearTimeout(callState.timer);
      activeCalls.delete(conversationId);
    }

    socket.to(room).emit('call:end');
    io.in(room).socketsLeave(room);
  });
  
  socket.on('disconnecting', () => {
    // Lorsqu'on se deconnecte, on avertit les rooms call:*
    for (const room of socket.rooms) {
      if (room.startsWith('call:')) {
        socket.to(room).emit('call:end');
      }
    }
  });
};

module.exports = setupCallSocket;
