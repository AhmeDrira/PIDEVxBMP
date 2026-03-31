import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Mail, Lock, CheckCircle, Loader2, ArrowLeft, ShieldCheck, Phone, Smartphone } from 'lucide-react';
import { PasswordInput } from '../ui/password-input';
import authService from '../../services/authService';
import { resetPasswordSchema, ResetPasswordFormValues } from '../../lib/validations';
import Logo from '../common/Logo';
import { toast } from 'sonner';

interface ResetPasswordPageProps {
  onBackToLogin: () => void;
  token?: string | null;
}

export default function ResetPasswordPage({ onBackToLogin, token }: ResetPasswordPageProps) {
  const [resolvedToken, setResolvedToken] = useState<string | null>(token || null);
  const [smsEmail, setSmsEmail] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    const e = params.get('email');
    const c = params.get('code');
    
    if (t) setResolvedToken(t);
    if (e) setSmsEmail(e);
    if (c) setResolvedToken(c); // SMS code used as the reset token
  }, []);

  const onSubmitForm = async (data: ResetPasswordFormValues) => {
    if (!resolvedToken) return;
    setLoading(true);
    try {
      if (smsEmail) {
        // SMS Reset — look up by email, verify code
        await authService.resetPasswordPhone(smsEmail, resolvedToken, data.password);
      } else {
        // Email Reset
        await authService.resetPassword(resolvedToken, data.password);
      }
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ backgroundImage: "url('/construction-bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/60" />
      <Card className="w-full max-w-xl p-10 bg-card rounded-3xl shadow-2xl border-0 relative z-10">
        <button
          onClick={onBackToLogin}
          className="flex items-center gap-2 mb-8 text-primary hover:text-primary/80 transition-colors font-medium"
        >
          <ArrowLeft size={20} />
          Back to Login
        </button>

        <div className="mb-10">
          <Logo variant="dark" size="md" className="mb-6" />
          {!submitted ? (
            <>
              <h2 className="text-3xl font-bold text-foreground mb-3">Set New Password</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Create a strong, secure password to protect your account.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-foreground mb-3">Password Updated</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Your password has been changed successfully.
              </p>
            </>
          )}
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-base">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={20} />
                <PasswordInput
                  id="password"
                  placeholder="Enter a strong password"
                  autoComplete="new-password"
                  {...register('password')}
                  error={!!errors.password}
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.password ? 'border-red-500' : 'border-border'} focus:border-primary transition-colors bg-card`}
                />
              </div>
              {errors.password && <p className="text-sm text-destructive font-medium">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground text-base">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={20} />
                <PasswordInput
                  id="confirmPassword"
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  error={!!errors.confirmPassword}
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.confirmPassword ? 'border-red-500' : 'border-border'} focus:border-primary transition-colors bg-card`}
                />
              </div>
              {errors.confirmPassword && <p className="text-sm text-destructive font-medium">{errors.confirmPassword.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading || !resolvedToken}
              className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        ) : (
          <div className="text-center py-4 space-y-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
              <ShieldCheck size={40} className="text-green-600" />
            </div>
            <Button
              onClick={onBackToLogin}
              className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Sign In Now
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

