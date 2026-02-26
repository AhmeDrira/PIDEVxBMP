import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { HardHat, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import authService from '../../services/authService';
import { forgotPasswordSchema, ForgotPasswordFormValues } from '../../lib/validations';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export default function ForgotPasswordPage({ onBackToLogin }: ForgotPasswordPageProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
  });
  const email = watch('email', '');

  const onSubmitForm = (data: ForgotPasswordFormValues) => {
    setLoading(true);
    authService
      .forgotPassword(data.email)
      .then(() => setSubmitted(true))
      .catch(() => setSubmitted(true))
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <Card className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg">
        <button
          onClick={onBackToLogin}
          className="flex items-center gap-2 mb-6 hover:opacity-80 text-primary"
        >
          <ArrowLeft size={20} />
          Back to Login
        </button>

        <div className="flex items-center gap-3 mb-6">
          <HardHat size={36} className="text-primary" />
          <h1 className="text-2xl text-foreground">BMP.tn</h1>
        </div>

        {!submitted ? (
          <>
            <h2 className="text-2xl mb-2 text-foreground">Reset Password</h2>
            <p className="mb-6 text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    {...register('email')}
                    className={`pl-10 ${errors.email ? 'border-red-500 border-2' : ''}`}
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive font-medium">{errors.email.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full text-white"
                style={{ backgroundColor: '#1F3A8A' }}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-green-100">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h2 className="text-2xl mb-2 text-foreground">Check Your Email</h2>
            <p className="mb-6 text-muted-foreground">
              We've sent a password reset link to <strong>{email}</strong>
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
