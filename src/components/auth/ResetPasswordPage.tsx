import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Lock, CheckCircle } from 'lucide-react';
import { PasswordInput } from '../ui/password-input';
import authService from '../../services/authService';
import { resetPasswordSchema, ResetPasswordFormValues } from '../../lib/validations';

interface ResetPasswordPageProps {
  onBackToLogin: () => void;
  token?: string | null;
}

export default function ResetPasswordPage({ onBackToLogin, token }: ResetPasswordPageProps) {
  const [resolvedToken, setResolvedToken] = useState<string | null>(token || null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (!resolvedToken) {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('token');
      setResolvedToken(t);
    }
  }, [resolvedToken]);

  const onSubmitForm = async (data: ResetPasswordFormValues) => {
    if (!resolvedToken) return;
    setLoading(true);
    try {
      await authService.resetPassword(resolvedToken, data.password);
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <Card className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg">
        {!submitted ? (
          <>
            <h2 className="text-2xl mb-2 text-foreground">Set a New Password</h2>
            <p className="mb-6 text-muted-foreground">
              Enter and confirm your new password.
            </p>
            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={20} />
                  <PasswordInput
                    id="password"
                    placeholder="Enter a strong password"
                    autoComplete="new-password"
                    {...register('password')}
                    error={!!errors.password}
                    className={`pl-10 ${errors.password ? 'border-red-500 border-2' : ''}`}
                  />
                </div>
                {errors.password && <p className="text-sm text-destructive font-medium">{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={20} />
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    {...register('confirmPassword')}
                    error={!!errors.confirmPassword}
                    className={`pl-10 ${errors.confirmPassword ? 'border-red-500 border-2' : ''}`}
                  />
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive font-medium">{errors.confirmPassword.message}</p>}
              </div>
              <Button
                type="submit"
                className="w-full text-white"
                style={{ backgroundColor: '#1F3A8A' }}
                disabled={loading || !resolvedToken}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-green-100">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h2 className="text-2xl mb-2 text-foreground">Password Updated</h2>
            <p className="mb-6 text-muted-foreground">
              Your password has been reset successfully.
            </p>
            <Button
              onClick={onBackToLogin}
              className="text-white bg-primary"
            >
              Back to Login
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
