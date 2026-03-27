import React from 'react';
import { Mic, MicOff, VideoIcon, VideoOff, PhoneOff } from 'lucide-react';


interface CallControlsProps {
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  toggleMicrophone: () => void;
  toggleCamera: () => void;
  endCall: () => void;
  isVideoCall: boolean;
}

export default function CallControls({
  isMicrophoneEnabled,
  isCameraEnabled,
  toggleMicrophone,
  toggleCamera,
  endCall,
  isVideoCall
}: CallControlsProps) {
  return (
    <div 
      className="flex items-center justify-center gap-6 px-8 py-4 rounded-full backdrop-blur-md shadow-2xl"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      {/* Mic Button */}
      <button
        onClick={toggleMicrophone}
        className="p-4 rounded-full transition-all duration-200"
        style={{ 
          backgroundColor: isMicrophoneEnabled ? 'rgba(255,255,255,0.2)' : '#EF4444',
          color: 'white'
        }}
        title={isMicrophoneEnabled ? "Désactiver le micro" : "Activer le micro"}
      >
        {isMicrophoneEnabled ? <Mic size={24} /> : <MicOff size={24} />}
      </button>

      {/* Hangup Button */}
      <button
        onClick={endCall}
        className="p-4 rounded-full hover:bg-red-700 transition-all shadow-lg shadow-red-500/30"
        style={{ backgroundColor: '#EF4444', color: 'white' }}
        title="Raccrocher"
      >
        <PhoneOff size={24} />
      </button>

      {/* Camera Button (Only for Video Calls) */}
      {isVideoCall && (
        <button
          onClick={toggleCamera}
          className="p-4 rounded-full transition-all duration-200"
          style={{ 
            backgroundColor: isCameraEnabled ? 'rgba(255,255,255,0.2)' : '#EF4444',
            color: 'white'
          }}
          title={isCameraEnabled ? "Désactiver la caméra" : "Activer la caméra"}
        >
          {isCameraEnabled ? <VideoIcon size={24} /> : <VideoOff size={24} />}
        </button>
      )}
    </div>
  );
}
