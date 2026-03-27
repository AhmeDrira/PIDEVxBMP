import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Loader2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { PasswordInput } from '../ui/password-input';
import { toast } from 'sonner';
import authService from '../../services/authService';
import { updatePasswordSchema, UpdatePasswordFormValues } from '../../lib/validations';

export default function UpdatePasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    mode: 'onChange',
  });

  const onSubmit = async (values: UpdatePasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await authService.updatePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Password updated successfully');
      reset();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Unable to update password.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 bg-white rounded-3xl border-0 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lock className="text-primary" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Update Password</h2>
            <p className="text-muted-foreground">Keep your account secure with a strong password.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <PasswordInput
              id="currentPassword"
              placeholder="Enter current password"
              {...register('currentPassword')}
              error={Boolean(errors.currentPassword)}
            />
            {errors.currentPassword && (
              <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <PasswordInput
              id="newPassword"
              placeholder="Enter new password"
              {...register('newPassword')}
              error={Boolean(errors.newPassword)}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="Repeat new password"
              {...register('confirmPassword')}
              error={Boolean(errors.confirmPassword)}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 text-base font-semibold text-white rounded-xl shadow-lg transition-colors"
            style={{ backgroundColor: '#1F3A8A' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
