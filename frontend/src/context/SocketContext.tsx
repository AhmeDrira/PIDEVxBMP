import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { Socket } from 'socket.io-client';

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

const getStoredToken = (): string | null => {
  let t = localStorage.getItem('token');
  if (t) return t;
  const userStorage = localStorage.getItem('user');
  if (userStorage) {
    try {
      const parsed = JSON.parse(userStorage);
      return parsed?.token || null;
    } catch {}
  }
  return null;
};

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const ioRef = useRef<typeof import('socket.io-client').io | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Lazy-load socket.io-client only when there's an authenticated user.
    // This keeps the websocket bundle out of the initial chunk for the login page,
    // and avoids opening a websocket on the login page (which blocks bfcache).
    const ensureSocket = async () => {
      const token = getStoredToken();
      if (!token) return;
      if (socketRef.current) return;

      if (!ioRef.current) {
        const mod = await import('socket.io-client');
        if (cancelled) return;
        ioRef.current = mod.io;
      }

      const instance = ioRef.current(SOCKET_URL, {
        auth: { token },
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
      });

      instance.on('connect', () => {
        if (cancelled) return;
        setIsConnected(true);
      });
      instance.on('disconnect', () => {
        if (cancelled) return;
        setIsConnected(false);
      });

      socketRef.current = instance;
      if (!cancelled) setSocket(instance);
    };

    // Defer the first attempt until the browser is idle so it doesn't compete
    // with FCP/LCP on the very first paint.
    const idle = (cb: () => void) => {
      const ric = (window as any).requestIdleCallback;
      if (typeof ric === 'function') return ric(cb, { timeout: 2000 });
      return setTimeout(cb, 800);
    };

    const handle = idle(() => { void ensureSocket(); });

    // Reconnect attempts when token appears later (after login)
    const interval = setInterval(() => {
      if (!socketRef.current && getStoredToken()) {
        void ensureSocket();
      }
    }, 3000);

    return () => {
      cancelled = true;
      const cic = (window as any).cancelIdleCallback;
      if (typeof cic === 'function') cic(handle); else clearTimeout(handle as any);
      clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
