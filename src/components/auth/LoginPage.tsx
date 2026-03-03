import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { PasswordInput } from '../ui/password-input';
import { Mail, Lock, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import Logo from '../common/Logo';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { loginSchema, LoginFormValues } from '../../lib/validations';
import { GoogleLoginButton } from './GoogleLoginButton';

type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin';

interface LoginPageProps {
  onLogin: (role: UserRole, isPending?: boolean) => void;
  onRegister: () => void;
  onForgotPassword: (email?: string) => void;
}

export default function LoginPage({ onLogin, onRegister, onForgotPassword }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmitForm = async (data: LoginFormValues) => {
    setIsLoading(true);
    
    try {
      const userData = await authService.login(data);
      
      if (userData && userData.role) {
        toast.success('Login successful!');
        onLogin(userData.role as UserRole);
      } else {
        toast.error('Invalid user data received');
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message || 'Login failed. Please check your credentials.';
      
      if (error.response?.status === 403 && error.response?.data?.notVerified) {
        toast.error('Please verify your email before logging in.');
      } else if (error.response?.status === 403 && error.response?.data?.isPendingManufacturer) {
        toast.info('Your application is still being reviewed.');
        onLogin('manufacturer', true); 
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
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
      <div className="lg:w-1/2 flex items-start lg:items-center justify-center p-8 lg:p-12 bg-background overflow-y-auto min-h-screen lg:min-h-0">
        <div className="w-full max-w-xl py-6 lg:py-0">
          <Card className="p-8 bg-white rounded-3xl shadow-2xl border-0">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-foreground mb-3">Welcome Back</h2>
              <p className="text-muted-foreground text-lg">Sign in to continue to your account</p>
            </div>

            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
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
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center shrink-0">
                    <input
                      type="checkbox"
                      className="peer appearance-none w-6 h-6 rounded-lg border-2 border-gray-200 checked:border-primary checked:bg-primary transition-all duration-200 cursor-pointer"
                    />
                    <Check
                      size={14}
                      strokeWidth={3}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none"
                    />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Remember me</span>
                </label>
                <Button
                  variant="link"
                  className="p-0 h-auto font-normal text-primary hover:text-primary/80"
                  onClick={() => onForgotPassword(watch('email'))}
                  type="button"
                >
                  Forgot password?
                </Button>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
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

              <div className="relative py-2">
                <div className="border-t border-gray-200" />
                <div className="absolute inset-0 flex justify-center">
                  <span className="px-3 text-xs font-semibold text-muted-foreground bg-white uppercase tracking-[0.18em] -mt-3">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <GoogleLoginButton
                  onSuccess={(userData) => {
                    if (userData && userData.role) {
                      onLogin(userData.role as UserRole, userData.isPendingManufacturer);
                    } else {
                      toast.error('Google login succeeded but user data was incomplete.');
                    }
                  }}
                />
              </div>

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
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
