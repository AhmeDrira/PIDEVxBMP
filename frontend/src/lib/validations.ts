import { z } from 'zod';

const lettersOnlyRegex = /^[a-zA-Z\s]+$/;
const lettersOnlyError = 'Only letters allowed, no numbers or special characters';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const adminSecretSchema = z.object({
  secretKey: z.string().min(1, 'Admin secret key is required'),
});

export const registerBaseSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .regex(lettersOnlyRegex, lettersOnlyError),
  lastName: z.string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .regex(lettersOnlyRegex, lettersOnlyError),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required').min(6, 'Confirm Password must be at least 6 characters'),
});

export function getRegisterSchema(role: 'artisan' | 'expert' | 'manufacturer' | 'admin') {
  return registerBaseSchema.superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords don't match",
        path: ['confirmPassword'],
      });
    }
  });
}

export const registerSchema = registerBaseSchema.superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords don't match",
      path: ['confirmPassword'],
    });
  }
});

const subAdminPermissionsSchema = z.object({
  canVerifyManufacturers: z.boolean().default(false),
  canManageKnowledge: z.boolean().default(false),
  canSuspendUsers: z.boolean().default(false),
  canManageReports: z.boolean().default(false),
  canDeleteUsers: z.boolean().default(false),
});

export const subAdminSchema = registerBaseSchema.extend({
  secretKey: z.string().min(1, 'Admin secret key is required'),
  permissions: subAdminPermissionsSchema,
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords don't match",
      path: ['confirmPassword'],
    });
  }

  const hasAnyPermission = Object.values(data.permissions || {}).some(Boolean);
  if (!hasAnyPermission) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select at least one permission for the sub-admin',
      path: ['permissions'],
    });
  }
});

// Helper types
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type AdminSecretFormValues = z.infer<typeof adminSecretSchema>;
export type SubAdminFormValues = z.infer<typeof subAdminSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords don't match",
      path: ['confirmPassword'],
    });
  }
});
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).superRefine((data, ctx) => {
  if (data.newPassword !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords don't match",
      path: ['confirmPassword'],
    });
  }
  if (data.currentPassword === data.newPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'New password must be different from current password',
      path: ['newPassword'],
    });
  }
});
export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;
