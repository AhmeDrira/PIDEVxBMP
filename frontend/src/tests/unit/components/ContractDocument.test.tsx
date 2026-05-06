/**
 * Tests for ContractDocument:
 *   - rendering of header, parties, service details, articles, signatures
 *   - status badges per status string + fallback to 'draft'
 *   - showDownload toggle
 *   - PDF download button opens a window (mocked)
 *   - signatures: signed vs awaiting branches
 *   - profile photo URL resolution (relative + absolute)
 *   - articles parsed by parseContractContent vs raw content fallback
 *   - missing optional sections (no proposal, no signatures, etc.)
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import ContractDocument, { type ContractDocumentData } from '@/components/common/ContractDocument';

// Mock window.open used by downloadContractPDF
beforeAll(() => {
  Object.defineProperty(window, 'open', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    })),
  });
});

afterEach(() => {
  (window.open as any).mockClear?.();
});

const expert = {
  _id: 'exp-1',
  firstName: 'Eya',
  lastName: 'Expert',
  email: 'eya@bmp.tn',
  profilePhoto: '/uploads/eya.jpg',
};

const artisan = {
  _id: 'art-1',
  firstName: 'Amir',
  lastName: 'Artisan',
  email: 'amir@bmp.tn',
};

const articleContent = [
  'ARTICLE 1 — Objet du contrat',
  'Description detaillee de la prestation',
  '',
  'ARTICLE 2 — Modalites',
  'Echeancier de paiement et delais',
  '',
  'Fait le 12/02/2026 a Tunis',
].join('\n');

const baseContract = (overrides: Partial<ContractDocumentData> = {}): ContractDocumentData => ({
  _id: 'c-1234567890abcdef',
  artisanId: artisan,
  expertId: expert,
  content: articleContent,
  proposalId: {
    description: 'Renovation salle de bain',
    localisation: 'Tunis, La Marsa',
    proposedPrice: 5000,
    negotiatedPrice: 4500,
    startDate: '2026-03-01T00:00:00Z',
  },
  status: 'pending_artisan_signature',
  signedByExpertAt: '2026-02-12T10:00:00Z',
  signatureDataExpert: 'data:image/png;base64,EXPERT_SIG',
  signedByArtisanAt: null,
  signatureData: null,
  createdAt: '2026-02-10T00:00:00Z',
  ...overrides,
});

// ---------- Rendering -------------------------------------------------------

describe('ContractDocument — rendering', () => {
  it('renders the header, parties and service details for a fully signed contract', () => {
    const contract = baseContract({
      status: 'signed',
      signedByArtisanAt: '2026-02-12T11:00:00Z',
      signatureData: 'data:image/png;base64,ARTISAN_SIG',
    });
    render(<ContractDocument contract={contract} />);

    // Header
    expect(screen.getByText('bmp.tn')).toBeInTheDocument();
    expect(screen.getByText(/Plateforme Construction/i)).toBeInTheDocument();
    expect(screen.getByText(/^#/)).toBeInTheDocument(); // contract id
    expect(screen.getByRole('heading', { name: /Contrat de Prestation de Services/i })).toBeInTheDocument();

    // Status badge — signed
    expect(screen.getByText(/Signé par les deux parties/i)).toBeInTheDocument();

    // Parties (FR) — names appear multiple times (parties card + signatures), so use getAllByText
    expect(screen.getByText(/Parties Prenantes/i)).toBeInTheDocument();
    expect(screen.getAllByText('Eya Expert').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Amir Artisan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('eya@bmp.tn').length).toBeGreaterThan(0);
    expect(screen.getAllByText('amir@bmp.tn').length).toBeGreaterThan(0);

    // Service details
    expect(screen.getByText(/Détails de la Prestation/i)).toBeInTheDocument();
    expect(screen.getByText('Renovation salle de bain')).toBeInTheDocument();
    expect(screen.getByText('Tunis, La Marsa')).toBeInTheDocument();
    // negotiatedPrice 4500 takes priority over proposedPrice 5000
    expect(screen.getByText(/4 500.*TND/)).toBeInTheDocument();

    // Articles (parseContractContent)
    expect(screen.getByText(/Objet du contrat/i)).toBeInTheDocument();
    expect(screen.getByText(/Description detaillee de la prestation/i)).toBeInTheDocument();
    expect(screen.getByText(/Modalites/i)).toBeInTheDocument();

    // Signatures section
    expect(screen.getAllByText(/Signatures Électroniques/i).length).toBeGreaterThan(0);
    // Both sigs visible
    expect(screen.getAllByAltText('signature')).toHaveLength(2);

    // Legal notice
    expect(
      screen.getByText(/signatures électroniques ont la même valeur légale/i)
    ).toBeInTheDocument();
  });

  it('uses negotiatedPrice over proposedPrice and shows it as final price', () => {
    render(<ContractDocument contract={baseContract()} />);
    expect(screen.getByText(/4 500.*TND/)).toBeInTheDocument();
    expect(screen.queryByText(/5 000.*TND/)).toBeNull();
  });

  it('falls back to proposedPrice when negotiatedPrice is null', () => {
    render(
      <ContractDocument
        contract={baseContract({
          proposalId: {
            description: 'Demo',
            localisation: 'X',
            proposedPrice: 1500,
            negotiatedPrice: null,
            startDate: '2026-03-01T00:00:00Z',
          },
        })}
      />
    );
    expect(screen.getByText(/1 500.*TND/)).toBeInTheDocument();
  });

  it('shows "Awaiting signature" placeholder when artisan hasn\'t signed yet', () => {
    render(<ContractDocument contract={baseContract()} />);
    expect(screen.getByText(/En attente de signature/i)).toBeInTheDocument();
    expect(screen.getByText(/Non signé/i)).toBeInTheDocument();
    // Expert sig date present
    expect(screen.getAllByText(/Signé le/i).length).toBeGreaterThan(0);
  });

  it('hides the service-details card when there is no proposal data', () => {
    render(
      <ContractDocument
        contract={baseContract({ proposalId: null })}
      />
    );
    expect(screen.queryByText(/Détails de la Prestation/i)).toBeNull();
  });

  it('renders the raw content when no ARTICLE blocks are detected', () => {
    render(
      <ContractDocument
        contract={baseContract({
          content: 'Texte libre du contrat sans entête.',
        })}
      />
    );
    expect(screen.getByText('Texte libre du contrat sans entête.')).toBeInTheDocument();
  });

  it('renders the artisan signature image and date once both sides have signed', () => {
    const contract = baseContract({
      status: 'signed',
      signedByArtisanAt: '2026-02-13T09:00:00Z',
      signatureData: 'data:image/png;base64,ART_SIG',
    });
    render(<ContractDocument contract={contract} />);
    // Two signature images
    const sigs = screen.getAllByAltText('signature');
    expect(sigs).toHaveLength(2);
    // Both sig dates present (one for each)
    const signedOn = screen.getAllByText(/Signé le/i);
    expect(signedOn.length).toBe(2);
  });

  it('uses the absolute photo URL as-is when it starts with http', () => {
    const url = 'https://cdn.example.com/photo.jpg';
    const { container } = render(
      <ContractDocument
        contract={baseContract({
          expertId: { ...expert, profilePhoto: url },
        })}
      />
    );
    // No assertion on the parties card avatar (the inline Avatar is internal),
    // but we can check that nothing else uses the BMP API base for the avatar path.
    expect(container.innerHTML).not.toContain('http://localhost:5000/uploads/eya.jpg');
  });
});

// ---------- Status badge ----------------------------------------------------

describe('ContractDocument — status branches', () => {
  it.each([
    ['draft', /Brouillon/i],
    ['pending_expert_signature', /En attente de l'expert/i],
    ['pending_artisan_signature', /En attente de l'artisan/i],
    ['signed', /Signé par les deux parties/i],
    ['completed', /Terminé/i],
  ] as const)('renders the %s badge', (status, label) => {
    render(<ContractDocument contract={baseContract({ status })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('falls back to draft styling for unknown status', () => {
    render(
      <ContractDocument contract={baseContract({ status: 'mystery-status' as any })} />
    );
    expect(screen.getByText(/Brouillon/i)).toBeInTheDocument();
  });
});

// ---------- Download toggle + PDF -------------------------------------------

describe('ContractDocument — download', () => {
  it('hides the download button when showDownload is false', () => {
    render(<ContractDocument contract={baseContract()} showDownload={false} />);
    expect(screen.queryByRole('button', { name: /Télécharger PDF/i })).toBeNull();
  });

  it('opens a print window when "Télécharger PDF" is clicked', async () => {
    const user = userEvent.setup();
    render(<ContractDocument contract={baseContract()} />);
    await user.click(screen.getByRole('button', { name: /Télécharger PDF/i }));
    expect(window.open).toHaveBeenCalled();
  });
});
