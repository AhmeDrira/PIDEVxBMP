import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import authService from '@/services/authService';
import { server } from '../../setup/mswServer';
import { artisanUser } from '../../fixtures/user.fixtures';

describe('authService', () => {
  it('should send trimmed email and persist user on successful login', async () => {
    // Arrange
    let receivedBody: { email?: string; password?: string } = {};

    server.use(
      http.post('*/api/auth/login', async ({ request }) => {
        receivedBody = (await request.json()) as { email?: string; password?: string };
        return HttpResponse.json(artisanUser);
      })
    );

    // Act
    const response = await authService.login({
      email: '   artisan@example.com   ',
      password: 'secret123',
    });

    // Assert
    expect(receivedBody.email).toBe('artisan@example.com');
    expect(response.role).toBe('artisan');

    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    expect(stored.token).toBe(artisanUser.token);
    expect(stored.role).toBe('artisan');
  });

  it('should attach Authorization header for authenticated requests', async () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'auth-token-123' }));

    server.use(
      http.get('*/api/auth/admin/manufacturers/pending', ({ request }) => {
        return HttpResponse.json({
          receivedAuthorization: request.headers.get('authorization'),
        });
      })
    );

    // Act
    const response = await authService.getPendingManufacturers();

    // Assert
    expect(response.receivedAuthorization).toBe('Bearer auth-token-123');
  });

  it('should return true when email availability check fails (graceful fallback)', async () => {
    // Arrange
    server.use(
      http.get('*/api/auth/check-email', () =>
        HttpResponse.json({ message: 'Backend error' }, { status: 500 })
      )
    );

    // Act
    const isAvailable = await authService.checkEmailAvailable('anyone@example.com');

    // Assert
    expect(isAvailable).toBe(true);
  });

  it('should normalize legacy google role and persist the normalized user', async () => {
    // Arrange
    let receivedBody: { credential?: string; role?: string } = {};

    server.use(
      http.post('*/api/auth/google', async ({ request }) => {
        receivedBody = (await request.json()) as { credential?: string; role?: string };
        return HttpResponse.json({
          _id: 'google-user-1',
          token: 'google-token-1',
          role: 'user',
        });
      })
    );

    // Act
    const result = await authService.loginWithGoogle('google-credential-abc', 'expert');

    // Assert
    expect(receivedBody.credential).toBe('google-credential-abc');
    expect(receivedBody.role).toBe('expert');
    expect(result.role).toBe('artisan');

    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    expect(stored.role).toBe('artisan');
    expect(stored.token).toBe('google-token-1');
  });

  it('should clear persisted user on logout', () => {
    // Arrange
    localStorage.setItem('user', JSON.stringify({ token: 'logout-token' }));

    // Act
    authService.logout();

    // Assert
    expect(localStorage.getItem('user')).toBeNull();
    expect(authService.getCurrentUser()).toBeNull();
  });

  it('should return true when phone availability check fails (graceful fallback)', async () => {
    // Arrange
    server.use(
      http.get('*/api/auth/check-phone', () =>
        HttpResponse.json({ message: 'Backend error' }, { status: 500 })
      )
    );

    // Act
    const isAvailable = await authService.checkPhoneAvailable('+21600112233');

    // Assert
    expect(isAvailable).toBe(true);
  });
});
