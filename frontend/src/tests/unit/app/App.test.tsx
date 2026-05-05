import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';

const getCurrentUserMock = vi.fn();
const logoutMock = vi.fn();

vi.mock('@/services/authService', () => ({
  default: {
    getCurrentUser: () => getCurrentUserMock(),
    logout: () => logoutMock(),
  },
}));

vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster-mock" />,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/components/auth/LoginPage', () => ({
  default: ({ onLogin, onRegister }: any) => (
    <div>
      <div>login-page</div>
      <button type="button" onClick={() => onLogin('manufacturer', true)}>login-pending-manufacturer</button>
      <button type="button" onClick={() => onLogin('expert', false)}>login-expert</button>
      <button type="button" onClick={onRegister}>go-register</button>
    </div>
  ),
}));

vi.mock('@/components/auth/AdminLoginPage', () => ({
  default: ({ onLogin }: any) => (
    <div>
      <div>admin-login-page</div>
      <button type="button" onClick={() => onLogin('admin')}>admin-login</button>
    </div>
  ),
}));

vi.mock('@/components/auth/SubAdminLoginPage', () => ({
  default: ({ onLogin, onForgotPassword }: any) => (
    <div>
      <div>sub-admin-login-page</div>
      <button type="button" onClick={() => onLogin('admin')}>sub-admin-login</button>
      <button type="button" onClick={onForgotPassword}>sub-admin-forgot</button>
    </div>
  ),
}));

vi.mock('@/components/auth/SubAdminForgotPasswordPage', () => ({
  default: () => <div>sub-admin-forgot-page</div>,
}));

vi.mock('@/components/auth/RegisterPage', () => ({
  default: ({ onBackToLogin }: any) => (
    <div>
      <div>register-page</div>
      <button type="button" onClick={onBackToLogin}>register-back</button>
    </div>
  ),
}));

vi.mock('@/components/auth/ForgotPasswordPage', () => ({
  default: () => <div>forgot-password-page</div>,
}));

vi.mock('@/components/auth/ResetPasswordPage', () => ({
  default: () => <div>reset-password-page</div>,
}));

vi.mock('@/components/auth/VerifyEmailPage', () => ({
  default: () => <div>verify-email-page</div>,
}));

vi.mock('@/components/auth/EmailSentPage', () => ({
  default: () => <div>email-sent-page</div>,
}));

vi.mock('@/components/auth/ManufacturerWaitingPage', () => ({
  default: () => <div>manufacturer-waiting-page</div>,
}));

vi.mock('@/components/dashboards/ArtisanDashboard', () => ({
  default: ({ onLogout }: any) => (
    <div>
      <div>artisan-dashboard</div>
      <button type="button" onClick={onLogout}>artisan-logout</button>
    </div>
  ),
}));

vi.mock('@/components/dashboards/ExpertDashboard', () => ({
  default: ({ onLogout }: any) => (
    <div>
      <div>expert-dashboard</div>
      <button type="button" onClick={onLogout}>expert-logout</button>
    </div>
  ),
}));

vi.mock('@/components/dashboards/ManufacturerDashboard', () => ({
  default: ({ onLogout }: any) => (
    <div>
      <div>manufacturer-dashboard</div>
      <button type="button" onClick={onLogout}>manufacturer-logout</button>
    </div>
  ),
}));

vi.mock('@/components/dashboards/AdminDashboard', () => ({
  default: ({ onLogout }: any) => (
    <div>
      <div>admin-dashboard</div>
      <button type="button" onClick={onLogout}>admin-logout</button>
    </div>
  ),
}));

vi.mock('@/components/artisan/PortfolioGalleryPage', () => ({
  default: ({ itemId }: { itemId: string }) => <div>{`portfolio-page-${itemId}`}</div>,
}));

describe('App', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    logoutMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('should render admin login view when opening /admin unauthenticated', async () => {
    // Arrange
    getCurrentUserMock.mockReturnValue(null);
    window.history.pushState({}, '', '/admin');

    // Act
    render(<App />);

    // Assert
    expect(await screen.findByText('admin-login-page')).toBeInTheDocument();
    expect(screen.queryByText('login-page')).not.toBeInTheDocument();
  });

  it('should render expert dashboard for authenticated expert users', async () => {
    // Arrange
    getCurrentUserMock.mockReturnValue({ _id: 'expert-1', role: 'expert', token: 'expert-token' });

    // Act
    render(<App />);

    // Assert
    expect(await screen.findByText('expert-dashboard')).toBeInTheDocument();
  });

  it('should redirect to manufacturer waiting view for pending manufacturer login', async () => {
    // Arrange
    getCurrentUserMock.mockReturnValue(null);
    const user = userEvent.setup();

    // Act
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'login-pending-manufacturer' }));

    // Assert
    expect(await screen.findByText('manufacturer-waiting-page')).toBeInTheDocument();
  });

  it('should open portfolio gallery route for authenticated artisan users', async () => {
    // Arrange
    getCurrentUserMock.mockReturnValue({ _id: 'artisan-1', role: 'artisan', token: 'artisan-token' });
    window.history.pushState({}, '', '/portfolio/gallery/item-42');

    // Act
    render(<App />);

    // Assert
    expect(await screen.findByText('portfolio-page-item-42')).toBeInTheDocument();
    expect(screen.queryByText('artisan-dashboard')).not.toBeInTheDocument();
  });

  it('should return to admin login after admin logout', async () => {
    // Arrange
    getCurrentUserMock.mockReturnValue({ _id: 'admin-1', role: 'admin', token: 'admin-token', adminType: 'main' });
    const user = userEvent.setup();

    // Act
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'admin-logout' }));

    // Assert
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('admin-login-page')).toBeInTheDocument();
  });
});
