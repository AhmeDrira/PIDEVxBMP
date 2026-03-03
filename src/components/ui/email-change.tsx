import React, { useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Mail, CheckCircle2, Loader2, X } from 'lucide-react';
import authService from '../../services/authService';
import { toast } from 'sonner';

interface EmailChangeSectionProps {
  currentEmail: string;
  onEmailChanged: (newEmail: string) => void;
}

export function EmailChangeSection({ currentEmail, onEmailChanged }: EmailChangeSectionProps) {
  const [step, setStep] = useState<'idle' | 'entering' | 'verifying' | 'done'>('idle');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestChange = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      toast.error('New email is the same as your current email');
      return;
    }
    setIsLoading(true);
    try {
      await authService.requestEmailChange(newEmail);
      toast.success(`Verification code sent to ${newEmail}`);
      setStep('verifying');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyChange = async () => {
    if (!code || code.length !== 6) {
      toast.error('Please enter the 6-digit verification code');
      return;
    }
    setIsLoading(true);
    try {
      await authService.confirmEmailChange(code);
      // Update stored user with new email
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        localStorage.setItem('user', JSON.stringify({ ...currentUser, email: newEmail }));
      }
      toast.success('Email updated successfully!');
      onEmailChanged(newEmail);
      setStep('done');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid or expired code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setStep('idle');
    setNewEmail('');
    setCode('');
  };

  if (step === 'idle') {
    return (
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail size={14} />
          <span>{currentEmail}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setStep('entering')}
          className="text-xs h-7 px-3 rounded-lg"
        >
          Change Email
        </Button>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl mt-2">
        <CheckCircle2 className="text-green-600 flex-shrink-0" size={18} />
        <p className="text-sm text-green-800 font-medium">Email updated to {currentEmail}</p>
      </div>
    );
  }

  if (step === 'entering') {
    return (
      <div className="mt-2 p-4 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Mail size={16} className="text-primary" />
            Change Email Address
          </p>
          <button type="button" onClick={handleCancel} className="p-1 hover:bg-white rounded-lg transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">New Email Address</Label>
          <Input
            type="email"
            placeholder="new@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRequestChange()}
            className="h-10 text-sm"
          />
        </div>
        <Button
          type="button"
          onClick={handleRequestChange}
          disabled={isLoading}
          className="w-full h-10 text-sm"
        >
          {isLoading ? <><Loader2 className="animate-spin mr-2" size={16} />Sending Code...</> : 'Send Verification Code'}
        </Button>
      </div>
    );
  }

  // step === 'verifying'
  return (
    <div className="mt-2 p-4 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail size={16} className="text-primary" />
          Enter Verification Code
        </p>
        <button type="button" onClick={handleCancel} className="p-1 hover:bg-white rounded-lg transition-colors">
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        A 6-digit code was sent to <strong>{newEmail}</strong>. Enter it below to confirm the change.
      </p>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">6-Digit Code</Label>
        <Input
          type="text"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && handleVerifyChange()}
          className="h-10 text-center text-xl font-bold tracking-[0.4em]"
        />
      </div>
      <Button
        type="button"
        onClick={handleVerifyChange}
        disabled={isLoading || code.length !== 6}
        className="w-full h-10 text-sm"
      >
        {isLoading ? <><Loader2 className="animate-spin mr-2" size={16} />Verifying...</> : 'Confirm Email Change'}
      </Button>
      <button
        type="button"
        onClick={() => setStep('entering')}
        className="w-full text-xs text-primary hover:underline"
      >
        Use a different email
      </button>
    </div>
  );
}
