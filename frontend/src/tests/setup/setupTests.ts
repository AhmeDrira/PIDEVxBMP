import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { resetBrowserMocks, setupBrowserMocks } from './browserMocks';
import { server } from './mswServer';

vi.mock('socket.io-client', () => {
  const io = vi.fn(() => {
    const listeners = new Map<string, Set<(...args: any[]) => void>>();

    const socket = {
      id: 'socket-mock-id',
      connected: true,
      on: vi.fn((event: string, callback: (...args: any[]) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(callback);

        if (event === 'connect') {
          queueMicrotask(() => callback());
        }

        return socket;
      }),
      off: vi.fn((event: string, callback?: (...args: any[]) => void) => {
        if (!listeners.has(event)) {
          return socket;
        }

        if (!callback) {
          listeners.delete(event);
          return socket;
        }

        listeners.get(event)!.delete(callback);
        return socket;
      }),
      emit: vi.fn((_: string, __?: unknown, ack?: (payload: any) => void) => {
        if (typeof ack === 'function') {
          ack({});
        }
        return true;
      }),
      disconnect: vi.fn(() => {
        const disconnectHandlers = listeners.get('disconnect');
        disconnectHandlers?.forEach((handler) => handler('io client disconnect'));
      }),
    };

    return socket;
  });

  return {
    io,
    Socket: class MockSocket {},
  };
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  setupBrowserMocks();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetBrowserMocks();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});
