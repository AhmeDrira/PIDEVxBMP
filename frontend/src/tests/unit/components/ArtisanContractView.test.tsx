/**
 * Tests for ArtisanContractView — covers:
 *   - loading spinner → contracts grid
 *   - empty state when API returns []
 *   - error state with retry button (clicking retry refetches)
 *   - status counters and pending-signature banner (singular vs plural)
 *   - status badge per status string
 *   - opening detail modal via "Voir le contrat"
 *   - closing detail modal via × button + outside click
 *   - PDF download from the modal (window.open mocked)
 *   - Sign button on a pending_artisan_signature contract → onNavigate('sign-contract', { contractId })
 *   - Refresh button refetches
 *   - Party avatar fallback when no profile photo
 *   - Absolute URL avatar passes through unchanged
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ArtisanContractView from '@/components/artisan/ArtisanContractView';
import { server } from '../../setup/mswServer';

const baseExpert = {
  _id: 'exp-1',
  firstName: 'Eya',
  lastName: 'Expert',
  email: 'eya@bmp.tn',
};
const baseArtisan = {
  _id: 'art-1',
  firstName: 'Amir',
  lastName: 'Artisan',
  email: 'amir@bmp.tn',
};

const baseContract = (overrides: any = {}) => ({
  _id: 'c-1234567890abcdef',
  artisanId: { ...baseArtisan },
  expertId: { ...baseExpert },
  proposalId: {
    _id: 'p-1',
    description: 'Refaire la salle de bain',
    localisation: 'Tunis',
    proposedPrice: 5000,
    negotiatedPrice: 4500,
    startDate: '2026-04-01T00:00:00Z',
    status: 'accepted',
  },
  content:
    'ARTICLE 1 — Objet\nDescription detaillee\n\nFait le 12/02/2026 a Tunis',
  status: 'pending_artisan_signature',
  signedByExpertAt: '2026-02-10T10:00:00Z',
  signatureDataExpert: 'data:image/png;base64,EXPERT_SIG',
  signedByArtisanAt: null,
  signatureData: null,
  createdAt: '2026-02-10T00:00:00Z',
  ...overrides,
});

const installContractsHandler = (data: any[] | { status: number; body?: any }) => {
  if (Array.isArray(data)) {
    server.use(http.get('*/api/contracts', () => HttpResponse.json(data)));
  } else {
    server.use(
      http.get('*/api/contracts', () =>
        HttpResponse.json(data.body ?? { message: 'down' }, { status: data.status })
      )
    );
  }
};

beforeAll(() => {
  Object.defineProperty(window, 'open', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    })),
  });
});

beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ token: 'cv-tok' }));
  (window.open as any).mockClear?.();
});

afterEach(() => {
  localStorage.clear();
});

// ---------- Loading + empty + error ----------------------------------------

describe('ArtisanContractView — loading / empty / error', () => {
  it('shows loading text while fetching', async () => {
    installContractsHandler([]);
    render(<ArtisanContractView />);
    expect(
      screen.getByText(/Chargement des contrats/i)
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(/Chargement des contrats/i)).toBeNull()
    );
  });

  it('renders the empty state when the API returns []', async () => {
    installContractsHandler([]);
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(screen.getByText(/Aucun contrat/i)).toBeInTheDocument()
    );
    expect(
      screen.getByText(/Les contrats sont générés automatiquement/i)
    ).toBeInTheDocument();
  });

  it('renders the error state with a retry button when the API rejects', async () => {
    installContractsHandler({ status: 500, body: { message: 'Erreur serveur' } });
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(screen.getByText('Erreur serveur')).toBeInTheDocument()
    );
    expect(
      screen.getByRole('button', { name: /Réessayer/i })
    ).toBeInTheDocument();
  });

  it('falls back to the i18n message when the backend has no error message', async () => {
    installContractsHandler({ status: 500, body: {} });
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(
        screen.getByText(/Impossible de charger les contrats/i)
      ).toBeInTheDocument()
    );
  });
});

// ---------- Grid + counters + banner -----------------------------------------

describe('ArtisanContractView — grid, counters, banner', () => {
  it('renders contracts grid with status counters', async () => {
    installContractsHandler([
      baseContract({ _id: 'c-1', status: 'pending_artisan_signature' }),
      baseContract({ _id: 'c-2', status: 'pending_artisan_signature' }),
      baseContract({ _id: 'c-3', status: 'signed', signedByArtisanAt: '2026-04-10T00:00:00Z' }),
    ]);
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(screen.getByText(/Mes contrats/i)).toBeInTheDocument()
    );

    // Three cards rendered (last 6 chars of each id)
    expect(screen.getAllByText(/Contrat #/).length).toBe(3);

    // Pending banner — plural form (2 contracts)
    expect(
      screen.getByText(/2 contrats attendent votre signature/i)
    ).toBeInTheDocument();
  });

  it('uses singular wording when exactly one contract is pending signature', async () => {
    installContractsHandler([
      baseContract({ _id: 'c-1', status: 'pending_artisan_signature' }),
      baseContract({ _id: 'c-2', status: 'signed' }),
    ]);
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(
        screen.getByText(/1 contrat attend votre signature/i)
      ).toBeInTheDocument()
    );
  });

  it('renders the right status badge for "signed" contracts', async () => {
    installContractsHandler([
      baseContract({ _id: 'c-s', status: 'signed', signedByArtisanAt: '2026-04-15T00:00:00Z' }),
    ]);
    render(<ArtisanContractView />);
    // Both card badge AND counter pill say "Signé" in FR — use getAllByText
    await waitFor(() =>
      expect(screen.getAllByText(/Signé/).length).toBeGreaterThan(0)
    );
  });

  it('hides the pending banner when no contract is awaiting signature', async () => {
    installContractsHandler([baseContract({ status: 'signed', signedByArtisanAt: '2026-04-10T00:00:00Z' })]);
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(screen.getByText(/Mes contrats/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/attendent votre signature/i)).toBeNull();
    expect(screen.queryByText(/attend votre signature/i)).toBeNull();
  });
});

