import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import RegisterLeftSection from './RegisterLeftSection';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { ShieldCheck, Loader2 } from 'lucide-react';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { subAdminSchema, SubAdminFormValues } from '../../lib/validations';

interface SubAdminRegisterPageProps {
  onBackToAdminLogin: () => void;
  onEmailSent: (email: string) => void;
}

const defaultPermissions = {
  canVerifyManufacturers: true,
  canManageKnowledge: true,
  canSuspendUsers: false,
  canDeleteUsers: false,
};

export default function SubAdminRegisterPage({ onBackToAdminLogin, onEmailSent }: SubAdminRegisterPageProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SubAdminFormValues>({
    resolver: zodResolver(subAdminSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      secretKey: '',
      permissions: defaultPermissions,
    },
  });

  const onSubmit = async (values: SubAdminFormValues) => {
    setIsSubmitting(true);
    try {
      await authService.createSubAdmin({
        secretKey: values.secretKey,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        permissions: values.permissions,
      });
      toast.success('Sub-admin created. Verification email sent.');
      reset({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        secretKey: '',
        permissions: defaultPermissions,
      });
      onEmailSent(values.email);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Unable to create sub-admin. Please verify the secret key and try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const permissionOptions = [
    {
      id: 'canVerifyManufacturers' as const,
      title: 'Manufacturer Verification',
      description: 'Review and approve manufacturer applications',
    },
    {
      id: 'canManageKnowledge' as const,
      title: 'Knowledge Library',
      description: 'Publish and manage knowledge articles',
    },
    {
      id: 'canSuspendUsers' as const,
      title: 'Suspend Users',
      description: 'Pause accounts that violate policies',
    },
    {
      id: 'canDeleteUsers' as const,
      title: 'Delete Users',
      description: 'Permanently remove accounts (use sparingly)',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <RegisterLeftSection />

      <div className="lg:w-1/2 flex items-start lg:items-center justify-center p-8 lg:p-12 bg-background overflow-y-auto min-h-screen lg:min-h-0">
        <div className="w-full max-w-3xl py-6">
          <Button
            variant="ghost"
            className="mb-6 text-muted-foreground hover:text-primary"
            onClick={onBackToAdminLogin}
          >
            ← Back to Admin Portal
          </Button>

          <Card className="p-10 bg-white rounded-3xl shadow-2xl border-0">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="text-primary" size={32} />
                <h2 className="text-3xl font-bold text-foreground">Create Sub-Admin</h2>
              </div>
              <p className="text-muted-foreground text-lg">
                Grant trusted team members access with tailored permissions.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="Enter first name" {...register('firstName')} />
                  {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Enter last name" {...register('lastName')} />
                  {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <Input id="email" type="email" placeholder="name@company.com" {...register('email')} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Temporary Password</Label>
                  <Input id="password" type="password" placeholder="Minimum 6 characters" {...register('password')} />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" placeholder="Repeat password" {...register('confirmPassword')} />
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secretKey">Super Admin Secret</Label>
                <Input id="secretKey" type="password" placeholder="Admin secret key" {...register('secretKey')} />
                {errors.secretKey && <p className="text-sm text-destructive">{errors.secretKey.message}</p>}
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Permissions</Label>
                  <p className="text-sm text-muted-foreground">Choose what this sub-admin can manage.</p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {permissionOptions.map((permission) => (
                    <Card key={permission.id} className="p-4 border-2 border-gray-100 rounded-2xl">
                      <div className="flex items-start gap-3">
                        <Controller
                          name={`permissions.${permission.id}`}
                          control={control}
                          render={({ field }) => (
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                              className="mt-1"
                            />
                          )}
                        />
                        <div>
                          <p className="font-semibold text-foreground">{permission.title}</p>
                          <p className="text-sm text-muted-foreground">{permission.description}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                {errors.permissions && (
                  <p className="text-sm text-destructive">{errors.permissions.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-semibold text-white rounded-xl shadow-lg"
                style={{ backgroundColor: '#1F3A8A' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating sub-admin...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
