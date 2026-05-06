/**
 * Tests for small auth pages still uncovered: VerifyEmailPage, AdminLoginPage.
 * MSW handles backend calls for the verify flow; toasts and auth services are mocked.
 */

import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import VerifyEmailPage from '@/components/auth/VerifyEmailPage';
import AdminLoginPage from '@/components/auth/AdminLoginPage';
import { server } from '../../setup/mswServer';

vi.mock('@/components/auth/RegisterLeftSection', () => ({
  default: () => <aside data-testid="register-left">left</aside>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from 'sonner';

// ---------- VerifyEmailPage --------------------------------------------------

describe('VerifyEmailPage', () => {
  it('shows error when no token is in the URL', async () => {
    window.history.replaceState({}, '', '/verify-email');
    const onBackToLogin = vi.fn();
    render(<VerifyEmailPage onBackToLogin={onBackToLogin} />);
    await waitFor(() => expect(screen.getByText(/verification failed/i)).toBeInTheDocument());
    expect(screen.getByText(/invalid verification link/i)).toBeInTheDocument();
  });

  it('shows success when the backend confirms the token', async () => {
    server.use(
      http.post('*/api/auth/verify-email', () =>
        HttpResponse.json({ message: 'Email verified successfully' })
      )
    );
    window.history.replaceState({}, '', '/verify-email?token=valid-tok-123');

    const onBackToLogin = vi.fn();
    render(<VerifyEmailPage onBackToLogin={onBackToLogin} />);

    await waitFor(
      () => expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument(),
      { timeout: 3000 }
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /back to login/i }));
    expect(onBackToLogin).toHaveBeenCalled();
  });

  it('shows error when the backend rejects the token', async () => {
    server.use(
      http.post('*/api/auth/verify-email', () =>
        HttpResponse.json({ message: 'Token expired' }, { status: 400 })
      )
    );
    window.history.replaceState({}, '', '/verify-email?token=bad-tok');

    render(<VerifyEmailPage onBackToLogin={vi.fn()} />);
    await waitFor(
      () => expect(screen.getByText(/verification failed/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });
});

// ---------- AdminLoginPage ---------------------------------------------------

describe('AdminLoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    (toast.success as any).mockClear?.();
    (toast.error as any).mockClear?.();
  });

  it('renders the admin portal with secret-key input', () => {
    render(<AdminLoginPage onLogin={vi.fn()} />);
    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
    expect(screen.getByLabelText(/admin secret key/i)).toBeInTheDocument();
  });

  it('blocks empty submit via zod validation (button stays clickable but no API hit)', async () => {
    const user = userEvent.setup();
    let hit = false;
    server.use(
      http.post('*/api/auth/admin/login', () => {
        hit = true;
        return HttpResponse.json({ token: 'x', role: 'admin' });
      })
    );
    render(<AdminLoginPage onLogin={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /unlock admin dashboard/i }));
    // Submit fails because zod blocks the empty value; backend never hit.
    expect(hit).toBe(false);
  });

  it('logs in with a valid secret and triggers onLogin("admin")', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/admin/login', () =>
        HttpResponse.json({ token: 'admin-tok', role: 'admin', isSuperAdmin: true })
      )
    );
    const onLogin = vi.fn();
    render(<AdminLoginPage onLogin={onLogin} />);

    await user.type(screen.getByLabelText(/admin secret key/i), 'right-key');
    await user.click(screen.getByRole('button', { name: /unlock admin dashboard/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('admin'));
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows a toast error and clears persistence when role is not admin', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/admin/login', () =>
        HttpResponse.json({ token: 'x', role: 'artisan' })
      )
    );
    const onLogin = vi.fn();
    render(<AdminLoginPage onLogin={onLogin} />);

    await user.type(screen.getByLabelText(/admin secret key/i), 'wrong-role');
    await user.click(screen.getByRole('button', { name: /unlock admin dashboard/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onLogin).not.toHaveBeenCalled();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('surfaces backend error message when the request fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/admin/login', () =>
        HttpResponse.json({ message: 'Invalid admin secret key' }, { status: 401 })
      )
    );
    render(<AdminLoginPage onLogin={vi.fn()} />);
    await user.type(screen.getByLabelText(/admin secret key/i), 'bad');
    await user.click(screen.getByRole('button', { name: /unlock admin dashboard/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
