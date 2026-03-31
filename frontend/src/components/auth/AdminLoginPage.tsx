import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Shield, Loader2 } from 'lucide-react';
import RegisterLeftSection from './RegisterLeftSection';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { adminSecretSchema, AdminSecretFormValues } from '../../lib/validations';

interface AdminLoginPageProps {
  onLogin: (role: 'admin') => void;
  onCreateSubAdmin: () => void;
}

export default function AdminLoginPage({ onLogin, onCreateSubAdmin }: AdminLoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminSecretFormValues>({
    resolver: zodResolver(adminSecretSchema),
    mode: 'onChange',
  });

  const onSubmitForm = async (data: AdminSecretFormValues) => {
    setIsLoading(true);
    try {
      const userData = await authService.adminLogin(data.secretKey);
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
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white text-slate-900">
      <RegisterLeftSection />
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-white">
        <div className="w-full max-w-xl">
          <Card className="p-10 bg-white rounded-3xl shadow-2xl border border-slate-200">
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="text-[#1F3A8A]" size={32} />
                <h2 className="text-3xl font-bold text-slate-900">Admin Portal</h2>
              </div>
            <p className="text-slate-500 text-lg">Sign in with the shared admin key</p>
            </div>

            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
              <div className="space-y-2">
              <Label htmlFor="secretKey" className="text-slate-900 text-base">Admin Secret Key</Label>
                <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={20} />
                <Input
                  id="secretKey"
                  type="password"
                  placeholder="Enter admin secret key"
                  {...register('secretKey')}
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.secretKey ? 'border-red-500' : 'border-slate-300'} focus:border-[#1F3A8A] transition-colors bg-white text-slate-900`}
                  />
                </div>
              {errors.secretKey && <p className="text-sm text-destructive font-medium">{errors.secretKey.message}</p>}
              </div>

              <Button
                type="submit"
              disabled={isLoading}
                className="w-full h-14 text-base font-semibold !bg-blue-700 hover:!bg-blue-800 !text-white rounded-xl shadow-lg shadow-blue-700/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Unlock Admin Dashboard'
                )}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500 mb-2">Need to onboard a new admin?</p>
              <Button
                type="button"
                className="text-white font-semibold rounded-xl px-6"
                style={{ backgroundColor: '#1F3A8A' }}
                onClick={onCreateSubAdmin}
              >
                Create Sub-Admin Account
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
