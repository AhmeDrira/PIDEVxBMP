import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useSocket } from './SocketContext';
import IncomingCallModal from '../components/common/IncomingCallModal';
import { CallState } from '../hooks/useCall';

const initialCallState: CallState = {
  status: 'idle',
  type: null,
  remoteUser: null,
  conversationId: null,
  startTime: null,
  duration: 0,
  error: null,
  isCaller: false,
};

interface GlobalCallContextValue {
  callState: CallState;
  initiateCall: (conversationId: string, type: 'audio' | 'video', remoteUser: { id: string; name: string; avatar: string }) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  patchRemoteUser: (name: string, avatar: string) => void;
  setIsMessagesOpen: (open: boolean) => void;
  pendingOffer: RTCSessionDescriptionInit | null;
  clearPendingOffer: () => void;
}

const GlobalCallContext = createContext<GlobalCallContextValue>({
  callState: initialCallState,
  initiateCall: () => {},
  acceptCall: () => {},
  rejectCall: () => {},
  endCall: () => {},
  patchRemoteUser: () => {},
  setIsMessagesOpen: () => {},
  pendingOffer: null,
  clearPendingOffer: () => {},
});

export const useGlobalCall = () => useContext(GlobalCallContext);

export const GlobalCallProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocket();
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [isMessagesOpen, setIsMessagesOpenState] = useState(false);
  const isMessagesOpenRef = useRef(false);
  // Buffer WebRTC offer when callee navigates to Messages page
  const [pendingOffer, setPendingOffer] = useState<RTCSessionDescriptionInit | null>(null);

  // Duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState.status === 'in-call' && callState.startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - callState.startTime!.getTime()) / 1000);
        setCallState(prev => ({ ...prev, duration: diff }));
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [callState.status, callState.startTime]);

  useEffect(() => {
    if (!socket) return;

    const onIncoming = (data: any) => {
      setCallState({
        status: 'ringing',
        type: data.type,
        remoteUser: { id: data.callerId, name: 'Utilisateur', avatar: 'U' },
        conversationId: data.conversationId,
        startTime: null,
        duration: 0,
        error: null,
        isCaller: false,
      });
    };

    const onAccepted = () => {
      setCallState(prev => ({ ...prev, status: 'in-call', startTime: new Date() }));
    };

    const onRejected = () => {
      setCallState(prev => ({ ...prev, status: 'idle', error: 'Appel refusé' }));
      setTimeout(() => setCallState(initialCallState), 3000);
    };

    const onTimeout = () => {
      setCallState(prev => ({ ...prev, status: 'idle', error: 'Appel manqué' }));
      setTimeout(() => setCallState(initialCallState), 3000);
    };

    const onEnd = () => {
      setCallState(prev => ({ ...prev, status: 'ended' }));
      setTimeout(() => setCallState(initialCallState), 2000);
    };

    // Buffer the WebRTC offer only when Messages is NOT mounted
    const onOffer = (data: any) => {
      if (!isMessagesOpenRef.current) {
        setPendingOffer(data.offer);
      }
      // If Messages IS open, its own socket.on('call:offer') handles it
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:timeout', onTimeout);
    socket.on('call:end', onEnd);
    socket.on('call:offer', onOffer);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:timeout', onTimeout);
      socket.off('call:end', onEnd);
      socket.off('call:offer', onOffer);
    };
  }, [socket]);

  const initiateCall = useCallback((conversationId: string, type: 'audio' | 'video', remoteUser: { id: string; name: string; avatar: string }) => {
    if (socket) {
      socket.emit('call:start', { conversationId, type }, (response: any) => {
        if (response && response.error) {
          setCallState(prev => ({ ...prev, status: 'idle', error: response.error }));
        } else {
          setCallState({
            status: 'calling',
            type,
            remoteUser,
            conversationId,
            startTime: null,
            duration: 0,
            error: null,
            isCaller: true,
          });
        }
      });
    }
  }, [socket]);

  const acceptCall = useCallback(() => {
    if (!socket) return;
    setCallState(prev => {
      if (!prev.conversationId) return prev;
      const conversationId = prev.conversationId;
      socket.emit('call:accepted', { conversationId });
      // If not on Messages page, navigate there
      if (!isMessagesOpenRef.current) {
        localStorage.setItem('pendingCallConvId', conversationId);
        window.dispatchEvent(new CustomEvent('goto-messages-call', { detail: { conversationId } }));
      }
      return { ...prev, status: 'in-call', startTime: new Date() };
    });
  }, [socket]);

  const rejectCall = useCallback(() => {
    if (socket && callState.conversationId) {
      socket.emit('call:rejected', { conversationId: callState.conversationId });
      setCallState(initialCallState);
    }
  }, [socket, callState.conversationId]);

  const endCall = useCallback(() => {
    if (socket && callState.conversationId) {
      socket.emit('call:end', { conversationId: callState.conversationId });
      setCallState(initialCallState);
    }
  }, [socket, callState.conversationId]);

  const patchRemoteUser = useCallback((name: string, avatar: string) => {
    setCallState(prev => {
      if (prev.remoteUser && (prev.remoteUser.name !== name || prev.remoteUser.avatar !== avatar)) {
        return { ...prev, remoteUser: { ...prev.remoteUser, name, avatar } };
      }
      return prev;
    });
  }, []);

  const setIsMessagesOpen = useCallback((open: boolean) => {
    isMessagesOpenRef.current = open;
    setIsMessagesOpenState(open);
  }, []);

  const clearPendingOffer = useCallback(() => {
    setPendingOffer(null);
  }, []);

  return (
    <GlobalCallContext.Provider value={{
      callState,
      initiateCall,
      acceptCall,
      rejectCall,
      endCall,
      patchRemoteUser,
      setIsMessagesOpen,
      pendingOffer,
      clearPendingOffer,
    }}>
      {children}
      {/* Show IncomingCallModal globally only when NOT on Messages page */}
      {callState.status === 'ringing' && !isMessagesOpen && (
        <IncomingCallModal
          callState={callState}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}
    </GlobalCallContext.Provider>
  );
};
