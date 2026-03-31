import { useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { PasswordInput } from '../ui/password-input';
import { Mail, Lock, User, Phone, Upload, MapPin, Briefcase, Loader2 } from 'lucide-react';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { getRegisterSchema, RegisterFormValues } from '../../lib/validations';
import { GoogleLoginButton } from './GoogleLoginButton';


type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin';

interface RegisterFormProps {
  selectedRole: UserRole;
  onSubmit: (role: UserRole, isPending?: boolean, email?: string) => void;
  onBackToRoleSelection: () => void;
  onBackToLogin: () => void;
}

export default function RegisterForm({ selectedRole, onSubmit, onBackToRoleSelection, onBackToLogin }: RegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [certificationFile, setCertificationFile] = useState<File | null>(null);
  const certFileRef = useRef<HTMLInputElement>(null);

  const registerSchema = useMemo(() => getRegisterSchema(selectedRole), [selectedRole]);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  });

  const emailReg = register('email');
  const phoneReg = register('phone');

  const onSubmitForm = async (data: RegisterFormValues) => {
    setIsLoading(true);

    try {
      let response;

      if (selectedRole === 'manufacturer') {
        const formData = new FormData();
        formData.append('firstName', data.firstName);
        formData.append('lastName', data.lastName);
        formData.append('email', data.email);
        formData.append('password', data.password);
        formData.append('role', selectedRole);
        if (certificationFile) formData.append('certificationFile', certificationFile);
        response = await authService.register(formData);
      } else {
        const payload: any = {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
          role: selectedRole,
        };
        response = await authService.register(payload);
      }
      
      if (response) {
        toast.success(response.message || 'Registration successful! Please verify your email.');
        onSubmit(selectedRole, false, data.email);
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(message);
      if (message === 'Email already in use') setError('email', { message: 'Email already in use' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl">
      <Card className="p-10 bg-card rounded-3xl shadow-2xl border-0">
        <div className="mb-8">
          <Button variant="ghost" onClick={onBackToRoleSelection} className="mb-4 hover:bg-muted/50 rounded-xl">
            ← Change Role
          </Button>
          <h2 className="text-3xl font-bold text-foreground mb-3">Create Your Account</h2>
          <p className="text-muted-foreground text-lg">Fill in your details to get started</p>
        </div>

        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-foreground text-base">First Name</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  {...register('firstName')}
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.firstName ? 'border-red-500' : 'border-border'} focus:border-primary`}
                />
              </div>
              {errors.firstName && <p className="text-sm text-destructive font-medium">{errors.firstName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-foreground text-base">Last Name</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  {...register('lastName')}
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.lastName ? 'border-red-500' : 'border-border'} focus:border-primary`}
                />
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
                placeholder="john@example.com"
                ref={emailReg.ref}
                name={emailReg.name}
                onChange={emailReg.onChange}
                onBlur={async (e) => {
                  emailReg.onBlur(e);
                  const email = e.target.value?.trim();
                  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
                  const available = await authService.checkEmailAvailable(email);
                  if (!available) setError('email', { message: 'Email already in use' });
                  else clearErrors('email');
                }}
                className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.email ? 'border-red-500' : 'border-border'} focus:border-primary`}
              />
            </div>
            {errors.email && <p className="text-sm text-destructive font-medium">{errors.email.message}</p>}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-base">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <PasswordInput
                  id="password"
                  placeholder="Create password"
                  autoComplete="new-password"
                  {...register('password')}
                  error={!!errors.password}
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.password ? 'border-red-500' : 'border-border'} focus:border-primary`}
                />
              </div>
              {errors.password && <p className="text-sm text-destructive font-medium">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground text-base">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <PasswordInput
                  id="confirmPassword"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  error={!!errors.confirmPassword}
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.confirmPassword ? 'border-red-500' : 'border-border'} focus:border-primary`}
                />
              </div>
              {errors.confirmPassword && <p className="text-sm text-destructive font-medium">{errors.confirmPassword.message}</p>}
            </div>
          </div>

          {selectedRole === 'manufacturer' && (
            <div className="space-y-2">
              <Label className="text-foreground text-base">
                Certification Document <span className="text-red-500">*</span>
              </Label>
              <div
                onClick={() => certFileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors bg-muted/50"
              >
                <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {certificationFile ? certificationFile.name : 'Click to upload certification PDF'}
                </p>
                <input
                  type="file"
                  ref={certFileRef}
                  onChange={(e) => setCertificationFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                />
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
            <input type="checkbox" id="terms" required className="mt-1 w-5 h-5 rounded border-border" />
            <label htmlFor="terms" className="text-sm text-muted-foreground">
              I agree to the <a href="#" className="text-primary font-semibold hover:underline">Terms of Service</a> and <a href="#" className="text-primary font-semibold hover:underline">Privacy Policy</a>
            </label>
          </div>

          <div className="relative py-2">
            <div className="border-t border-border" />
            <div className="absolute inset-0 flex justify-center">
              <span className="px-3 text-xs font-semibold text-muted-foreground bg-card uppercase tracking-[0.18em] -mt-3">
                Or create account with Google
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <GoogleLoginButton
              variant="signup"
              role={selectedRole}
              onSuccess={(userData) => {
                if (userData?.role) onSubmit(userData.role as UserRole, false);
              }}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>

          <div className="text-center pt-2">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onBackToLogin}
                className="font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Sign In
              </button>
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
