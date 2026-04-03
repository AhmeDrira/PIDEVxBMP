import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Mail, ArrowLeft, CheckCircle, Loader2, Phone, Smartphone } from 'lucide-react';
import authService from '../../services/authService';
import { forgotPasswordSchema, ForgotPasswordFormValues } from '../../lib/validations';
import Logo from '../common/Logo';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
  initialEmail?: string;
}

// Step 1: enter email → Step 2: choose method (email always available, SMS only if phone is verified)
type Step = 'email-input' | 'method-choice' | 'sms-verify' | 'done';

export default function ForgotPasswordPage({ onBackToLogin, initialEmail }: ForgotPasswordPageProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  const [step, setStep] = useState<Step>('email-input');
  const [loading, setLoading] = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState(initialEmail || '');
  const [hasVerifiedPhone, setHasVerifiedPhone] = useState(false);
  const [smsCode, setSmsCode] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
    defaultValues: { email: initialEmail || '' },
  });

  // If email was passed from login page, auto-check options on mount
  const checkOptions = async (email: string) => {
    setLoading(true);
    try {
      const options = await authService.checkResetOptions(email);
      setResolvedEmail(email);
      setHasVerifiedPhone(options.hasVerifiedPhone);
      if (options.hasVerifiedPhone) {
        setStep('method-choice');
      } else {
        await authService.forgotPassword(email);
        setStep('done');
      }
    } catch {
      setResolvedEmail(email);
      setStep('done');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (initialEmail) checkOptions(initialEmail); }, []);

  // Step 1: User submits their email — check what methods are available
  const onSubmitEmail = async (data: ForgotPasswordFormValues) => checkOptions(data.email);

  const handleChooseEmail = async () => {
    setLoading(true);
    try {
      await authService.forgotPassword(resolvedEmail);
      setStep('done');
    } catch {
      setStep('done');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseSms = async () => {
    setLoading(true);
    try {
      // Use the phone tied to the user's account (backend looks up by email)
      const result = await authService.forgotPasswordPhone(resolvedEmail);
      if (result?._devCode) {
        setSmsCode(result._devCode);
        toast.info(`[DEV] SMS not sent — code: ${result._devCode}`, { duration: 15000 });
      } else {
        toast.success('Reset code sent to your verified phone');
      }
      setStep('sms-verify');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySmsCode = () => {
    if (smsCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    window.location.href = `/?email=${encodeURIComponent(resolvedEmail)}&code=${encodeURIComponent(smsCode)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ backgroundImage: "url('/construction-bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/60" />
      <Card className="w-full max-w-xl p-10 bg-card rounded-3xl shadow-2xl border-0 relative z-10">
        <button
          onClick={step === 'method-choice' ? () => setStep('email-input') : onBackToLogin}
          className="flex items-center gap-2 mb-8 text-primary hover:text-primary/80 transition-colors font-medium"
        >
          <ArrowLeft size={20} />
          {step === 'method-choice' ? 'Change Email' : 'Back to Login'}
        </button>

        <div className="mb-8">
          <Logo variant="dark" size="md" className="mb-6" />
          <h2 className="text-3xl font-bold text-foreground mb-3">
            {step === 'done' ? 'Check Your Email' : 'Forgot Password?'}
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {step === 'email-input' && (initialEmail ? 'Loading your reset options...' : "Enter your registered email and we'll take care of the rest.")}
            {step === 'method-choice' && `How would you like to reset the password for ${resolvedEmail}?`}
            {step === 'sms-verify' && 'Enter the 6-digit code sent to your verified phone.'}
            {step === 'done' && `Check your inbox — a reset link has been sent to ${resolvedEmail}.`}
          </p>
        </div>

        {/* Step 1: Enter email */}
        {step === 'email-input' && (
          <form onSubmit={handleSubmit(onSubmitEmail)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground text-base">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  autoComplete="email"
                  {...register('email')}
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.email ? 'border-red-500' : 'border-border'} focus:border-primary transition-colors bg-card`}
                />
              </div>
              {errors.email && <p className="text-sm text-destructive font-medium">{errors.email.message}</p>}
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Checking...</> : 'Continue'}
            </Button>
          </form>
        )}

        {/* Step 2: Choose method (only shown when phone is verified) */}
        {step === 'method-choice' && (
          <div className="space-y-4">
            <button
              onClick={handleChooseEmail}
              disabled={loading}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <Mail size={22} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Send reset link by email</p>
                <p className="text-sm text-muted-foreground">We'll send a link to {resolvedEmail}</p>
              </div>
            </button>

            <button
              onClick={handleChooseSms}
              disabled={loading}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <Smartphone size={22} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Send code via SMS</p>
                <p className="text-sm text-muted-foreground">We'll send a 6-digit code to your verified phone</p>
              </div>
            </button>

            {loading && (
              <div className="flex justify-center pt-2">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            )}
          </div>
        )}

        {/* Step 2b: SMS code verification */}
        {step === 'sms-verify' && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <Label htmlFor="smsCode" className="text-foreground text-base">Enter 6-Digit Code</Label>
              <Input
                id="smsCode"
                type="text"
                maxLength={6}
                placeholder="000000"
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
                className="h-14 text-center text-2xl font-bold tracking-[0.5em] rounded-xl border-2 border-border focus:border-primary"
              />
            </div>
            <Button
              onClick={handleVerifySmsCode}
              className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Verify & Continue
            </Button>
            <button
              onClick={() => setStep('method-choice')}
              className="w-full text-sm text-primary hover:underline"
            >
              Go back
            </button>
          </div>
        )}

        {/* Done state */}
        {step === 'done' && (
          <div className="text-center py-4 space-y-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
              <CheckCircle size={40} className="text-green-600" />
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground text-lg leading-relaxed">
                If <span className="font-semibold text-foreground">{resolvedEmail}</span> is registered, you'll receive a reset link shortly.
              </p>
              <Button
                onClick={onBackToLogin}
                className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Back to Login
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
