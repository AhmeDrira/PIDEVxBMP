import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '../ui/button';

interface VoiceMessageProps {
  url: string;
  duration: number;
  isSelf: boolean;
  messageId: string;
}

export default function VoiceMessage({ url, duration, isSelf, messageId }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleStopOtherAudio = (e: CustomEvent) => {
      if (e.detail.messageId !== messageId && isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('stop-all-audio', handleStopOtherAudio as EventListener);
    return () => {
      window.removeEventListener('stop-all-audio', handleStopOtherAudio as EventListener);
    };
  }, [messageId, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      window.dispatchEvent(new CustomEvent('stop-all-audio', { detail: { messageId } }));
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "00:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded-2xl shadow-sm ${isSelf ? 'text-white' : 'bg-white text-gray-800 border border-gray-100'}`} style={isSelf ? { backgroundColor: '#1E40AF' } : {}}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-8 w-8 rounded-full flex-shrink-0 ${isSelf ? 'hover:bg-blue-800 text-white' : 'hover:bg-gray-100 text-gray-800'}`}
        onClick={togglePlay}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </Button>
      
      <div className="flex flex-col flex-1 w-32 md:w-48">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className={`h-1.5 w-full rounded-lg appearance-none cursor-pointer ${isSelf ? 'bg-blue-400 accent-white' : 'bg-gray-200 accent-blue-600'}`}
          style={{ WebkitAppearance: 'none' }}
        />
        <div className="flex justify-between text-[10px] mt-1.5 font-medium opacity-90">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <audio ref={audioRef} src={url} className="hidden" preload="metadata" />
    </div>
  );
}
