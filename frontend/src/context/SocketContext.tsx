import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextProps {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextProps>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connectSocket = () => {
      let currentToken = localStorage.getItem('token');
      const userStorage = localStorage.getItem('user');
      if (!currentToken && userStorage) {
        try { currentToken = JSON.parse(userStorage).token; } catch (e) {}
      }
      if (!currentToken) return null;

      const socketInstance = io(SOCKET_URL, {
        auth: { token: currentToken },
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
      });

      socketInstance.on('connect', () => {
        console.log('[SocketContext] Connected to socket server', socketInstance.id);
        setIsConnected(true);
      });
      socketInstance.on('disconnect', () => {
        console.log('[SocketContext] Disconnected');
        setIsConnected(false);
      });

      setSocket(socketInstance);
      return socketInstance;
    };

    let sock = connectSocket();

    const interval = setInterval(() => {
      if (!sock && localStorage.getItem('token')) {
        sock = connectSocket();
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      if (sock) sock.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
