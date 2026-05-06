/**
 * Tests for ProfileCompletionBanner — exercises:
 *   - role-specific field sets (artisan / expert / manufacturer / admin / unknown)
 *   - score computation + completed/missing partition
 *   - palette branches (100 / 70 / 40 / under)
 *   - motivation text branches
 *   - dismiss button (only when not complete)
 *   - 100% completed view
 *   - missing field chips and CTA navigation
 *   - data merge: API > prop > local
 *   - re-read on profile-updated event
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProfileCompletionBanner from '@/components/common/ProfileCompletionBanner';
import { server } from '../../setup/mswServer';

const completeArtisan = {
  role: 'artisan',
  firstName: 'A',
  lastName: 'B',
  email: 'a@b.c',
  profilePhoto: '/me.jpg',
  phone: '20000000',
  location: 'Tunis',
  bio: 'I build things',
  domain: 'plomberie',
  yearsExperience: 5,
  skills: ['x'],
};

afterEach(() => {
  localStorage.clear();
});

describe('ProfileCompletionBanner — role-driven scoring', () => {
  it('renders 100% complete state with confirmation chips for an artisan', () => {
    render(<ProfileCompletionBanner user={completeArtisan} />);
    expect(screen.getByText('Profile Complete!')).toBeInTheDocument();
    expect(screen.getByText('9/9 fields')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText(/100% complete/)).toBeInTheDocument();
    // No dismiss button on the 100% state
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
    // No CTA when complete
    expect(screen.queryByRole('button', { name: /complete my profile/i })).toBeNull();
  });

  it('shows missing field chips and the CTA when score < 100', async () => {
    const user = { role: 'artisan', firstName: 'A', lastName: 'B', email: 'a@b.c' }; // partial
    const onNavigate = vi.fn();
    render(<ProfileCompletionBanner user={user} onNavigate={onNavigate} />);

    expect(screen.getByText(/^Profile \d+% complete$/)).toBeInTheDocument();
    // Missing field hints render as chips
    expect(screen.getByText('Add photo')).toBeInTheDocument();
    expect(screen.getByText('Add phone')).toBeInTheDocument();

    const userEv = userEvent.setup();
    await userEv.click(screen.getByRole('button', { name: /complete my profile/i }));
    expect(onNavigate).toHaveBeenCalledWith('profile');
  });

  it('passes the configured profileView through onNavigate', async () => {
    const onNavigate = vi.fn();
    render(
      <ProfileCompletionBanner
        user={{ role: 'artisan' }}
        onNavigate={onNavigate}
        profileView="my-profile"
      />
    );
    const userEv = userEvent.setup();
    await userEv.click(screen.getByRole('button', { name: /complete my profile/i }));
    expect(onNavigate).toHaveBeenCalledWith('my-profile');
  });

  it('clicking a missing-field chip also navigates', async () => {
    const onNavigate = vi.fn();
    render(<ProfileCompletionBanner user={{ role: 'artisan' }} onNavigate={onNavigate} />);
    const userEv = userEvent.setup();
    await userEv.click(screen.getByRole('button', { name: /add photo/i }));
    expect(onNavigate).toHaveBeenCalledWith('profile');
  });

  it('uses the manufacturer field set when role=manufacturer', () => {
    render(
      <ProfileCompletionBanner
        user={{ role: 'manufacturer' }}
      />
    );
    expect(screen.getByText('Add company name')).toBeInTheDocument();
    expect(screen.getByText('Describe your business')).toBeInTheDocument();
    expect(screen.getByText('Add certification no.')).toBeInTheDocument();
  });

  it('uses the expert field set when role=expert', () => {
    render(<ProfileCompletionBanner user={{ role: 'expert' }} />);
    expect(screen.getByText('Add institution')).toBeInTheDocument();
    expect(screen.getByText('Add specialization')).toBeInTheDocument();
  });

  it('falls back to admin field set for unknown roles', () => {
    render(<ProfileCompletionBanner user={{ role: 'wizard' }} />);
    // Admin set has 4 fields total. Score 0 → "0/4 fields"
    expect(screen.getByText('0/4 fields')).toBeInTheDocument();
  });
});

describe('ProfileCompletionBanner — dismiss', () => {
  it('hides itself when the dismiss button is clicked', async () => {
    const userEv = userEvent.setup();
    const { container } = render(
      <ProfileCompletionBanner user={{ role: 'artisan' }} />
    );
    expect(container.firstChild).not.toBeNull();
    await userEv.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(container.firstChild).toBeNull();
  });
});

describe('ProfileCompletionBanner — data sources', () => {
  it('fetches /api/auth/me when no user prop is provided and a token exists', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 'pcb-tok' }));
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json({ user: completeArtisan })
      )
    );

    render(<ProfileCompletionBanner />);
    await waitFor(() =>
      expect(screen.getByText('Profile Complete!')).toBeInTheDocument()
    );
  });

  it('skips the /api/auth/me fetch when no token is available', async () => {
    let called = false;
    server.use(
      http.get('*/api/auth/me', () => {
        called = true;
        return HttpResponse.json({ user: completeArtisan });
      })
    );
    render(<ProfileCompletionBanner />);
    await new Promise((r) => setTimeout(r, 30));
    expect(called).toBe(false);
  });

  it('re-reads localStorage when a profile-updated event is dispatched', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ role: 'artisan', firstName: 'A', lastName: 'B' })
    );
    render(<ProfileCompletionBanner />);
    expect(screen.getByText(/^Profile \d+% complete$/)).toBeInTheDocument();

    localStorage.setItem('user', JSON.stringify(completeArtisan));
    fireEvent(window, new Event('profile-updated'));
    await waitFor(() =>
      expect(screen.getByText('Profile Complete!')).toBeInTheDocument()
    );
  });

  it('re-reads localStorage on the storage event', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ role: 'artisan', firstName: 'A', lastName: 'B' })
    );
    render(<ProfileCompletionBanner />);
    expect(screen.getByText(/^Profile \d+% complete$/)).toBeInTheDocument();

    localStorage.setItem('user', JSON.stringify(completeArtisan));
    fireEvent(window, new Event('storage'));
    await waitFor(() =>
      expect(screen.getByText('Profile Complete!')).toBeInTheDocument()
    );
  });

  it('the explicit user prop wins over both API and localStorage', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ role: 'artisan', firstName: 'A', lastName: 'B' })
    );
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json({ user: completeArtisan })
      )
    );
    render(
      <ProfileCompletionBanner
        user={{ role: 'admin', firstName: 'X', lastName: 'Y', email: 'x@y.z' }}
      />
    );
    // Admin set has 4 fields, name+email complete (45%) → photo+phone missing
    await waitFor(() =>
      expect(screen.getByText(/Profile \d+% complete/)).toBeInTheDocument()
    );
    // 2 missing chips would render
    expect(screen.getAllByText(/Add (photo|phone)/i).length).toBeGreaterThanOrEqual(2);
  });
});