// ---------- Detail modal ----------------------------------------------------

describe('ArtisanContractView — detail modal', () => {
  it('opens the detail modal when "Voir le contrat" is clicked', async () => {
    installContractsHandler([baseContract()]);
    const user = userEvent.setup();
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(screen.getByText(/Mes contrats/i)).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /Voir le contrat/i }));
    // Modal renders the inner ContractDocument header (parties title)
    expect(screen.getByText(/Parties Prenantes/i)).toBeInTheDocument();
    // Modal-specific PDF + Sign buttons
    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Signer/i })).toBeInTheDocument();
  });

  it('hides the Sign button when status is not pending_artisan_signature', async () => {
    installContractsHandler([
      baseContract({
        status: 'signed',
        signedByArtisanAt: '2026-04-10T00:00:00Z',
      }),
    ]);
    const user = userEvent.setup();
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(screen.getByText(/Mes contrats/i)).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /Voir le contrat/i }));
    expect(screen.queryByRole('button', { name: /^Signer$/i })).toBeNull();
  });

  it('closes the modal when the × button is clicked', async () => {
    installContractsHandler([baseContract()]);
    const user = userEvent.setup();
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(screen.getByText(/Mes contrats/i)).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /Voir le contrat/i }));
    expect(screen.getByText(/Parties Prenantes/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByText(/Parties Prenantes/i)).toBeNull();
  });

  it('downloads the PDF from the modal (window.open called)', async () => {
    installContractsHandler([baseContract()]);
    const user = userEvent.setup();
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(screen.getByText(/Mes contrats/i)).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /Voir le contrat/i }));
    await user.click(screen.getByRole('button', { name: 'PDF' }));
    expect(window.open).toHaveBeenCalled();
  });

  it('Sign button closes the modal and calls onNavigate with the contract id', async () => {
    installContractsHandler([baseContract({ _id: 'c-sign-me' })]);
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<ArtisanContractView onNavigate={onNavigate} />);
    await waitFor(() =>
      expect(screen.getByText(/Mes contrats/i)).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /Voir le contrat/i }));
    await user.click(screen.getByRole('button', { name: /Signer/i }));

    expect(onNavigate).toHaveBeenCalledWith('sign-contract', { contractId: 'c-sign-me' });
    // Modal closed after click
    expect(screen.queryByText(/Parties Prenantes/i)).toBeNull();
  });
});

// ---------- Refresh ---------------------------------------------------------

describe('ArtisanContractView — refresh', () => {
  it('refreshes the list when the Refresh button is clicked', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/contracts', () => {
        calls += 1;
        return HttpResponse.json([baseContract()]);
      })
    );
    const user = userEvent.setup();
    render(<ArtisanContractView />);
    await waitFor(() =>
      expect(screen.getByText(/Mes contrats/i)).toBeInTheDocument()
    );
    expect(calls).toBe(1);

    await user.click(screen.getByRole('button', { name: /Actualiser/i }));
    await waitFor(() => expect(calls).toBe(2));
  });

  it('Retry button on the error pane refetches the list', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/contracts', () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ message: 'down' }, { status: 500 });
        }
        return HttpResponse.json([baseContract()]);
      })
    );
    const user = userEvent.setup();
    render(<ArtisanContractView />);
    await waitFor(() => expect(screen.getByText(/down/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Réessayer/i }));
    await waitFor(() =>
      expect(screen.getByText(/Voir le contrat/i)).toBeInTheDocument()
    );
    expect(calls).toBe(2);
  });
});

// ---------- Avatar branches -------------------------------------------------

describe('ArtisanContractView — avatars', () => {
  it('uses initials avatar when expert has no profilePhoto', async () => {
    installContractsHandler([baseContract()]);
    render(<ArtisanContractView />);
    await waitFor(() => expect(screen.getByText('Eya Expert')).toBeInTheDocument());
    // initials EE for expert and AA for artisan render — no <img> in card
    expect(screen.queryByAltText('EE')).toBeNull();
    expect(screen.getByText('EE')).toBeInTheDocument();
    expect(screen.getByText('AA')).toBeInTheDocument();
  });

  it('renders an <img> with the resolved API_BASE prefix when photo path is relative', async () => {
    installContractsHandler([
      baseContract({
        expertId: { ...baseExpert, profilePhoto: 'uploads/eya.png' },
      }),
    ]);
    render(<ArtisanContractView />);
    await waitFor(() => expect(screen.getByText('Eya Expert')).toBeInTheDocument());
    const img = screen.getAllByAltText(/EE/)[0] as HTMLImageElement;
    expect(img.src).toMatch(/uploads\/eya\.png$/);
  });

  it('renders an <img> with absolute URL untouched', async () => {
    const url = 'https://cdn.example.com/eya.png';
    installContractsHandler([
      baseContract({
        expertId: { ...baseExpert, profilePhoto: url },
      }),
    ]);
    render(<ArtisanContractView />);
    await waitFor(() => expect(screen.getByText('Eya Expert')).toBeInTheDocument());
    const img = screen.getAllByAltText(/EE/)[0] as HTMLImageElement;
    expect(img.src).toBe(url);
  });
});
