import React from 'react';
import { Phone, Video } from 'lucide-react';
import { Button } from '../ui/button';

import { useLanguage } from '../../context/LanguageContext';
interface CallButtonProps {
  onAudioCall: () => void;
  onVideoCall: () => void;
  disabled?: boolean;
}

export default function CallButton({ onAudioCall, onVideoCall, disabled }: CallButtonProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors h-10 w-10"
        onClick={onAudioCall}
        disabled={disabled}
        title="Appel audio"
      >
        <Phone size={20} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors h-10 w-10"
        onClick={onVideoCall}
        disabled={disabled}
        title="Appel vidéo"
      >
        <Video size={20} />
      </Button>
    </div>
  );
}
