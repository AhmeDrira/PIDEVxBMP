import React from 'react';
import { PhoneOff } from 'lucide-react';

import { Avatar, AvatarFallback } from '../ui/avatar';
import { CallState } from '../../hooks/useCall';

interface CallingModalProps {
  callState: CallState;
  onCancel: () => void;
}

export default function CallingModal({ callState, onCancel }: CallingModalProps) {
  if (callState.status !== 'calling') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center">
        <div className="relative mb-6">
          <Avatar className="h-24 w-24 ring-4 ring-primary/20">
            <AvatarFallback className="text-3xl bg-primary text-white">
              {callState.remoteUser?.avatar || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-1">
          {callState.remoteUser?.name || 'Utilisateur'}
        </h3>
        <p className="text-gray-500 mb-2">Appel {callState.type === 'video' ? 'vidéo' : 'audio'} en cours...</p>
        <p className="text-primary italic mb-8 animate-pulse">Sonnerie...</p>

        <button
          type="button"
          onClick={onCancel}
          style={{ backgroundColor: '#EF4444', color: 'white' }}
          className="flex items-center gap-2 px-6 py-3 mt-4 rounded-full hover:bg-red-600 shadow-lg font-medium text-lg transition-all cursor-pointer"
        >
          <PhoneOff size={24} />
          Annuler
        </button>
      </div>
    </div>
  );
}
