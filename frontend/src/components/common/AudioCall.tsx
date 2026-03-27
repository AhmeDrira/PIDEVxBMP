import React from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { CallState } from '../../hooks/useCall';
import CallControls from './CallControls';

interface AudioCallProps {
  callState: CallState;
  remoteStream: MediaStream | null;
  isMicrophoneEnabled: boolean;
  toggleMicrophone: () => void;
  endCall: () => void;
}

export default function AudioCall({
  callState,
  remoteStream,
  isMicrophoneEnabled,
  toggleMicrophone,
  endCall
}: AudioCallProps) {
  const remoteAudioRef = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    console.log('[AudioCall] Rendered - remoteUser:', callState.remoteUser);
    console.log('[AudioCall] remoteStream exists:', !!remoteStream);
    
    if (remoteAudioRef.current && remoteStream) {
      console.log('[AudioCall] Attaching remote stream to audio element!');
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(e => console.error('[AudioCall] Audio play error:', e));
    }
  }, [remoteStream, callState.remoteUser]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="flex flex-col items-center justify-center relative overflow-hidden"
      style={{ width: '100%', height: '100%', backgroundColor: '#111827', padding: '24px' }}
    >
      {/* Enhanced Audio Waves Animation */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        <div className="absolute w-[200px] h-[200px] bg-blue-500 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
        <div className="absolute w-[300px] h-[300px] bg-blue-400 rounded-full animate-ping" style={{ animationDuration: '4s', animationDelay: '0.5s' }}></div>
        <div className="absolute w-[450px] h-[450px] bg-blue-300 rounded-full animate-ping" style={{ animationDuration: '5s', animationDelay: '1s' }}></div>
      </div>

      <div className="z-10 flex flex-col items-center">
        <div className="relative mb-8">
          <Avatar 
            className="shadow-2xl border-4"
            style={{ width: '120px', height: '120px', borderColor: '#374151' }}
          >
            <AvatarFallback className="bg-blue-600 text-white text-4xl">
              {callState.remoteUser?.name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
        </div>

        <h2 className="text-3xl font-bold text-white mb-3 tracking-wide drop-shadow-md">
          {callState.remoteUser?.name || 'Utilisateur'}
        </h2>
        
        <div className="px-4 py-1 bg-black/40 rounded-full backdrop-blur-sm border border-white/10 text-white/90 font-mono text-xl tracking-wider shadow-inner mb-12">
          {formatDuration(callState.duration)}
        </div>

        <div 
          className="absolute"
          style={{ bottom: '24px', left: '50%', transform: 'translateX(-50%)', width: '100%', display: 'flex', justifyContent: 'center', zIndex: 100 }}
        >
          <CallControls
            isMicrophoneEnabled={isMicrophoneEnabled}
            isCameraEnabled={false}
            toggleMicrophone={toggleMicrophone}
            toggleCamera={() => {}}
            endCall={endCall}
            isVideoCall={false}
          />
        </div>

        {/* Invisible audio element to play the remote user's voice */}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      </div>
    </div>
  );
}
