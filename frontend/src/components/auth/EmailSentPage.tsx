import React from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Logo from '../common/Logo';

interface EmailSentPageProps {
  email: string;
  onBackToLogin: () => void;
}

export default function EmailSentPage({ email, onBackToLogin }: EmailSentPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ backgroundImage: "url('/construction-bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/60" />
      <Card className="w-full max-w-xl p-10 bg-card rounded-3xl shadow-2xl border-0 text-center relative z-10">
        <div className="mb-10">
          <Logo variant="dark" size="md" className="mx-auto mb-8" />
          
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/5 mb-8 relative">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
            <Mail size={48} className="text-primary relative z-10" />
            <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5 border-4 border-white">
              <CheckCircle2 size={16} className="text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-foreground mb-4">Verify Your Email</h2>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
            We've sent a verification link to <br />
            <span className="font-semibold text-foreground">{email}</span>
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-muted/50 rounded-2xl text-left space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              Next Steps:
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4">
              <li>Check your inbox and spam folder</li>
              <li>Click the verification link in the email</li>
              <li>Once verified, you can sign in to your account</li>
            </ul>
          </div>

          <Button
            onClick={onBackToLogin}
            className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Back to Login
          </Button>

          <p className="text-sm text-muted-foreground">
            Didn't receive the email?{' '}
            <button className="text-primary font-semibold hover:underline">
              Resend verification link
            </button>
          </p>
        </div>
      </Card>
    </div>
  );
}
