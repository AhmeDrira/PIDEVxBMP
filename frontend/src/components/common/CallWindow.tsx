import React, { useEffect, useRef } from 'react';
import { CallState } from '../../hooks/useCall';
import CallControls from './CallControls';
import { Avatar, AvatarFallback } from '../ui/avatar';

import { useLanguage } from '../../context/LanguageContext';
interface CallWindowProps {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
}

export default function CallWindow({
  callState,
  localStream,
  remoteStream,
  isMicrophoneEnabled,
  isCameraEnabled,
  onToggleMicrophone,
  onToggleCamera,
  onEndCall
}: CallWindowProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callState.status !== 'in-call') return null;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isVideo = callState.type === 'video';

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header Info */}
      <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent z-40 flex flex-col items-center">
        <h2 className="text-white font-bold text-2xl drop-shadow-md">
          {callState.remoteUser?.name || 'Utilisateur'}
        </h2>
        <span className="text-white/80 font-mono text-sm mt-1">
          {formatDuration(callState.duration)}
        </span>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative w-full h-full flex items-center justify-center">
        {isVideo ? (
          <>
            {/* Distant Video Fullscreen */}
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover z-10" />
            ) : (
              <div className="text-white/50 animate-pulse flex flex-col items-center z-10">
                <span className="text-xl">Connexion vidéo en cours...</span>
              </div>
            )}
            
            {/* Local Video (PiP) */}
            <div className="absolute bottom-8 right-8 w-44 h-60 bg-gray-800 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-30 transition-all hover:scale-105 cursor-pointer">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isCameraEnabled ? 'hidden' : ''}`}
              />
              {!isCameraEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white/50 text-sm p-4 text-center">
                  Votre caméra est désactivée
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center z-20">
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '3s' }}></div>
              <Avatar className="h-40 w-40 ring-4 ring-primary/30 shadow-2xl relative z-10">
                <AvatarFallback className="text-5xl bg-primary dark:bg-blue-600 text-white">
                  {callState.remoteUser?.avatar || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            {/* Audio stream attachment */}
            <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
          </div>
        )}
      </div>

      {/* Controls Overlay */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-lg rounded-full px-8 py-3 shadow-2xl border border-white/10 z-40">
        <CallControls
          isMicrophoneEnabled={isMicrophoneEnabled}
          isCameraEnabled={isCameraEnabled}
          toggleMicrophone={onToggleMicrophone}
          toggleCamera={onToggleCamera}
          endCall={onEndCall}
          isVideoCall={isVideo}
        />
      </div>
    </div>
  );
}
