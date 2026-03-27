import { useState, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useWebRTC(socket: Socket | null, conversationId: string | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  const peerConnection = useRef<RTCPeerConnection | null>(null);

  const initLocalStream = useCallback(async (type: 'audio' | 'video', retryWithoutVideo = false) => {
    console.log('[useWebRTC] initLocalStream called', { type, retryWithoutVideo });
    try {
      const constraints = {
        audio: true,
        video: retryWithoutVideo ? false : (type === 'video')
      };
      console.log('[useWebRTC] Requesting getUserMedia with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[useWebRTC] getUserMedia success. Stream tracks:', stream.getTracks().length);
      setLocalStream(stream);
      return stream;
    } catch (err: any) {
      console.error('[useWebRTC] Error accessing media devices:', err);
      // Fallback si la caméra est indisponible (NotReadableError ou NotAllowedError liés à la vidéo)
      if (type === 'video' && !retryWithoutVideo) {
        console.warn('[useWebRTC] Retrying with audio only due to video error...');
        return initLocalStream('audio', true);
      }
      throw err;
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    const pc = new RTCPeerConnection(configuration);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && conversationId) {
        socket.emit('call:ice-candidate', {
          conversationId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    peerConnection.current = pc;
    return pc;
  }, [socket, conversationId]);

  const startCall = useCallback(async (type: 'audio' | 'video') => {
    const stream = await initLocalStream(type);
    const pc = createPeerConnection();

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (socket && conversationId) {
      socket.emit('call:offer', { conversationId, offer });
    }
  }, [initLocalStream, createPeerConnection, socket, conversationId]);

  const acceptCall = useCallback(async (type: 'audio' | 'video', offer: RTCSessionDescriptionInit) => {
    const stream = await initLocalStream(type);
    const pc = createPeerConnection();

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (socket && conversationId) {
      socket.emit('call:answer', { conversationId, answer });
    }
  }, [initLocalStream, createPeerConnection, socket, conversationId]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (peerConnection.current) {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (peerConnection.current) {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const toggleMicrophone = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicrophoneEnabled(!isMicrophoneEnabled);
    }
  }, [localStream, isMicrophoneEnabled]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraEnabled(!isCameraEnabled);
    }
  }, [localStream, isCameraEnabled]);

  const endCall = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setRemoteStream(null);
    setIsMicrophoneEnabled(true);
    setIsCameraEnabled(true);
  }, [localStream]);

  return {
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    handleAnswer,
    handleIceCandidate,
    endCall,
    toggleMicrophone,
    toggleCamera,
    isMicrophoneEnabled,
    isCameraEnabled
  };
}
