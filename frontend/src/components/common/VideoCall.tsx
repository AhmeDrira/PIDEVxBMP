import React, { useEffect, useRef } from 'react';
import { CallState } from '../../hooks/useCall';
import CallControls from './CallControls';

interface VideoCallProps {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  toggleMicrophone: () => void;
  toggleCamera: () => void;
  endCall: () => void;
}

export default function VideoCall({
  callState,
  localStream,
  remoteStream,
  isMicrophoneEnabled,
  isCameraEnabled,
  toggleMicrophone,
  toggleCamera,
  endCall
}: VideoCallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((e) => console.error('[VideoCall] Local play error:', e));
      console.log('[VideoCall] Local video attached! stream id:', localStream.id);
    } else {
      console.log('[VideoCall] Could not attach local stream:', { hasRef: !!localVideoRef.current, hasStream: !!localStream });
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((e) => console.error('[VideoCall] Remote play error:', e));
      console.log('[VideoCall] Remote video attached! stream id:', remoteStream.id);
    } else {
      console.log('[VideoCall] Could not attach remote stream:', { hasRef: !!remoteVideoRef.current, hasStream: !!remoteStream });
    }
  }, [remoteStream]);

  console.log('[VideoCall] Rendered. localStream:', !!localStream, 'remoteStream:', !!remoteStream);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative h-full w-full bg-black rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
      
      {/* Visual test element suggested by user */}
      <div 
        className="absolute top-4 left-4 z-50 text-white p-2 text-xs font-bold rounded"
        style={{ backgroundColor: 'red', zIndex: 1000 }}
      >
        VideoCall Component - Local: {localStream ? 'OK' : 'NO'} | Remote: {remoteStream ? 'OK' : 'NO'}
      </div>

      {/* Remote Video (Full Size) */}
      <div 
        className="absolute inset-0 flex items-center justify-center z-0"
        style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
      >
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: 'black' }}
          />
        ) : (
          <div className="text-white/50 animate-pulse flex flex-col items-center">
            <span className="text-lg">Connexion en cours...</span>
          </div>
        )}
      </div>

      {/* Local Video (PiP) */}
      <div 
        className="absolute shadow-[0_10px_25px_rgba(0,0,0,0.3)] z-10 transition-all duration-300 overflow-hidden"
        style={{ 
          bottom: '100px', 
          right: '20px', 
          width: '180px', 
          height: '240px', 
          backgroundColor: 'var(--foreground)', 
          borderRadius: '12px', 
          border: '2px solid white',
          zIndex: 50
        }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover', 
            display: isCameraEnabled ? 'block' : 'none',
            backgroundColor: 'black',
            transform: 'scaleX(-1)'
          }}
        />
        {!isCameraEnabled && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-2">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mb-3">
              <span className="text-xl font-bold">Moi</span>
            </div>
            <span className="text-xs text-center text-muted-foreground">Caméra<br/>désactivée</span>
          </div>
        )}
      </div>

      {/* Header Info */}
      <div className="absolute top-0 w-full p-4 bg-gradient-to-b from-black/60 to-transparent z-10 flex justify-between items-start">
        <div>
          <h2 className="text-white font-bold text-lg drop-shadow-md">
            {callState.remoteUser?.name || 'Utilisateur'}
          </h2>
          <span className="text-white/90 font-mono text-sm bg-black/30 px-2 py-0.5 rounded-md backdrop-blur-sm">
            {formatDuration(callState.duration)}
          </span>
        </div>
      </div>

      {/* Call Controls Container */}
      <div 
        className="absolute"
        style={{ 
          bottom: '24px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'center', 
          zIndex: 100 
        }}
      >
        <CallControls
          isMicrophoneEnabled={isMicrophoneEnabled}
          isCameraEnabled={isCameraEnabled}
          toggleMicrophone={toggleMicrophone}
          toggleCamera={toggleCamera}
          endCall={endCall}
          isVideoCall={true}
        />
      </div>
    </div>
  );
}
