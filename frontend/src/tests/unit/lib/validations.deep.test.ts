/**
 * Extra coverage for src/lib/validations.ts — covers the success paths and
 * remaining failure branches missed by validations.test.ts.
 */

import { describe, expect, it } from 'vitest';
import {
  adminSecretSchema,
  forgotPasswordSchema,
  getRegisterSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  subAdminSchema,
  updatePasswordSchema,
} from '@/lib/validations';

describe('validations — extended branches', () => {
  it('loginSchema: accepts a valid login payload', () => {
    const ok = loginSchema.safeParse({ email: 'user@example.com', password: 'pwd' });
    expect(ok.success).toBe(true);
  });

  it('loginSchema: rejects empty email', () => {
    const ko = loginSchema.safeParse({ email: '', password: 'pwd' });
    expect(ko.success).toBe(false);
  });

  it('loginSchema: rejects empty password', () => {
    const ko = loginSchema.safeParse({ email: 'a@b.com', password: '' });
    expect(ko.success).toBe(false);
  });

  it('adminSecretSchema: accepts a non-empty secret', () => {
    const ok = adminSecretSchema.safeParse({ secretKey: 'abc' });
    expect(ok.success).toBe(true);
  });

  it('registerSchema: rejects names with digits', () => {
    const result = registerSchema.safeParse({
      firstName: 'John2',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
    });
    expect(result.success).toBe(false);
  });

  it('registerSchema: rejects names below 2 chars', () => {
    const result = registerSchema.safeParse({
      firstName: 'A',
      lastName: 'Doe',
      email: 'a@b.com',
      password: 'secret123',
      confirmPassword: 'secret123',
    });
    expect(result.success).toBe(false);
  });

  it('registerSchema: rejects email with bad format', () => {
    const result = registerSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      email: 'not-an-email',
      password: 'secret123',
      confirmPassword: 'secret123',
    });
    expect(result.success).toBe(false);
  });

  it('registerSchema: accepts a valid payload with matching passwords', () => {
    const result = registerSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  it('getRegisterSchema: returns a schema that validates per-role correctly', () => {
    const expertSchema = getRegisterSchema('expert');
    const ok = expertSchema.safeParse({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
    });
    expect(ok.success).toBe(true);
  });

  it('subAdminSchema: accepts a valid payload with at least one permission', () => {
    const result = subAdminSchema.safeParse({
      firstName: 'Sub',
      lastName: 'Admin',
      email: 'sub@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
      secretKey: 'admin-secret',
      permissions: {
        canVerifyManufacturers: true,
        canManageKnowledge: false,
        canSuspendUsers: false,
        canManageReports: false,
        canDeleteUsers: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it('subAdminSchema: rejects when secretKey is missing', () => {
    const result = subAdminSchema.safeParse({
      firstName: 'Sub',
      lastName: 'Admin',
      email: 'sub@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
      secretKey: '',
      permissions: {
        canVerifyManufacturers: true,
        canManageKnowledge: false,
        canSuspendUsers: false,
        canManageReports: false,
        canDeleteUsers: false,
      },
    });
    expect(result.success).toBe(false);
  });

  it('subAdminSchema: rejects when passwords differ', () => {
    const result = subAdminSchema.safeParse({
      firstName: 'Sub',
      lastName: 'Admin',
      email: 'sub@example.com',
      password: 'secret123',
      confirmPassword: 'mismatch',
      secretKey: 'admin-secret',
      permissions: {
        canVerifyManufacturers: true,
        canManageKnowledge: false,
        canSuspendUsers: false,
        canManageReports: false,
        canDeleteUsers: false,
      },
    });
    expect(result.success).toBe(false);
  });

  it('forgotPasswordSchema: rejects bad email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('resetPasswordSchema: accepts when passwords match', () => {
    const result = resetPasswordSchema.safeParse({ password: 'secret1', confirmPassword: 'secret1' });
    expect(result.success).toBe(true);
  });

  it('resetPasswordSchema: rejects too-short password', () => {
    const result = resetPasswordSchema.safeParse({ password: 'abc', confirmPassword: 'abc' });
    expect(result.success).toBe(false);
  });

  it('updatePasswordSchema: accepts a valid different new password', () => {
    const result = updatePasswordSchema.safeParse({
      currentPassword: 'old-pwd',
      newPassword: 'new-pwd-1',
      confirmPassword: 'new-pwd-1',
    });
    expect(result.success).toBe(true);
  });

  it('updatePasswordSchema: rejects when newPassword and confirm differ', () => {
    const result = updatePasswordSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'newpass1',
      confirmPassword: 'newpass2',
    });
    expect(result.success).toBe(false);
  });

  it('updatePasswordSchema: rejects when newPassword is too short', () => {
    const result = updatePasswordSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'abc',
      confirmPassword: 'abc',
    });
    expect(result.success).toBe(false);
  });
});
