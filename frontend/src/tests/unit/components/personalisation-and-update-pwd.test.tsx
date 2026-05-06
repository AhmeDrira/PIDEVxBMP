/**
 * Tests for two small reusable pages:
 *   - PersonalisationSettings (text-size selector wired to AccessibilityContext)
 *   - UpdatePasswordPage (RHF + zod + authService.updatePassword)
 */

import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PersonalisationSettings from '@/components/common/PersonalisationSettings';
import UpdatePasswordPage from '@/components/common/UpdatePasswordPage';
import {
  AccessibilityProvider,
  useAccessibility,
} from '@/context/AccessibilityContext';
import { server } from '../../setup/mswServer';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
import { toast } from 'sonner';

// ---------- PersonalisationSettings -----------------------------------------

describe('PersonalisationSettings', () => {
  it('renders the four size buttons and the preview block', () => {
    // default language (provided by setup) is 'fr' — so the headings render in French
    render(
      <AccessibilityProvider>
        <PersonalisationSettings />
      </AccessibilityProvider>
    );
    expect(
      screen.getByRole('heading', { name: /Taille du texte/i })
    ).toBeInTheDocument();
    // The "Aperçu" label appears in the preview card; using queryAllByText to be tolerant
    expect(screen.getAllByText(/Aperçu/i).length).toBeGreaterThan(0);
    // The four size symbols are unique on the page
    expect(screen.getByText('A⁻')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('A⁺')).toBeInTheDocument();
    expect(screen.getByText('A⁺⁺')).toBeInTheDocument();
  });

  it('switches the active text size when a button is clicked', async () => {
    const user = userEvent.setup();

    function Probe() {
      const { textSize } = useAccessibility();
      return <span data-testid="probe">{textSize}</span>;
    }

    render(
      <AccessibilityProvider>
        <Probe />
        <PersonalisationSettings />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('probe').textContent).toBe('medium');
    await user.click(screen.getByText('A⁺⁺'));
    expect(screen.getByTestId('probe').textContent).toBe('xlarge');
  });
});

// ---------- UpdatePasswordPage ----------------------------------------------

describe('UpdatePasswordPage', () => {
  it('renders the three password fields and the submit button', () => {
    render(<UpdatePasswordPage />);
    expect(screen.getByLabelText(/^Current Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^New Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm New Password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
  });

  it('shows zod errors when fields are empty / mismatched', async () => {
    const user = userEvent.setup();
    render(<UpdatePasswordPage />);

    // Trigger validation by typing then clearing. The schema requires non-empty
    // currentPassword + newPassword min 6 + confirm matching.
    await user.type(screen.getByLabelText(/^New Password$/i), 'short');
    await user.type(screen.getByLabelText(/^Confirm New Password$/i), 'mismatch');

    // Submit
    await user.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() =>
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument()
    );
  });

  it('submits the payload, surfaces a success toast and resets the form', async () => {
    let receivedBody: any = null;
    let receivedAuth: string | null = null;
    localStorage.setItem('user', JSON.stringify({ token: 'pwd-tok' }));
    server.use(
      http.post('*/api/auth/update-password', async ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        receivedBody = await request.json();
        return HttpResponse.json({ message: 'Password updated' });
      })
    );

    const user = userEvent.setup();
    render(<UpdatePasswordPage />);

    await user.type(screen.getByLabelText(/^Current Password$/i), 'OldPass1!');
    await user.type(screen.getByLabelText(/^New Password$/i), 'NewPass1!');
    await user.type(screen.getByLabelText(/^Confirm New Password$/i), 'NewPass1!');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Password updated successfully'));
    expect((receivedBody as any).currentPassword).toBe('OldPass1!');
    expect((receivedBody as any).newPassword).toBe('NewPass1!');
    expect(receivedAuth).toBe('Bearer pwd-tok');

    // form is cleared after success
    expect(
      (screen.getByLabelText(/^Current Password$/i) as HTMLInputElement).value
    ).toBe('');
  });

  it('shows the backend error message when the API rejects the update', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'pwd-tok' }));
    server.use(
      http.post('*/api/auth/update-password', () =>
        HttpResponse.json({ message: 'Current password is incorrect' }, { status: 400 })
      )
    );

    const user = userEvent.setup();
    render(<UpdatePasswordPage />);

    await user.type(screen.getByLabelText(/^Current Password$/i), 'WrongOne!');
    await user.type(screen.getByLabelText(/^New Password$/i), 'NewPass1!');
    await user.type(screen.getByLabelText(/^Confirm New Password$/i), 'NewPass1!');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Current password is incorrect')
    );
  });
});
