/**
 * Tests for small auth flow / language components.
 * These are intentionally light-weight components — exercise their main paths.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { LanguageProvider } from '@/context/LanguageContext';
import RegisterRoleSelection from '@/components/auth/RegisterRoleSelection';
import RegisterPage from '@/components/auth/RegisterPage';
import EmailSentPage from '@/components/auth/EmailSentPage';
import ManufacturerWaitingPage from '@/components/auth/ManufacturerWaitingPage';

// ---------- LanguageSwitcher --------------------------------------------------

describe('LanguageSwitcher', () => {
  it('opens the menu and lists the available languages', async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <LanguageSwitcher />
      </LanguageProvider>
    );
    await user.click(screen.getByRole('button', { name: /change language/i }));
    expect(screen.getByText('Français')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText(/العربية|Arab/i)).toBeInTheDocument();
  });

  it('changes the selected language when an option is clicked', async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <LanguageSwitcher />
      </LanguageProvider>
    );
    await user.click(screen.getByRole('button', { name: /change language/i }));
    await user.click(screen.getByText('English'));
    expect(localStorage.getItem('app-language')).toBe('en');
  });

  it('closes when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <div>
          <LanguageSwitcher />
          <button data-testid="outside">outside</button>
        </div>
      </LanguageProvider>
    );
    await user.click(screen.getByRole('button', { name: /change language/i }));
    expect(screen.getByText('Français')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Français')).toBeNull();
  });
});

// ---------- RegisterRoleSelection --------------------------------------------

describe('RegisterRoleSelection', () => {
  it('renders the three roles and triggers onRoleSelect', async () => {
    const user = userEvent.setup();
    const onRoleSelect = vi.fn();
    const onBackToLogin = vi.fn();
    render(<RegisterRoleSelection onRoleSelect={onRoleSelect} onBackToLogin={onBackToLogin} />);

    expect(screen.getByText('Artisan')).toBeInTheDocument();
    expect(screen.getByText('Expert')).toBeInTheDocument();
    expect(screen.getByText('Manufacturer')).toBeInTheDocument();

    await user.click(screen.getByText('Artisan'));
    expect(onRoleSelect).toHaveBeenCalledWith('artisan');

    await user.click(screen.getByText('Expert'));
    expect(onRoleSelect).toHaveBeenCalledWith('expert');

    await user.click(screen.getByRole('button', { name: /back to login/i }));
    expect(onBackToLogin).toHaveBeenCalled();
  });
});

// ---------- RegisterPage (orchestrator) --------------------------------------

vi.mock('@/components/auth/RegisterLeftSection', () => ({
  default: () => <aside data-testid="register-left">left</aside>,
}));

vi.mock('@/components/auth/RegisterForm', () => ({
  default: ({ selectedRole, onBackToRoleSelection }: any) => (
    <div data-testid="register-form">
      role:{selectedRole}
      <button data-testid="back-to-roles" onClick={onBackToRoleSelection}>
        back-to-roles
      </button>
    </div>
  ),
}));

describe('RegisterPage', () => {
  it('starts on role selection and switches to RegisterForm after selecting a role', async () => {
    const user = userEvent.setup();
    const onRegister = vi.fn();
    const onBackToLogin = vi.fn();
    render(<RegisterPage onRegister={onRegister} onBackToLogin={onBackToLogin} />);

    expect(screen.getByText('Choose your role to get started')).toBeInTheDocument();
    await user.click(screen.getByText('Manufacturer'));
    expect(screen.getByTestId('register-form')).toHaveTextContent('role:manufacturer');

    await user.click(screen.getByTestId('back-to-roles'));
    expect(screen.getByText('Choose your role to get started')).toBeInTheDocument();
  });
});

// ---------- EmailSentPage ----------------------------------------------------

describe('EmailSentPage', () => {
  it('renders the email and the back-to-login button works', async () => {
    const user = userEvent.setup();
    const onBackToLogin = vi.fn();
    render(<EmailSentPage email="user@example.com" onBackToLogin={onBackToLogin} />);

    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('Verify Your Email')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /back to login/i }));
    expect(onBackToLogin).toHaveBeenCalled();
  });
});

// ---------- ManufacturerWaitingPage -----------------------------------------

vi.mock('@/components/auth/RegisterLeftSection', () => ({
  default: () => <aside data-testid="register-left">left</aside>,
}));

describe('ManufacturerWaitingPage', () => {
  it('renders the pending state and triggers the back-to-login callback', async () => {
    const user = userEvent.setup();
    const onBackToLogin = vi.fn();
    render(<ManufacturerWaitingPage onBackToLogin={onBackToLogin} />);

    expect(screen.getByText('Application Pending')).toBeInTheDocument();
    expect(screen.getByText(/24-48 hours/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /return to login/i }));
    expect(onBackToLogin).toHaveBeenCalled();
  });
});
