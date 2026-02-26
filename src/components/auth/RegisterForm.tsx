import { useState, useMemo } from 'react';
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

type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin';

interface RegisterFormProps {
  selectedRole: UserRole;
  onSubmit: (role: UserRole, isPending?: boolean) => void;
  onBackToRoleSelection: () => void;
  onBackToLogin: () => void;
}

export default function RegisterForm({ selectedRole, onSubmit, onBackToRoleSelection, onBackToLogin }: RegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [certificationFile, setCertificationFile] = useState<File | null>(null);

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
      const payload: any = {
        ...data,
        role: selectedRole,
        certificationFile,
        yearsExperience: data.yearsExperience ? parseInt(data.yearsExperience) : undefined,
      };

      const userData = await authService.register(payload);
      
      if (userData) {
        if (selectedRole === 'manufacturer') {
          toast.success('Application submitted! We will verify your status.');
          onSubmit('manufacturer', true); 
        } else {
          toast.success('Registration successful! Welcome aboard.');
          onSubmit(selectedRole);
        }
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(message);
      if (message === 'Email already in use') setError('email', { message: 'Email already in use' });
      else if (message === 'Phone number already in use') setError('phone', { message: 'Phone number already in use' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl">
      <Card className="p-10 bg-white rounded-3xl shadow-2xl border-0">
        <div className="mb-8">
          <Button variant="ghost" onClick={onBackToRoleSelection} className="mb-4 hover:bg-gray-50 rounded-xl">
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
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.firstName ? 'border-red-500' : 'border-gray-200'} focus:border-primary`}
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
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.lastName ? 'border-red-500' : 'border-gray-200'} focus:border-primary`}
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
                ref={phoneReg.ref}
                name={phoneReg.name}
                onChange={phoneReg.onChange}
                onBlur={async (e) => {
                  phoneReg.onBlur(e);
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

          {/* Artisan specific fields */}
          {selectedRole === 'artisan' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-foreground text-base">Location *</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="location"
                    type="text"
                    placeholder="City, Region"
                    {...register('location')}
                    className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.location ? 'border-red-500' : 'border-gray-200'} focus:border-primary`}
                  />
                </div>
                {errors.location && <p className="text-sm text-destructive font-medium">{errors.location.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain" className="text-foreground text-base">Domain *</Label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="domain"
                    type="text"
                    placeholder="e.g., General Construction, Electrical, Plumbing"
                    {...register('domain')}
                    className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.domain ? 'border-red-500' : 'border-gray-200'} focus:border-primary`}
                  />
                </div>
                {errors.domain && <p className="text-sm text-destructive font-medium">{errors.domain.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearsExperience" className="text-foreground text-base">Years of Experience (Optional)</Label>
                <Input
                  id="yearsExperience"
                  type="number"
                  placeholder="e.g., 5"
                  {...register('yearsExperience')}
                  className="h-14 text-base rounded-xl border-2 border-gray-200 focus:border-primary"
                />
              </div>

            {/* Artisan Role Description Card removed */}
            </>
          )}

          {/* Expert specific fields */}
          {selectedRole === 'expert' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="domain" className="text-foreground text-base">Domain *</Label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="domain"
                    type="text"
                    placeholder="e.g., Structural Engineering, Architecture"
                    {...register('domain')}
                    className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.domain ? 'border-red-500' : 'border-gray-200'} focus:border-primary`}
                  />
                </div>
                {errors.domain && <p className="text-sm text-destructive font-medium">{errors.domain.message}</p>}
              </div>

              {/* Expert Role Description Card removed */}
            </>
          )}

          {/* Manufacturer specific fields */}
          {selectedRole === 'manufacturer' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-foreground text-base">Company Name *</Label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Your Company Name"
                    {...register('companyName')}
                    className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.companyName ? 'border-red-500' : 'border-gray-200'} focus:border-primary`}
                  />
                </div>
                {errors.companyName && <p className="text-sm text-destructive font-medium">{errors.companyName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-foreground text-base">Certification Document</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-primary transition-colors bg-gray-50">
                  <Upload size={36} className="mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground mb-2">
                    {certificationFile?.name ?? 'Upload your business certification'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">PDF, DOC, or DOCX (Max 10MB)</p>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setCertificationFile(e.target.files?.[0] || null)}
                    className="max-w-xs mx-auto"
                  />
                </div>
              </div>

              {/* Manufacturer Role Description Card removed */}
            </>
          )}

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
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.password ? 'border-red-500' : 'border-gray-200'} focus:border-primary`}
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
                  className={`pl-12 h-14 text-base rounded-xl border-2 ${errors.confirmPassword ? 'border-red-500' : 'border-gray-200'} focus:border-primary`}
                />
              </div>
              {errors.confirmPassword && <p className="text-sm text-destructive font-medium">{errors.confirmPassword.message}</p>}
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50">
            <input type="checkbox" id="terms" required className="mt-1 w-5 h-5 rounded border-gray-300" />
            <label htmlFor="terms" className="text-sm text-muted-foreground">
              I agree to the <a href="#" className="text-primary font-semibold hover:underline">Terms of Service</a> and <a href="#" className="text-primary font-semibold hover:underline">Privacy Policy</a>
            </label>
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
