/**
 * Extra coverage for useCall — exercises the branches the basic test misses.
 * We avoid `vi.useFakeTimers()` globally and only switch to fake timers inside
 * tests that assert on the auto-reset / duration ticks (otherwise waitFor and
 * promise resolution would freeze).
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCall } from '@/hooks/useCall';

type Handler = (...args: any[]) => void;

function createSocketMock() {
  const handlers = new Map<string, Set<Handler>>();
  const ackResponses: Record<string, any> = {};

  const socket = {
    connected: true,
    on: vi.fn((event: string, callback: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(callback);
      return socket;
    }),
    off: vi.fn((event: string, callback: Handler) => {
      handlers.get(event)?.delete(callback);
      return socket;
    }),
    emit: vi.fn((event: string, _payload?: unknown, ack?: (r: any) => void) => {
      if (typeof ack === 'function') {
        const response = ackResponses[event] ?? { ok: true };
        ack(response);
      }
      return true;
    }),
    trigger(event: string, payload?: unknown) {
      handlers.get(event)?.forEach((cb) => cb(payload));
    },
    setAckResponse(event: string, response: any) {
      ackResponses[event] = response;
    },
    listenerCount(event: string) {
      return handlers.get(event)?.size ?? 0;
    },
  };
  return socket;
}

afterEach(() => {
  // ensure timers are reset between tests
  vi.useRealTimers();
});

describe('useCall — extended branches', () => {
  it('initiateCall: keeps idle and surfaces the ack error', () => {
    const socket = createSocketMock();
    socket.setAckResponse('call:start', { error: 'Other party offline' });
    const { result } = renderHook(() => useCall(socket as any, 'me'));

    act(() => {
      result.current.initiateCall('conv-x', 'audio', { id: 'r', name: 'R', avatar: 'R' });
    });

    expect(result.current.callState.status).toBe('idle');
    expect(result.current.callState.error).toBe('Other party offline');
  });

  it('initiateCall: no-op when there is no socket', () => {
    const { result } = renderHook(() => useCall(null, 'me'));
    act(() => {
      result.current.initiateCall('conv-x', 'audio', { id: 'r', name: 'R', avatar: 'R' });
    });
    expect(result.current.callState.status).toBe('idle');
    expect(result.current.callState.error).toBeNull();
  });

  it('rejectCall: emits and resets state', () => {
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));

    act(() => {
      socket.trigger('call:incoming', {
        callerId: 'caller', type: 'audio', conversationId: 'c-1',
      });
    });
    expect(result.current.callState.status).toBe('ringing');

    act(() => {
      result.current.rejectCall();
    });
    expect(socket.emit).toHaveBeenCalledWith('call:rejected', { conversationId: 'c-1' });
    expect(result.current.callState.status).toBe('idle');
    expect(result.current.callState.conversationId).toBeNull();
  });

  it('rejectCall: no-op when there is no current conversation', () => {
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));
    act(() => {
      result.current.rejectCall();
    });
    expect(socket.emit).not.toHaveBeenCalledWith('call:rejected', expect.anything());
  });

  it('endCall: emits and resets state', () => {
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));

    act(() => {
      result.current.initiateCall('c-end', 'audio', { id: 'u', name: 'U', avatar: 'U' });
    });
    expect(result.current.callState.status).toBe('calling');

    act(() => {
      result.current.endCall();
    });
    expect(socket.emit).toHaveBeenCalledWith('call:end', { conversationId: 'c-end' });
    expect(result.current.callState.status).toBe('idle');
  });

  it('endCall: no-op when there is no current conversation', () => {
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));
    act(() => {
      result.current.endCall();
    });
    expect(socket.emit).not.toHaveBeenCalledWith('call:end', expect.anything());
  });

  it('patchRemoteUser: updates the name/avatar in place', () => {
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));

    act(() => {
      socket.trigger('call:incoming', {
        callerId: 'c1', type: 'audio', conversationId: 'cp',
      });
    });
    expect(result.current.callState.remoteUser?.name).toBe('Utilisateur');

    act(() => {
      result.current.patchRemoteUser('Alice', 'A');
    });
    expect(result.current.callState.remoteUser?.name).toBe('Alice');
    expect(result.current.callState.remoteUser?.avatar).toBe('A');
  });

  it('patchRemoteUser: no state churn when name+avatar are unchanged', () => {
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));

    act(() => {
      socket.trigger('call:incoming', {
        callerId: 'c2', type: 'audio', conversationId: 'cs',
      });
    });
    const before = result.current.callState;
    act(() => {
      result.current.patchRemoteUser('Utilisateur', 'U');
    });
    expect(result.current.callState).toBe(before);
  });

  it('patchRemoteUser: no-op when there is no remote user yet', () => {
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));
    act(() => {
      result.current.patchRemoteUser('X', 'X');
    });
    expect(result.current.callState.remoteUser).toBeNull();
  });

  it('socket call:rejected event marks idle with error then auto-resets after 3s', () => {
    vi.useFakeTimers();
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));

    act(() => {
      result.current.initiateCall('c-rej', 'audio', { id: 'u', name: 'U', avatar: 'U' });
    });
    expect(result.current.callState.status).toBe('calling');

    act(() => {
      socket.trigger('call:rejected', {});
    });
    expect(result.current.callState.status).toBe('idle');
    expect(result.current.callState.error).toBe('Appel refusé');

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(result.current.callState.error).toBeNull();
    expect(result.current.callState.conversationId).toBeNull();
  });

  it('socket call:timeout event sets "Appel manqué" and auto-resets', () => {
    vi.useFakeTimers();
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));

    act(() => {
      result.current.initiateCall('c-to', 'audio', { id: 'u', name: 'U', avatar: 'U' });
    });
    act(() => {
      socket.trigger('call:timeout', {});
    });
    expect(result.current.callState.error).toBe('Appel manqué');

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(result.current.callState.error).toBeNull();
  });

  it('socket call:end event marks ended then auto-resets after 2s', () => {
    vi.useFakeTimers();
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));

    act(() => {
      result.current.initiateCall('c-end-evt', 'audio', { id: 'u', name: 'U', avatar: 'U' });
    });
    act(() => {
      socket.trigger('call:end', {});
    });
    expect(result.current.callState.status).toBe('ended');

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.callState.status).toBe('idle');
  });

  it('socket call:accepted event flips state to in-call with a startTime', () => {
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));

    act(() => {
      result.current.initiateCall('c-acc', 'audio', { id: 'u', name: 'U', avatar: 'U' });
    });
    expect(result.current.callState.status).toBe('calling');

    act(() => {
      socket.trigger('call:accepted', {});
    });
    expect(result.current.callState.status).toBe('in-call');
    expect(result.current.callState.startTime).toBeInstanceOf(Date);
  });

  it('duration ticks every second while in-call', () => {
    vi.useFakeTimers();
    const socket = createSocketMock();
    const { result } = renderHook(() => useCall(socket as any, 'me'));

    act(() => {
      socket.trigger('call:incoming', {
        callerId: 'c', type: 'audio', conversationId: 'c-dur',
      });
    });
    act(() => {
      result.current.acceptCall();
    });
    expect(result.current.callState.status).toBe('in-call');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.callState.duration).toBeGreaterThanOrEqual(2);
  });

  it('cleans up socket listeners on unmount', () => {
    const socket = createSocketMock();
    const { unmount } = renderHook(() => useCall(socket as any, 'me'));

    expect(socket.listenerCount('call:incoming')).toBe(1);
    expect(socket.listenerCount('call:accepted')).toBe(1);

    unmount();

    expect(socket.listenerCount('call:incoming')).toBe(0);
    expect(socket.listenerCount('call:accepted')).toBe(0);
    expect(socket.listenerCount('call:rejected')).toBe(0);
    expect(socket.listenerCount('call:timeout')).toBe(0);
    expect(socket.listenerCount('call:end')).toBe(0);
  });

  it('does nothing when there is no socket at all', () => {
    const { result } = renderHook(() => useCall(null, 'me'));
    expect(result.current.callState.status).toBe('idle');
    act(() => {
      result.current.acceptCall();
      result.current.rejectCall();
      result.current.endCall();
      result.current.patchRemoteUser('X', 'X');
    });
    expect(result.current.callState.status).toBe('idle');
  });
});
