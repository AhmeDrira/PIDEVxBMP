import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCall } from '@/hooks/useCall';

type Handler = (...args: any[]) => void;

function createSocketMock() {
  const handlers = new Map<string, Set<Handler>>();

  const socket = {
    connected: true,
    on: vi.fn((event: string, callback: Handler) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(callback);
      return socket;
    }),
    off: vi.fn((event: string, callback: Handler) => {
      handlers.get(event)?.delete(callback);
      return socket;
    }),
    emit: vi.fn((event: string, payload?: unknown, ack?: (result: any) => void) => {
      if (event === 'call:start' && typeof ack === 'function') {
        ack({ ok: true });
      }
      return true;
    }),
    trigger(event: string, payload?: unknown) {
      handlers.get(event)?.forEach((callback) => callback(payload));
    },
  };

  return socket;
}

describe('useCall', () => {
  it('should switch to calling state when initiating a call succeeds', async () => {
    // Arrange
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'user-1'));

    // Act
    act(() => {
      result.current.initiateCall('conv-1', 'audio', {
        id: 'user-2',
        name: 'Remote User',
        avatar: 'RU',
      });
    });

    // Assert
    await waitFor(() => {
      expect(result.current.callState.status).toBe('calling');
    });
    expect(result.current.callState.type).toBe('audio');
    expect(result.current.callState.remoteUser?.name).toBe('Remote User');
    expect(socket.emit).toHaveBeenCalledWith(
      'call:start',
      { conversationId: 'conv-1', type: 'audio' },
      expect.any(Function)
    );
  });

  it('should move to in-call state when incoming call is accepted', async () => {
    // Arrange
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'user-1'));

    // Act
    act(() => {
      socket.trigger('call:incoming', {
        callerId: 'user-2',
        type: 'video',
        conversationId: 'conv-2',
      });
    });

    await waitFor(() => {
      expect(result.current.callState.status).toBe('ringing');
    });

    act(() => {
      result.current.acceptCall();
    });

    // Assert
    await waitFor(() => {
      expect(result.current.callState.status).toBe('in-call');
    });
    expect(socket.emit).toHaveBeenCalledWith('call:accepted', { conversationId: 'conv-2' });
  });
});
