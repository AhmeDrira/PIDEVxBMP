import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';
import { Button } from '../ui/button';

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void | Promise<void>;
  onCancel: () => void;
  onStateChange?: (isActive: boolean) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onSend, onCancel, onStateChange, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    const tracks = mediaRecorderRef.current?.stream.getTracks();
    tracks?.forEach(track => track.stop());
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl, cleanup]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange(isRecording || !!audioUrl);
    }
  }, [isRecording, audioUrl, onStateChange]);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Votre navigateur ne supporte pas l'enregistrement audio.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4') 
          ? 'audio/mp4' 
          : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 119) {
            stopRecording();
            return 120;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Erreur d'accès au microphone:", err);
      alert("Permission du microphone refusée.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Stop all tracks to release microphone light
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const resetVoiceRecorder = useCallback(() => {
    cleanup();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setIsRecording(false);
    setRecordingTime(0);
  }, [audioUrl, cleanup]);

  const handleSend = async () => {
    if (audioBlob) {
      try {
        await onSend(audioBlob, recordingTime);
        resetVoiceRecorder();
      } catch (err) {
        console.error("Erreur lors de l'envoi du message vocal:", err);
      }
    }
  };

  const handleCancelRecord = () => {
    resetVoiceRecorder();
    onCancel();
  };

  if (audioUrl) {
    return (
      <div className="flex items-center gap-3 w-full animate-in fade-in bg-gray-50 p-2 rounded-xl border border-gray-200">
        <audio src={audioUrl} controls className="h-10 w-full max-w-[200px]" />
        <Button type="button" variant="ghost" size="icon" onClick={handleCancelRecord} className="text-red-500 hover:text-red-700 hover:bg-red-50" title="Annuler">
          <Trash2 size={20} />
        </Button>
        <Button type="button" onClick={handleSend} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md px-4 h-10 ml-auto">
          <Send size={18} className="mr-2" /> Envoyer
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`rounded-xl transition-all ${isRecording ? 'text-red-500 bg-red-50 animate-pulse' : ''}`}
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
      title={isRecording ? "Arrêter l'enregistrement" : "Message vocal"}
    >
      {isRecording ? (
        <div className="flex items-center gap-2">
          <Square size={20} className="fill-current" />
          <span className="font-mono text-xs">{formatTime(recordingTime)}</span>
        </div>
      ) : (
        <Mic size={20} />
      )}
    </Button>
  );
}
