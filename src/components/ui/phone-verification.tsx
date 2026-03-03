import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Phone, CheckCircle2, Loader2, X, Send } from 'lucide-react';
import authService from '../../services/authService';
import { toast } from 'sonner';

interface PhoneVerificationProps {
  initialPhone: string;
  isVerified: boolean;
  onVerified: (phone: string) => void;
}

export function PhoneVerification({ initialPhone, isVerified, onVerified }: PhoneVerificationProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'input' | 'verify'>(isVerified ? 'verify' : 'input');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!phone || phone.length < 8) {
      toast.error('Please enter a valid phone number');
      return;
    }
    setIsLoading(true);
    try {
      const result = await authService.sendPhoneVerification(phone);
      if (result?._devCode) {
        // Dev mode: auto-fill the code and show it to the developer
        setCode(result._devCode);
        toast.info(`[DEV] SMS not sent — code: ${result._devCode}`, { duration: 15000 });
      } else {
        toast.success('Verification code sent to ' + phone);
      }
      setStep('verify');
      setCountdown(60);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    setIsLoading(true);
    try {
      await authService.verifyPhone(code);
      toast.success('Phone number verified successfully!');
      onVerified(phone);
      setStep('verify');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid or expired code');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerified && step === 'verify') {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="text-green-600" size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-900">Phone Verified</p>
          <p className="text-xs text-green-700">{phone}</p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setStep('input')}
          className="text-green-700 hover:bg-green-100"
        >
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
      <div className="flex items-center gap-2 mb-2">
        <Phone size={18} className="text-primary" />
        <h4 className="font-semibold text-foreground">Phone Verification</h4>
      </div>

      {step === 'input' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="phone-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Phone Number
            </Label>
            <div className="flex gap-2">
              <Input
                id="phone-input"
                type="tel"
                placeholder="+216 XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 text-base rounded-xl border-2 border-gray-200 focus:border-primary"
              />
              <Button 
                onClick={handleSendCode} 
                disabled={isLoading || countdown > 0}
                className="h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 shadow-md shadow-primary/20"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (countdown > 0 ? countdown : <Send size={20} />)}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            We'll send a 6-digit verification code via SMS.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="code-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                6-Digit Code
              </Label>
              <button 
                type="button"
                onClick={() => setStep('input')}
                className="text-xs text-primary hover:underline font-medium bg-transparent border-0 p-0 m-0"
              >
                Change Number
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                id="code-input"
                type="text"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="h-12 text-center text-xl font-bold tracking-[0.5em] rounded-xl border-2 border-gray-200 focus:border-primary"
              />
              <Button 
                onClick={handleVerifyCode} 
                disabled={isLoading || code.length !== 6}
                className="h-12 px-6 rounded-xl bg-green-600 hover:bg-green-700 shadow-md shadow-green-200"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Verify'}
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Sent to {phone}
            </p>
            <button 
              type="button"
              onClick={handleSendCode}
              disabled={countdown > 0}
              className="text-xs text-primary hover:underline font-medium disabled:text-muted-foreground disabled:no-underline bg-transparent border-0 p-0 m-0"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
