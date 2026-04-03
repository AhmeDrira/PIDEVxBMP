import React from 'react';
import { Phone, Video, X, Check } from 'lucide-react';

import { Avatar, AvatarFallback } from '../ui/avatar';
import { CallState } from '../../hooks/useCall';

import { useLanguage } from '../../context/LanguageContext';
interface IncomingCallModalProps {
  callState: CallState;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({ callState, onAccept, onReject }: IncomingCallModalProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  if (callState.status !== 'ringing') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center animate-in zoom-in-95 duration-200 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
          <Avatar className="h-24 w-24 ring-4 ring-primary/20 relative z-10">
            <AvatarFallback className="text-3xl bg-primary dark:bg-blue-600 text-white">
              {callState.remoteUser?.avatar || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
        
        <h3 className="text-2xl font-bold text-foreground mb-1">
          {callState.remoteUser?.name || 'Utilisateur'}
        </h3>
        <p className="text-muted-foreground mb-8 flex items-center justify-center gap-2">
          {callState.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
          <span>Appel {callState.type === 'video' ? 'vidéo' : 'audio'} entrant...</span>
        </p>

        <div className="flex w-full justify-center gap-8 mt-6">
          <button
            type="button"
            onClick={onReject}
            style={{ backgroundColor: '#EF4444', color: 'white' }}
            className="flex items-center gap-2 px-6 py-3 rounded-full hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all font-medium text-lg cursor-pointer"
          >
            <X size={24} />
            Refuser
          </button>

          <button
            type="button"
            onClick={onAccept}
            style={{ backgroundColor: '#10B981', color: 'white' }}
            className="flex items-center gap-2 px-6 py-3 rounded-full hover:bg-green-600 shadow-lg shadow-green-500/30 transition-all font-medium text-lg animate-bounce cursor-pointer"
          >
            <Check size={24} />
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
