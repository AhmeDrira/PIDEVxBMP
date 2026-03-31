import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import Logo from '../common/Logo';
import authService from '../../services/authService';
import { forgotPasswordSchema, ForgotPasswordFormValues } from '../../lib/validations';

interface SubAdminForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export default function SubAdminForgotPasswordPage({ onBackToLogin }: SubAdminForgotPasswordPageProps) {
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setLoading(true);
    try {
      await authService.subAdminForgotPassword(data.email);
      setSubmittedEmail(data.email);
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

        <div className="mb-8">
          <Logo variant="dark" size="md" className="mb-6" />
          <h2 className="text-3xl font-bold text-foreground mb-3">
            {submittedEmail ? 'Request Sent' : 'Forgot Password?'}
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {submittedEmail
              ? `We notified the super admin. A temporary password will be sent to ${submittedEmail} once approved.`
              : 'Enter your work email to request a password reset.'}
          </p>
        </div>

        {!submittedEmail ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground text-base">Work Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
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
              className="w-full h-14 text-base font-semibold text-white rounded-xl shadow-lg transition-colors"
              style={{ backgroundColor: '#1F3A8A' }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                'Request Reset'
              )}
            </Button>
          </form>
        ) : (
          <div className="text-center py-4 space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
            <Button
              onClick={onBackToLogin}
              className="w-full h-14 text-base font-semibold text-white rounded-xl shadow-lg transition-colors"
              style={{ backgroundColor: '#1F3A8A' }}
            >
              Back to Sign In
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
