import { describe, expect, it } from 'vitest';
import {
  adminSecretSchema,
  forgotPasswordSchema,
  getRegisterSchema,
  loginSchema,
  resetPasswordSchema,
  subAdminSchema,
  updatePasswordSchema,
} from '@/lib/validations';

describe('validations', () => {
  it('should reject invalid login email format', () => {
    // Arrange
    const payload = { email: 'invalid-email', password: 'secret123' };

    // Act
    const result = loginSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('should validate admin secret key presence', () => {
    // Arrange
    const payload = { secretKey: '' };

    // Act
    const result = adminSecretSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('should reject register payload when passwords do not match', () => {
    // Arrange
    const schema = getRegisterSchema('artisan');
    const payload = {
      firstName: 'Amine',
      lastName: 'Builder',
      email: 'amine@example.com',
      password: 'secret123',
      confirmPassword: 'different123',
    };

    // Act
    const result = schema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('should reject sub-admin payload when no permission is enabled', () => {
    // Arrange
    const payload = {
      firstName: 'Asma',
      lastName: 'Supervisor',
      email: 'asma@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
      secretKey: 'admin-secret',
      permissions: {
        canVerifyManufacturers: false,
        canManageKnowledge: false,
        canSuspendUsers: false,
        canManageReports: false,
        canDeleteUsers: false,
      },
    };

    // Act
    const result = subAdminSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('should reject reset password payload when confirmation does not match', () => {
    // Arrange
    const payload = {
      password: 'secret123',
      confirmPassword: 'secret321',
    };

    // Act
    const result = resetPasswordSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('should reject update password payload when new password equals current', () => {
    // Arrange
    const payload = {
      currentPassword: 'same-password',
      newPassword: 'same-password',
      confirmPassword: 'same-password',
    };

    // Act
    const result = updatePasswordSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it('should validate forgot password payload with a proper email', () => {
    // Arrange
    const payload = { email: 'user@example.com' };

    // Act
    const result = forgotPasswordSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(true);
  });
});
