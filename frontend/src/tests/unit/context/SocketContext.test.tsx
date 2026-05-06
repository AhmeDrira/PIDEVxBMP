import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { SocketProvider, useSocket } from '@/context/SocketContext';

function SocketProbe() {
  const { socket, isConnected } = useSocket();

  return (
    <div>
      <span data-testid="connection-state">{isConnected ? 'connected' : 'disconnected'}</span>
      <span data-testid="socket-state">{socket ? 'socket-ready' : 'socket-missing'}</span>
    </div>
  );
}

describe('SocketContext', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should connect through provider and expose socket state when token exists', async () => {
    // Arrange
    const ioMock = vi.mocked(io);
    const socketMock = {
      id: 'socket-1',
      connected: true,
      emit: vi.fn(),
      off: vi.fn(),
      on: vi.fn((event: string, callback: (...args: any[]) => void) => {
        if (event === 'connect') {
          queueMicrotask(() => callback());
        }
        return socketMock;
      }),
      disconnect: vi.fn(),
    };

    ioMock.mockReturnValue(socketMock as any);
    localStorage.setItem('token', 'socket-token-123');
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      writable: true,
      value: (callback: IdleRequestCallback) => {
        callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
        return 1;
      },
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    // Act
    const view = render(
      <SocketProvider>
        <SocketProbe />
      </SocketProvider>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('connection-state')).toHaveTextContent('connected');
    });
    expect(screen.getByTestId('socket-state')).toHaveTextContent('socket-ready');
    expect(ioMock).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3000'),
      expect.objectContaining({ auth: { token: 'socket-token-123' } })
    );

    view.unmount();
    expect(socketMock.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should stay disconnected when no token is available', () => {
    // Arrange
    const ioMock = vi.mocked(io);
    ioMock.mockReset();
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Act
    render(
      <SocketProvider>
        <SocketProbe />
      </SocketProvider>
    );

    // Assert
    expect(screen.getByTestId('connection-state')).toHaveTextContent('disconnected');
    expect(screen.getByTestId('socket-state')).toHaveTextContent('socket-missing');
    expect(ioMock).not.toHaveBeenCalled();
  });
});
