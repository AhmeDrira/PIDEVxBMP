import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, UserPlus, Loader2, Sparkles } from 'lucide-react';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { subAdminSchema } from '../../lib/validations';

import { useLanguage } from '../../context/LanguageContext';
const defaultPermissions = {
  canVerifyManufacturers: true,
  canManageKnowledge: true,
  canSuspendUsers: false,
  canManageReports: false,
  canDeleteUsers: false,
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
    id: 'canManageReports' as const,
    title: 'Manage Reports',
    description: 'Review reports and set accepted/rejected status',
  },
  {
    id: 'canDeleteUsers' as const,
    title: 'Delete Users',
    description: 'Permanently remove accounts (use sparingly)',
  },
];

export default function AdminAddSubAdminPage() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
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

  const onSubmit = async (values: any) => {
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

      toast.success('Sub-admin created successfully. Verification email sent.');

      reset({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        secretKey: '',
        permissions: defaultPermissions,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Unable to create sub-admin. Please verify the secret key and try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-7 shadow-sm">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-blue-100/60" />
        <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-cyan-100/50" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-blue-100">
              <ShieldCheck className="text-blue-700" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Add Sub-Admin</h1>
              <p className="mt-1 text-base text-slate-600">
                Create a trusted admin account with precise access permissions.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            <Sparkles size={16} />
            Super Admin Area
          </div>
        </div>
      </div>

      <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-14">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" placeholder="Enter first name" className="h-12 rounded-xl border-2 border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-600" {...register('firstName')} />
              {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-4">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" placeholder="Enter last name" className="h-12 rounded-xl border-2 border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-600" {...register('lastName')} />
              {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="email" className="mt-2 block">Work Email</Label>
            <Input id="email" type="email" placeholder="name@company.com" className="h-12 rounded-xl border-2 border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-600" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <Label htmlFor="password" className="mt-2 block">Temporary Password</Label>
              <Input id="password" type="password" placeholder="Minimum 6 characters" className="h-12 rounded-xl border-2 border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-600" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-4">
              <Label htmlFor="confirmPassword" className="mt-2 block">Confirm Password</Label>
              <Input id="confirmPassword" type="password" placeholder="Repeat password" className="h-12 rounded-xl border-2 border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-600" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="secretKey" className="mt-2 block">Super Admin Secret</Label>
            <Input id="secretKey" type="password" placeholder="Admin secret key" className="h-12 rounded-xl border-2 border-slate-300 bg-white focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-600" {...register('secretKey')} />
            {errors.secretKey && <p className="text-sm text-destructive">{errors.secretKey.message}</p>}
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Permissions</Label>
              <p className="text-sm text-muted-foreground">Choose what this sub-admin can manage.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {permissionOptions.map((permission) => (
                <Card key={permission.id} className="rounded-2xl border-2 border-slate-200 p-4 transition-colors hover:border-blue-200">
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

          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                reset({
                  firstName: '',
                  lastName: '',
                  email: '',
                  password: '',
                  confirmPassword: '',
                  secretKey: '',
                  permissions: defaultPermissions,
                })
              }
            >
              Reset form
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 rounded-xl !bg-blue-700 px-7 font-semibold !text-white shadow-lg shadow-blue-700/25 hover:!bg-blue-800"
              style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Sub-Admin
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
