import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import RegisterForm from '@/components/auth/RegisterForm';
import { server } from '../setup/mswServer';
import { artisanUser, expertUser } from '../fixtures/user.fixtures';

vi.mock('@/components/dashboards/ArtisanDashboard', () => ({
  default: () => <div>artisan-dashboard</div>,
}));

vi.mock('@/components/dashboards/ExpertDashboard', () => ({
  default: () => <div>expert-dashboard</div>,
}));

vi.mock('@/components/dashboards/ManufacturerDashboard', () => ({
  default: () => <div>manufacturer-dashboard</div>,
}));

vi.mock('@/components/dashboards/AdminDashboard', () => ({
  default: () => <div>admin-dashboard</div>,
}));

vi.mock('@/components/auth/GoogleLoginButton', () => ({
  GoogleLoginButton: () => <button type="button">google-login-mock</button>,
}));

vi.mock('@/components/auth/FaceCaptureWidget', () => ({
  default: () => <div data-testid="face-capture-widget-mock" />,
}));

describe('Auth flow integration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('should login successfully and redirect artisan users to artisan dashboard', async () => {
    // Arrange
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json(artisanUser))
    );

    const user = userEvent.setup();

    // Act
    render(<App />);

    await user.type(screen.getByLabelText(/email address|adresse email/i), 'artisan@example.com');
    await user.type(screen.getByLabelText(/password|mot de passe/i, { selector: 'input' }), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in|se connecter/i }));

    // Assert
    expect(await screen.findByText('artisan-dashboard')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    expect(stored.role).toBe('artisan');
    expect(stored.token).toBe(artisanUser.token);
  });

  it('should keep user on login form when credentials are invalid', async () => {
    // Arrange
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
      )
    );

    const user = userEvent.setup();

    // Act
    render(<App />);

    await user.type(screen.getByLabelText(/email address|adresse email/i), 'error@example.com');
    await user.type(screen.getByLabelText(/password|mot de passe/i, { selector: 'input' }), 'bad-password');
    await user.click(screen.getByRole('button', { name: /sign in|se connecter/i }));

    // Assert
    expect(await screen.findByText(/welcome back|bon retour/i)).toBeInTheDocument();
    expect(screen.queryByText('artisan-dashboard')).not.toBeInTheDocument();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('should redirect expert users to expert dashboard based on returned role', async () => {
    // Arrange
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json(expertUser))
    );

    const user = userEvent.setup();

    // Act
    render(<App />);

    await user.type(screen.getByLabelText(/email address|adresse email/i), 'expert@example.com');
    await user.type(screen.getByLabelText(/password|mot de passe/i, { selector: 'input' }), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in|se connecter/i }));

    // Assert
    expect(await screen.findByText('expert-dashboard')).toBeInTheDocument();
  });

  it('should submit register form successfully and pass role plus email to callback', async () => {
    // Arrange
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json({ message: 'Registration successful' }, { status: 201 })
      ),
      http.get('*/api/auth/check-email', () => HttpResponse.json({ available: true }))
    );

    const onSubmit = vi.fn();
    const onBackToRoleSelection = vi.fn();
    const onBackToLogin = vi.fn();
    const user = userEvent.setup();

    // Act
    render(
      <RegisterForm
        selectedRole="artisan"
        onSubmit={onSubmit}
        onBackToRoleSelection={onBackToRoleSelection}
        onBackToLogin={onBackToLogin}
      />
    );

    await user.type(screen.getByLabelText(/first name/i), 'Sami');
    await user.type(screen.getByLabelText(/last name/i), 'Builder');
    await user.type(screen.getByLabelText(/email address/i), 'sami.builder@example.com');
    await user.tab();
    await user.type(screen.getByLabelText(/^password$/i), 'Password1');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Assert
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('artisan', false, 'sami.builder@example.com');
    });
  });
});
