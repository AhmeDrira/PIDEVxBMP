import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import authService from '../../services/authService';

interface VerifyEmailPageProps {
  onBackToLogin: () => void;
}

export default function VerifyEmailPage({ onBackToLogin }: VerifyEmailPageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verify = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link.');
        return;
      }

      try {
        const response = await authService.verifyEmail(token);
        setStatus('success');
        setMessage(response.message || 'Email verified successfully!');
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Verification failed. The link may be expired.');
      }
    };

    verify();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <Card className="w-full max-w-md p-10 bg-card rounded-3xl shadow-2xl border-0 text-center">
        {status === 'loading' && (
          <div className="py-8 space-y-4">
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
            <h2 className="text-2xl font-bold text-foreground">Verifying Email...</h2>
            <p className="text-muted-foreground">Please wait while we verify your account.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-8 space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
              <CheckCircle size={40} className="text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground">Email Verified!</h2>
              <p className="text-muted-foreground text-lg">{message}</p>
            </div>
            <Button
              onClick={onBackToLogin}
              className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25"
            >
              Back to Login
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-8 space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100">
              <XCircle size={40} className="text-red-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground">Verification Failed</h2>
              <p className="text-muted-foreground text-lg">{message}</p>
            </div>
            <Button
              onClick={onBackToLogin}
              className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25"
            >
              Back to Login
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
