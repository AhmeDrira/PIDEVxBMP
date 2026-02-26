import { z } from 'zod';

const lettersOnlyRegex = /^[a-zA-Z\s]+$/;
const lettersOnlyError = 'Only letters allowed, no numbers or special characters';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
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
  phone: z.string().min(1, 'Phone number is required').min(8, 'Phone number must be at least 8 digits'),
  password: z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required').min(6, 'Confirm Password must be at least 6 characters'),
  location: z.string().optional(),
  domain: z.string().optional(),
  yearsExperience: z.string().optional(),
  companyName: z.string().optional(),
  certificationFile: z.string().optional(),
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
    if (role === 'artisan') {
      if (!data.location?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Location is required for Artisans', path: ['location'] });
      if (!data.domain?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Domain is required for Artisans', path: ['domain'] });
    } else if (role === 'expert') {
      if (!data.domain?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Domain is required for Experts', path: ['domain'] });
    } else if (role === 'manufacturer') {
      if (!data.companyName?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Company Name is required for Manufacturers', path: ['companyName'] });
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

// Helper types
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const adminCreateSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .regex(lettersOnlyRegex, lettersOnlyError),
  lastName: z.string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .regex(lettersOnlyRegex, lettersOnlyError),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  phone: z.string().min(1, 'Phone number is required').min(8, 'Phone number must be at least 8 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm Password must be at least 6 characters'),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords don't match",
      path: ["confirmPassword"],
    });
  }
});
export type AdminCreateFormValues = z.infer<typeof adminCreateSchema>;

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
