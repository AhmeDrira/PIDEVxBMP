import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalCallProvider, useGlobalCall } from '@/context/GlobalCallContext';

type EventHandler = (payload?: any) => void;

function createSocketMock() {
  const handlers = new Map<string, Set<EventHandler>>();

  return {
    on: vi.fn((event: string, handler: EventHandler) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)?.add(handler);
      return true;
    }),
    off: vi.fn((event: string, handler: EventHandler) => {
      handlers.get(event)?.delete(handler);
      return true;
    }),
    emit: vi.fn(),
    trigger: (event: string, payload?: any) => {
      handlers.get(event)?.forEach((handler) => handler(payload));
    },
  };
}

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: (globalThis as any).__globalCallSocketMock__ ?? null }),
}));

vi.mock('@/components/common/IncomingCallModal', () => ({
  default: ({ callState, onAccept, onReject }: any) => (
    <div data-testid="incoming-call-modal">
      <span data-testid="incoming-call-modal-status">{callState.status}</span>
      <button type="button" onClick={onAccept}>accept-incoming-call</button>
      <button type="button" onClick={onReject}>reject-incoming-call</button>
    </div>
  ),
}));

function GlobalCallProbe() {
  const { callState, pendingOffer, clearPendingOffer, setIsMessagesOpen } = useGlobalCall();

  return (
    <div>
      <span data-testid="global-call-status">{callState.status}</span>
      <span data-testid="pending-offer-state">{pendingOffer ? 'present' : 'none'}</span>
      <button type="button" onClick={() => clearPendingOffer()}>clear-pending-offer</button>
      <button type="button" onClick={() => setIsMessagesOpen(true)}>open-messages</button>
      <button type="button" onClick={() => setIsMessagesOpen(false)}>close-messages</button>
    </div>
  );
}

describe('GlobalCallContext', () => {
  beforeEach(() => {
    localStorage.clear();
    (globalThis as any).__globalCallSocketMock__ = createSocketMock();
  });

  it('should switch to ringing state when call incoming event is received', async () => {
    // Arrange
    const socket = (globalThis as any).__globalCallSocketMock__;

    render(
      <GlobalCallProvider>
        <GlobalCallProbe />
      </GlobalCallProvider>
    );

    // Act
    act(() => {
      socket.trigger('call:incoming', {
        type: 'audio',
        callerId: 'user-remote',
        conversationId: 'conv-1',
      });
    });

    // Assert
    expect(await screen.findByTestId('incoming-call-modal')).toBeInTheDocument();
    expect(screen.getByTestId('incoming-call-modal-status')).toHaveTextContent('ringing');
    expect(screen.getByTestId('global-call-status')).toHaveTextContent('ringing');
  });

  it('should accept incoming call and emit call accepted event', async () => {
    // Arrange
    const socket = (globalThis as any).__globalCallSocketMock__;
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const user = userEvent.setup();

    render(
      <GlobalCallProvider>
        <GlobalCallProbe />
      </GlobalCallProvider>
    );

    act(() => {
      socket.trigger('call:incoming', {
        type: 'video',
        callerId: 'user-remote',
        conversationId: 'conv-44',
      });
    });

    // Act
    await user.click(await screen.findByRole('button', { name: 'accept-incoming-call' }));

    // Assert
    expect(socket.emit).toHaveBeenCalledWith('call:accepted', { conversationId: 'conv-44' });
    expect(localStorage.getItem('pendingCallConvId')).toBe('conv-44');
    expect(dispatchSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('global-call-status')).toHaveTextContent('in-call');
    });

    dispatchSpy.mockRestore();
  });

  it('should buffer offer only when messages page is not open', async () => {
    // Arrange
    const socket = (globalThis as any).__globalCallSocketMock__;
    const user = userEvent.setup();

    render(
      <GlobalCallProvider>
        <GlobalCallProbe />
      </GlobalCallProvider>
    );

    // Act
    act(() => {
      socket.trigger('call:offer', {
        offer: { type: 'offer', sdp: 'offer-1' },
      });
    });

    // Assert
    expect(screen.getByTestId('pending-offer-state')).toHaveTextContent('present');

    await user.click(screen.getByRole('button', { name: 'clear-pending-offer' }));
    expect(screen.getByTestId('pending-offer-state')).toHaveTextContent('none');

    await user.click(screen.getByRole('button', { name: 'open-messages' }));
    act(() => {
      socket.trigger('call:offer', {
        offer: { type: 'offer', sdp: 'offer-2' },
      });
    });

    expect(screen.getByTestId('pending-offer-state')).toHaveTextContent('none');
  });

  it('should reject incoming call and reset call state', async () => {
    // Arrange
    const socket = (globalThis as any).__globalCallSocketMock__;
    const user = userEvent.setup();

    render(
      <GlobalCallProvider>
        <GlobalCallProbe />
      </GlobalCallProvider>
    );

    act(() => {
      socket.trigger('call:incoming', {
        type: 'audio',
        callerId: 'user-remote-2',
        conversationId: 'conv-99',
      });
    });

    // Act
    await user.click(await screen.findByRole('button', { name: 'reject-incoming-call' }));

    // Assert
    expect(socket.emit).toHaveBeenCalledWith('call:rejected', { conversationId: 'conv-99' });
    expect(screen.getByTestId('global-call-status')).toHaveTextContent('idle');
    expect(screen.queryByTestId('incoming-call-modal')).not.toBeInTheDocument();
  });
});