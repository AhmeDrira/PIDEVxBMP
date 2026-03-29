import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export type CallState = {
  status: 'idle' | 'calling' | 'ringing' | 'in-call' | 'ended';
  type: 'audio' | 'video' | null;
  remoteUser: { id: string; name: string; avatar: string } | null;
  conversationId: string | null;
  startTime: Date | null;
  duration: number;
  error: string | null;
  isCaller: boolean;
};

const initialState: CallState = {
  status: 'idle',
  type: null,
  remoteUser: null,
  conversationId: null,
  startTime: null,
  duration: 0,
  error: null,
  isCaller: false,
};

export function useCall(socket: Socket | null, currentUserId: string | null) {
  const [callState, setCallState] = useState<CallState>(initialState);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState.status === 'in-call' && callState.startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - callState.startTime!.getTime()) / 1000);
        setCallState(prev => ({ ...prev, duration: diff }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState.status, callState.startTime]);

  useEffect(() => {
    if (!socket) return;

    const onIncoming = (data: any) => {
      setCallState({
        status: 'ringing',
        type: data.type,
        remoteUser: { id: data.callerId, name: 'Utilisateur', avatar: 'U' }, // Will be patched later
        conversationId: data.conversationId,
        startTime: null,
        duration: 0,
        error: null,
        isCaller: false,
      });
    };

    const onAccepted = () => {
      setCallState(prev => ({
        ...prev,
        status: 'in-call',
        startTime: new Date()
      }));
    };

    const onRejected = () => {
      setCallState(prev => ({ ...prev, status: 'idle', error: 'Appel refusé' }));
      setTimeout(() => setCallState(initialState), 3000);
    };

    const onTimeout = () => {
      setCallState(prev => ({ ...prev, status: 'idle', error: 'Appel manqué' }));
      setTimeout(() => setCallState(initialState), 3000);
    };

    const onEnd = () => {
      setCallState(prev => ({ ...prev, status: 'ended' }));
      setTimeout(() => setCallState(initialState), 2000);
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:timeout', onTimeout);
    socket.on('call:end', onEnd);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:timeout', onTimeout);
      socket.off('call:end', onEnd);
    };
  }, [socket]);

  const initiateCall = useCallback((conversationId: string, type: 'audio' | 'video', remoteUser: { id: string; name: string; avatar: string }) => {
    console.log('[useCall] initiateCall Triggered.', { conversationId, type, socketConnected: socket?.connected });
    if (socket) {
      socket.emit('call:start', { conversationId, type }, (response: any) => {
        console.log('[useCall] call:start callback response:', response);
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
    if (socket && callState.conversationId) {
      socket.emit('call:accepted', { conversationId: callState.conversationId });
      setCallState(prev => ({ ...prev, status: 'in-call', startTime: new Date() }));
    }
  }, [socket, callState.conversationId]);

  const rejectCall = useCallback(() => {
    if (socket && callState.conversationId) {
      socket.emit('call:rejected', { conversationId: callState.conversationId });
      setCallState(initialState);
    }
  }, [socket, callState.conversationId]);

  const endCall = useCallback(() => {
    if (socket && callState.conversationId) {
      socket.emit('call:end', { conversationId: callState.conversationId });
      setCallState(initialState);
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

  return {
    callState,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    patchRemoteUser
  };
}
