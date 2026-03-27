import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import RegisterLeftSection from './RegisterLeftSection';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ShieldCheck, Loader2, Mail, Lock } from 'lucide-react';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { loginSchema, LoginFormValues } from '../../lib/validations';

interface SubAdminLoginPageProps {
  onLogin: (role: 'admin') => void;
  onForgotPassword: () => void;
}

export default function SubAdminLoginPage({ onLogin, onForgotPassword }: SubAdminLoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const handleLoginSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const user = await authService.login(values);
      const adminType = (user?.adminType ?? '').toString().toLowerCase();
      const isSubAdmin = user?.role === 'admin' && (adminType === 'sub' || adminType === '');
      if (isSubAdmin) {
        toast.success('Welcome back!');
        onLogin('admin');
      } else {
        toast.error('This portal is reserved for sub-admin accounts.');
        authService.logout();
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Unable to sign in. Please check your credentials.';
      toast.error(message);
    } finally {
      setIsLoading(false);
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
                <ShieldCheck className="text-primary" size={32} />
                <h2 className="text-3xl font-bold text-foreground">Sub-Admin Sign In</h2>
              </div>
              <p className="text-muted-foreground text-lg">Use your work email and password to access the admin tools.</p>
            </div>

            <form onSubmit={handleSubmit(handleLoginSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@bmp.tn"
                    {...register('email')}
                    className={`pl-12 h-14 rounded-xl border-2 transition-colors ${
                      errors.email
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-200 hover:border-[#1F3A8A] focus:border-[#1F3A8A]'
                    }`}
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    {...register('password')}
                    className={`pl-12 h-14 rounded-xl border-2 transition-colors ${
                      errors.password
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-200 hover:border-[#1F3A8A] focus:border-[#1F3A8A]'
                    }`}
                  />
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 text-base font-semibold text-white rounded-xl shadow-lg bg-[#1F3A8A] hover:bg-[#172c6e] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1F3A8A] transition-colors"
                style={{ backgroundColor: '#1F3A8A' }}
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
              <button
                type="button"
                onClick={onForgotPassword}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
