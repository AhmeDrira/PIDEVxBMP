import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { PasswordInput } from '../ui/password-input';
import { Mail, Lock, User, Phone, Shield, Loader2 } from 'lucide-react';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { adminCreateSchema, AdminCreateFormValues } from '../../lib/validations';
import RegisterLeftSection from './RegisterLeftSection';

interface AdminCreatePageProps {
  onBackToLogin: () => void;
  onCreated: () => void;
}

export default function AdminCreatePage({ onBackToLogin, onCreated }: AdminCreatePageProps) {
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, setError, clearErrors, formState: { errors } } = useForm<AdminCreateFormValues>({
    resolver: zodResolver(adminCreateSchema),
    mode: 'onChange',
  });
  const adminEmailReg = register('email');
  const adminPhoneReg = register('phone');

  const onSubmitForm = async (data: AdminCreateFormValues) => {
    setIsLoading(true);
    try {
      const { confirmPassword, ...payload } = data;
      const userData = await authService.createAdmin(payload);
      if (userData && userData.role === 'admin') {
        toast.success('Admin created successfully');
        onCreated();
      } else {
        toast.error('Failed to create admin');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Admin creation failed';
      toast.error(message);
      if (message === 'Email already in use') setError('email', { message: 'Email already in use' });
      else if (message === 'Phone number already in use') setError('phone', { message: 'Phone number already in use' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Section - Background image (same as Create User Account page) */}
      <RegisterLeftSection />

      {/* Right Section - Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-background overflow-y-auto">
        <div className="w-full max-w-xl">
      <Card className="p-10 bg-white rounded-3xl shadow-2xl border-0">
        <div className="mb-8">
          <Button variant="ghost" onClick={onBackToLogin} className="mb-4 hover:bg-gray-50 rounded-xl">
            ← Back to Login
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="text-primary" size={28} />
            <h2 className="text-3xl font-bold text-foreground">Create Admin Account</h2>
          </div>
          <p className="text-muted-foreground text-lg mt-2">Requires secret key</p>
        </div>

        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-foreground text-base">First Name</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input id="firstName" type="text" placeholder="John" {...register('firstName')} className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.firstName ? 'border-red-500' : 'border-gray-200'} focus:border-primary`} />
              </div>
              {errors.firstName && <p className="text-sm text-destructive font-medium">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-foreground text-base">Last Name</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input id="lastName" type="text" placeholder="Doe" {...register('lastName')} className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.lastName ? 'border-red-500' : 'border-gray-200'} focus:border-primary`} />
              </div>
              {errors.lastName && <p className="text-sm text-destructive font-medium">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground text-base">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                ref={adminEmailReg.ref}
                name={adminEmailReg.name}
                onChange={adminEmailReg.onChange}
                onBlur={async (e) => {
                  adminEmailReg.onBlur(e);
                  const email = e.target.value?.trim();
                  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
                  const available = await authService.checkEmailAvailable(email);
                  if (!available) setError('email', { message: 'Email already in use' });
                  else clearErrors('email');
                }}
                className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.email ? 'border-red-500' : 'border-gray-200'} focus:border-primary`}
              />
            </div>
            {errors.email && <p className="text-sm text-destructive font-medium">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground text-base">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                id="phone"
                type="tel"
                placeholder="+216 XX XXX XXX"
                ref={adminPhoneReg.ref}
                name={adminPhoneReg.name}
                onChange={adminPhoneReg.onChange}
                onBlur={async (e) => {
                  adminPhoneReg.onBlur(e);
                  const phone = e.target.value?.trim();
                  if (!phone || phone.length < 8) return;
                  const available = await authService.checkPhoneAvailable(phone);
                  if (!available) setError('phone', { message: 'Phone number already in use' });
                  else clearErrors('phone');
                }}
                className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.phone ? 'border-red-500' : 'border-gray-200'} focus:border-primary`}
              />
            </div>
            {errors.phone && <p className="text-sm text-destructive font-medium">{errors.phone.message}</p>}
          </div>

            <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-base">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={20} />
                <PasswordInput id="password" placeholder="Create password" autoComplete="new-password" {...register('password')} error={!!errors.password} className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.password ? 'border-red-500' : 'border-gray-200'} focus:border-primary`} />
              </div>
              {errors.password && <p className="text-sm text-destructive font-medium">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground text-base">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={20} />
                <PasswordInput id="confirmPassword" placeholder="Confirm password" autoComplete="new-password" {...register('confirmPassword')} error={!!errors.confirmPassword} className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.confirmPassword ? 'border-red-500' : 'border-gray-200'} focus:border-primary`} />
              </div>
              {errors.confirmPassword && <p className="text-sm text-destructive font-medium">{errors.confirmPassword.message}</p>}
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25">
            {isLoading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />Creating Admin...</>) : ('Create Admin')}
          </Button>
        </form>
      </Card>
        </div>
      </div>
    </div>
  );
}
