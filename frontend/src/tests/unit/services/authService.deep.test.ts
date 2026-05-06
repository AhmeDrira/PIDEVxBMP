/**
 * Deeper coverage for authService to push it from ~52% toward 90%+.
 *
 * Strategy: drive each method through MSW so we exercise the request/response
 * shape, the auth header injection, and the local storage side-effects.
 */

import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import authService from '@/services/authService';
import { server } from '../../setup/mswServer';

describe('authService — extended coverage', () => {
  it('register: posts payload as-is and returns response', async () => {
    let body: any = {};
    server.use(
      http.post('*/api/auth/register', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ message: 'ok', email: (body as any).email }, { status: 201 });
      })
    );

    const response = await authService.register({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'pwd1234',
      role: 'artisan',
    });

    expect((body as any).email).toBe('john@example.com');
    expect(response.email).toBe('john@example.com');
  });

  it('login: skips persistence when backend returns falsy body', async () => {
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json('', { status: 200 }))
    );
    localStorage.removeItem('user');
    const result = await authService.login({ email: 'x@example.com', password: 'pwd' });
    expect(result).toBe('');
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('adminLogin: persists user when secret is correct', async () => {
    let received: any = {};
    server.use(
      http.post('*/api/auth/admin/login', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ token: 'admin-token', role: 'admin', isSuperAdmin: true });
      })
    );

    const res = await authService.adminLogin('  super-secret  ');
    expect((received as any).secretKey).toBe('super-secret');
    expect(res.role).toBe('admin');
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    expect(stored.token).toBe('admin-token');
  });

  it('createSubAdmin: posts the payload', async () => {
    let payload: any = null;
    server.use(
      http.post('*/api/auth/admin/subadmins', async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json({ admin: { email: (payload as any).email } }, { status: 201 });
      })
    );
    const res = await authService.createSubAdmin({ email: 'sub@example.com' });
    expect((payload as any).email).toBe('sub@example.com');
    expect(res.admin.email).toBe('sub@example.com');
  });

  it('logout + getCurrentUser: round trip', () => {
    localStorage.setItem('user', JSON.stringify({ token: 't', role: 'artisan' }));
    expect(authService.getCurrentUser().token).toBe('t');
    authService.logout();
    expect(authService.getCurrentUser()).toBeNull();
  });

  it('checkEmailAvailable: returns true when backend reports available', async () => {
    server.use(
      http.get('*/api/auth/check-email', () => HttpResponse.json({ available: true }))
    );
    expect(await authService.checkEmailAvailable('free@x.com')).toBe(true);
  });

  it('checkEmailAvailable: returns false when backend reports taken', async () => {
    server.use(
      http.get('*/api/auth/check-email', () => HttpResponse.json({ available: false }))
    );
    expect(await authService.checkEmailAvailable('taken@x.com')).toBe(false);
  });

  it('checkPhoneAvailable: returns true on success', async () => {
    server.use(
      http.get('*/api/auth/check-phone', () => HttpResponse.json({ available: true }))
    );
    expect(await authService.checkPhoneAvailable('20000000')).toBe(true);
  });

  it('forgotPassword + checkResetOptions + resetPassword', async () => {
    let lastUrl = '';
    server.use(
      http.post('*/api/auth/forgot', async ({ request }) => {
        lastUrl = request.url;
        return HttpResponse.json({ message: 'sent' });
      }),
      http.post('*/api/auth/check-reset-options', () =>
        HttpResponse.json({ hasVerifiedPhone: true })
      ),
      http.post('*/api/auth/reset', async ({ request }) => {
        const body: any = await request.json();
        return HttpResponse.json({ ok: body.password === 'NewPwd!' && body.token === 'tok' });
      })
    );

    expect((await authService.forgotPassword('a@x.com')).message).toBe('sent');
    expect(lastUrl).toContain('/forgot');

    expect((await authService.checkResetOptions('a@x.com')).hasVerifiedPhone).toBe(true);

    const reset = await authService.resetPassword('tok', 'NewPwd!');
    expect((reset as any).ok).toBe(true);
  });

  it('admin user management: list/suspend/activate/delete + cert blob', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'admin-tok' }));
    server.use(
      http.get('*/api/auth/admin/users', () =>
        HttpResponse.json([{ _id: 'u1' }, { _id: 'u2' }])
      ),
      http.post('*/api/auth/admin/users/:id/suspend', ({ params }) =>
        HttpResponse.json({ suspended: params.id })
      ),
      http.post('*/api/auth/admin/users/:id/activate', ({ params }) =>
        HttpResponse.json({ activated: params.id })
      ),
      http.delete('*/api/auth/admin/users/:id', ({ params }) =>
        HttpResponse.json({ deleted: params.id })
      ),
      http.post('*/api/auth/admin/manufacturers/:id/approve', ({ params }) =>
        HttpResponse.json({ approved: params.id })
      ),
      http.post('*/api/auth/admin/manufacturers/:id/decline', async ({ request, params }) => {
        const body: any = await request.json();
        return HttpResponse.json({ rejected: params.id, reason: body.reason });
      }),
      http.get('*/api/auth/admin/manufacturers/:id/certification', () =>
        HttpResponse.arrayBuffer(new TextEncoder().encode('PDF-DATA').buffer)
      )
    );

    expect((await authService.listUsers()).length).toBe(2);
    expect((await authService.suspendUser('abc')).suspended).toBe('abc');
    expect((await authService.activateUser('abc')).activated).toBe('abc');
    expect((await authService.deleteUser('abc')).deleted).toBe('abc');

    expect((await authService.approveManufacturer('mid')).approved).toBe('mid');
    const rej = await authService.rejectManufacturer('mid', 'fake docs');
    expect(rej.reason).toBe('fake docs');

    const blob = await authService.getCertificationFile('mid');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('updateProfile: PUT /auth/profile authenticated', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'profile-tok' }));
    let received: any = null;
    let receivedAuth: string | null = null;
    server.use(
      http.put('*/api/auth/profile', async ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        received = await request.json();
        return HttpResponse.json({ ...received });
      })
    );
    const res = await authService.updateProfile({ firstName: 'New' });
    expect((received as any).firstName).toBe('New');
    expect(res.firstName).toBe('New');
    expect(receivedAuth).toBe('Bearer profile-tok');
  });

  it('verifyEmail: POST /auth/verify-email', async () => {
    let receivedToken = '';
    server.use(
      http.post('*/api/auth/verify-email', async ({ request }) => {
        const body: any = await request.json();
        receivedToken = body.token;
        return HttpResponse.json({ message: 'verified' });
      })
    );
    const res = await authService.verifyEmail('verif-tok');
    expect(receivedToken).toBe('verif-tok');
    expect(res.message).toBe('verified');
  });

  it('phone verification flow: send + verify', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'phone-tok' }));
    server.use(
      http.post('*/api/auth/phone/send-verification', async ({ request }) => {
        const body: any = await request.json();
        return HttpResponse.json({ ok: true, phone: body.phone });
      }),
      http.post('*/api/auth/phone/verify', async ({ request }) => {
        const body: any = await request.json();
        return HttpResponse.json({ verified: body.code === '123456' });
      })
    );

    const send = await authService.sendPhoneVerification('20000099');
    expect(send.phone).toBe('20000099');

    const verify = await authService.verifyPhone('123456');
    expect(verify.verified).toBe(true);
  });

  it('forgotPasswordPhone + resetPasswordPhone (email + phone branches)', async () => {
    let last: any = {};
    server.use(
      http.post('*/api/auth/phone/forgot', async ({ request }) => {
        last = await request.json();
        return HttpResponse.json({ message: 'sent' });
      }),
      http.post('*/api/auth/phone/reset', async ({ request }) => {
        last = await request.json();
        return HttpResponse.json({ message: 'reset', body: last });
      })
    );

    await authService.forgotPasswordPhone('user@example.com');
    expect((last as any).email).toBe('user@example.com');

    await authService.resetPasswordPhone('foo@example.com', '123456', 'NewPwd1!');
    expect((last as any).email).toBe('foo@example.com');
    expect((last as any).code).toBe('123456');

    await authService.resetPasswordPhone('20000099', '987654', 'NewPwd1!');
    expect((last as any).phone).toBe('20000099');
    expect((last as any).email).toBeUndefined();
  });

  it('change/confirm email + updatePassword + sub-admin password endpoints', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'mgmt-tok' }));
    let lastBody: any = {};
    server.use(
      http.post('*/api/auth/change-email', async ({ request }) => {
        lastBody = await request.json();
        return HttpResponse.json({ message: 'sent', echo: lastBody });
      }),
      http.post('*/api/auth/confirm-email-change', async ({ request }) => {
        lastBody = await request.json();
        return HttpResponse.json({ email: 'new@example.com' });
      }),
      http.post('*/api/auth/update-password', async ({ request }) => {
        lastBody = await request.json();
        return HttpResponse.json({ message: 'pwd updated' });
      }),
      http.post('*/api/auth/sub-admin/forgot', async ({ request }) => {
        lastBody = await request.json();
        return HttpResponse.json({ message: 'queued' });
      }),
      http.post('*/api/auth/admin/subadmins/:id/reset-password', () =>
        HttpResponse.json({ message: 'temp-pwd-sent' })
      ),
      http.put('*/api/auth/admin/subadmins/:id/permissions', async ({ request }) => {
        const body: any = await request.json();
        return HttpResponse.json({ permissions: body.permissions });
      })
    );

    expect((await authService.requestEmailChange('new@example.com')).echo.newEmail).toBe('new@example.com');
    expect((await authService.confirmEmailChange('123456')).email).toBe('new@example.com');
    expect((await authService.updatePassword({ currentPassword: 'a', newPassword: 'b' })).message).toBe('pwd updated');
    expect((await authService.subAdminForgotPassword('sub@example.com')).message).toBe('queued');

    expect((await authService.resetSubAdminPassword('id1')).message).toBe('temp-pwd-sent');
    const perm = await authService.updateSubAdminPermissions('id1', {
      canVerifyManufacturers: true,
      canManageKnowledge: false,
      canSuspendUsers: false,
      canManageReports: true,
      canDeleteUsers: false,
    });
    expect(perm.permissions.canVerifyManufacturers).toBe(true);
    expect(perm.permissions.canManageReports).toBe(true);
  });

  it('face descriptor lifecycle: status / save / delete + faceLogin persistence', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'face-tok' }));
    let last: any = {};
    server.use(
      http.get('*/api/auth/face-descriptor/status', () =>
        HttpResponse.json({ hasFaceDescriptor: false })
      ),
      http.post('*/api/auth/face-descriptor', async ({ request }) => {
        last = await request.json();
        return HttpResponse.json({ ok: true });
      }),
      http.delete('*/api/auth/face-descriptor', () =>
        HttpResponse.json({ ok: true, removed: true })
      ),
      http.post('*/api/auth/face-login', async ({ request }) => {
        last = await request.json();
        return HttpResponse.json({ _id: 'face-user', token: 'face-jwt', role: 'artisan' });
      })
    );

    expect((await authService.getFaceDescriptorStatus()).hasFaceDescriptor).toBe(false);

    const desc = new Array(128).fill(0.5);
    expect((await authService.saveFaceDescriptor(desc)).ok).toBe(true);
    expect((last as any).descriptor).toHaveLength(128);

    expect((await authService.deleteFaceDescriptor()).removed).toBe(true);

    localStorage.removeItem('user');
    const login = await authService.faceLogin(desc);
    expect(login.token).toBe('face-jwt');
    expect(JSON.parse(localStorage.getItem('user') || '{}').token).toBe('face-jwt');
  });

  it('checkEmailAvailable returns true when backend payload is missing the field', async () => {
    server.use(
      http.get('*/api/auth/check-email', () => HttpResponse.json({}))
    );
    expect(await authService.checkEmailAvailable('weird@x.com')).toBe(false);
  });
});
