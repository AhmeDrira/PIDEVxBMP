import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { PasswordInput } from '../ui/password-input';
import { Mail, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import Logo from '../common/Logo';
import ReCAPTCHA from 'react-google-recaptcha';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { loginSchema, LoginFormValues } from '../../lib/validations';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin';

interface LoginPageProps {
  onLogin: (role: UserRole, isPending?: boolean) => void;
  onRegister: () => void;
  onForgotPassword: () => void;
  onAdminCreate: () => void;
  allowAdminCreate: boolean;
}

export default function LoginPage({ onLogin, onRegister, onForgotPassword, onAdminCreate, allowAdminCreate }: LoginPageProps) {
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
      
      if (userData && userData.role) {
        toast.success('Login successful!');
        onLogin(userData.role as UserRole);
      } else {
        toast.error('Invalid user data received');
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message || 'Login failed. Please check your credentials.';
      
      if (error.response?.status === 403 && error.response?.data?.isPendingManufacturer) {
        toast.info('Your application is still being reviewed.');
        onLogin('manufacturer', true); 
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
      // Reset CAPTCHA after each attempt
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
    }
  };

  const features = [
    {
      icon: <CheckCircle2 size={24} />,
      title: 'Project Management',
      description: 'Track and manage all your construction projects in one place'
    },
    {
      icon: <CheckCircle2 size={24} />,
      title: 'Marketplace',
      description: 'Access quality materials from verified manufacturers'
    },
    {
      icon: <CheckCircle2 size={24} />,
      title: 'Expert Network',
      description: 'Connect with construction experts and professionals'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left side - Premium Branding */}
      <div className="lg:w-1/2 relative overflow-hidden bg-primary">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1693679758394-6d56a1e5c1a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwbW9kZXJuJTIwYnVpbGRpbmd8ZW58MXx8fHwxNzcwNTc2NzAyfDA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Construction"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/90 to-primary/95" />
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-center px-8 lg:px-16 py-16 text-white">
          <div className="max-w-lg">
            {/* Logo and Title */}
            <Logo variant="light" size="lg" />

            {/* Headline */}
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-white leading-tight">
              Build Better, Faster, Together
            </h2>
            <p className="text-xl text-white/90 mb-12 leading-relaxed">
              The complete platform for construction professionals to manage projects, connect with experts, and access quality materials.
            </p>

            {/* Features */}
            <div className="space-y-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 shadow-lg">
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white mb-1">{feature.title}</h4>
                    <p className="text-white/80 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8">
              <div>
                <p className="text-4xl font-bold text-white mb-1">500+</p>
                <p className="text-white/70">Active Users</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-white mb-1">1.2K</p>
                <p className="text-white/70">Projects</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-white mb-1">98%</p>
                <p className="text-white/70">Satisfaction</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Modern Login Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-background">
        <div className="w-full max-w-xl">
          <Card className="p-10 bg-white rounded-3xl shadow-2xl border-0">
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-foreground mb-3">Welcome Back</h2>
              <p className="text-muted-foreground text-lg">Sign in to continue to your account</p>
            </div>

            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground text-base">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
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

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">Remember me</span>
                </label>
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
                className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="text-center pt-4 space-y-2">
                <p className="text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={onRegister}
                    className="font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Create Account
                  </button>
                </p>
                {/* Admin setup link removed from here */}
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
