import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { PasswordInput } from '../ui/password-input';
import { Mail, Lock, Shield, Loader2 } from 'lucide-react';
import RegisterLeftSection from './RegisterLeftSection';
import ReCAPTCHA from 'react-google-recaptcha';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { loginSchema, LoginFormValues } from '../../lib/validations';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

interface AdminLoginPageProps {
  onLogin: (role: 'admin') => void;
  onAdminCreate: () => void;
  onForgotPassword: () => void;
}

export default function AdminLoginPage({ onLogin, onAdminCreate, onForgotPassword }: AdminLoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmitForm = async (data: LoginFormValues) => {
    if (!captchaToken) {
      toast.error('Please complete the CAPTCHA verification.');
      return;
    }
    setIsLoading(true);
    try {
      const userData = await authService.login({ ...data, captchaToken });
      if (userData && userData.role === 'admin') {
        toast.success('Admin login successful!');
        onLogin('admin');
      } else {
        toast.error('Access denied. This portal is for administrators only.');
        authService.logout();
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message || 'Login failed. Please check your credentials.';
      toast.error(message);
    } finally {
      setIsLoading(false);
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <RegisterLeftSection />
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-background">
        <div className="w-full max-w-xl">
          <Card className="p-10 bg-white rounded-3xl shadow-2xl border-0">
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="text-primary" size={32} />
                <h2 className="text-3xl font-bold text-foreground">Admin Portal</h2>
              </div>
              <p className="text-muted-foreground text-lg">Sign in to manage the platform</p>
            </div>

            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground text-base">Admin Email</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    {...register('email')}
                    className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.email ? 'border-red-500' : 'border-gray-200'} focus:border-primary transition-colors bg-white`}
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive font-medium">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground text-base">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={20} />
                  <PasswordInput
                    id="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    {...register('password')}
                    error={!!errors.password}
                    className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.password ? 'border-red-500' : 'border-gray-200'} focus:border-primary transition-colors bg-white`}
                  />
                </div>
                {errors.password && <p className="text-sm text-destructive font-medium">{errors.password.message}</p>}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal text-primary hover:text-primary/80"
                  onClick={onForgotPassword}
                  type="button"
                >
                  Forgot password?
                </Button>
              </div>

              {/* reCAPTCHA */}
              <div className="flex justify-center">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={RECAPTCHA_SITE_KEY}
                  onChange={(token) => setCaptchaToken(token)}
                  onExpired={() => setCaptchaToken(null)}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !captchaToken}
                className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Sign In as Admin'
                )}
              </Button>

              <div className="text-center pt-4">
                <p className="text-muted-foreground">
                  Need to set up a new admin?{' '}
                  <button
                    type="button"
                    onClick={onAdminCreate}
                    className="font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Create Admin
                  </button>
                </p>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
