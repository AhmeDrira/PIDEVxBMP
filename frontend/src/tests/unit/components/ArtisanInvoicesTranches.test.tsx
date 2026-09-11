import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { server } from '../../setup/mswServer';
import ArtisanInvoices from '@/components/artisan/ArtisanInvoices';

/**
 * Progression de paiement a N tranches.
 *
 * L'ecran affichait deux blocs figes — « Upfront » et « Upon Completion » —
 * alors que la facture porte desormais autant de tranches que le devis. Chaque
 * tranche a trois etats possibles, alignes sur `canSettleTranche` cote serveur :
 * reglee, a regler, ou verrouillee tant que la precedente ne l'est pas.
 */

const factureA3Tranches = (paid = [false, false, false]) => ({
  _id: 'inv-3',
  invoiceNumber: 'INV-2026-3001',
  clientName: 'M. Trabelsi',
  description: 'Travaux de peinture',
  amount: 1000,
  status: paid.every(Boolean) ? 'paid' : 'pending',
  issueDate: '2026-09-01T00:00:00.000Z',
  dueDate: '2026-12-01T00:00:00.000Z',
  paidAmount: [300, 400, 300].reduce((a, m, i) => a + (paid[i] ? m : 0), 0),
  paymentProgress: [30, 40, 30].reduce((a, p, i) => a + (paid[i] ? p : 0), 0),
  project: { _id: 'p1', title: 'Villa Sidi Bou Said' },
  paymentSessions: [],
  delivery: { status: 'none', timeline: [] },
  paymentPlan: {
    tranches: [
      { label: 'Acompte', percent: 30, amount: 300, paid: paid[0], paidAt: paid[0] ? '2026-09-05T00:00:00.000Z' : null, dueDate: null },
      { label: 'Mi-chantier', percent: 40, amount: 400, paid: paid[1], paidAt: null, dueDate: null },
      { label: 'Solde', percent: 30, amount: 300, paid: paid[2], paidAt: null, dueDate: null },
    ],
  },
});

const ouvrirDetail = async (user: any, facture: any) => {
  server.use(http.get('*/api/invoices', () => HttpResponse.json([facture])));
  render(<ArtisanInvoices />);
  await screen.findByText(/INV-2026-3001/i);
  await user.click(screen.getAllByRole('button', { name: /view|voir|d[ée]tail/i })[0]);
  await screen.findByTestId('tranche-cards');
};

const carte = (index: number) => screen.getByTestId(`tranche-card-${index}`);

beforeEach(() => {
  localStorage.setItem('token', 'invoices-token');
  localStorage.setItem('user', JSON.stringify({ _id: 'artisan-1', role: 'artisan' }));
  sessionStorage.setItem('artisan-sub-active', '1');
  server.use(http.get('*/api/invoices', () => HttpResponse.json([])));
});

describe('ArtisanInvoices — progression a N tranches', () => {
  it('should show one card per tranche, not two fixed blocks', async () => {
    const user = userEvent.setup();
    await ouvrirDetail(user, factureA3Tranches());

    expect(within(screen.getByTestId('tranche-cards')).getAllByTestId(/tranche-card-/)).toHaveLength(3);
    expect(within(carte(0)).getByText('Acompte')).toBeInTheDocument();
    expect(within(carte(1)).getByText('Mi-chantier')).toBeInTheDocument();
    expect(within(carte(2)).getByText('Solde')).toBeInTheDocument();
  });

  it('should show each tranche amount and share', async () => {
    const user = userEvent.setup();
    await ouvrirDetail(user, factureA3Tranches());

    expect(within(carte(1)).getByText(/400\.00/)).toBeInTheDocument();
    expect(within(carte(1)).getByText(/40%/)).toBeInTheDocument();
  });

  it('should mark the first tranche as payable and the others as locked', async () => {
    // Le sequencement de l'ecran reprend celui du serveur, il ne l'invente pas.
    const user = userEvent.setup();
    await ouvrirDetail(user, factureA3Tranches());

    expect(within(carte(0)).getByRole('button', { name: /marquer comme reçue|mark as received/i }))
      .toBeInTheDocument();
    expect(within(carte(1)).getByText(/verrouillée|locked/i)).toBeInTheDocument();
    expect(within(carte(1)).getByText(/réglez la tranche 1|settle instalment 1/i)).toBeInTheDocument();
    expect(within(carte(2)).getByText(/verrouillée|locked/i)).toBeInTheDocument();
  });

  it('should unlock the next tranche once the previous one is settled', async () => {
    const user = userEvent.setup();
    await ouvrirDetail(user, factureA3Tranches([true, false, false]));

    expect(within(carte(0)).getByText(/réglée|received/i)).toBeInTheDocument();
    expect(within(carte(1)).getByRole('button', { name: /marquer comme reçue|mark as received/i }))
      .toBeInTheDocument();
    // La troisieme reste verrouillee : on ne saute pas de marche.
    expect(within(carte(2)).getByText(/verrouillée|locked/i)).toBeInTheDocument();
  });

  it('should send the tranche rank, not a phase word', async () => {
    let recu: any = null;
    server.use(
      http.patch('*/api/invoices/:id/mark-tranche-paid', async ({ request }) => {
        recu = await request.json();
        return HttpResponse.json({ message: 'ok', invoice: factureA3Tranches([true, false, false]) });
      })
    );

    const user = userEvent.setup();
    await ouvrirDetail(user, factureA3Tranches([true, false, false]));

    await user.click(within(carte(1)).getByRole('button', { name: /marquer comme reçue|mark as received/i }));

    await waitFor(() => expect(recu).not.toBeNull());
    expect(recu).toEqual({ trancheIndex: 1 });
  });

  it('should only offer cancellation on the last settled tranche', async () => {
    // Retirer une marche du bas laisserait un trou dans l'echeancier.
    const user = userEvent.setup();
    await ouvrirDetail(user, factureA3Tranches([true, true, false]));

    expect(within(carte(0)).queryByRole('button', { name: /annuler la réception|cancel reception/i })).toBeNull();
    expect(within(carte(1)).getByRole('button', { name: /annuler la réception|cancel reception/i }))
      .toBeInTheDocument();
  });

  it('should cancel by rank too', async () => {
    let recu: any = null;
    server.use(
      http.patch('*/api/invoices/:id/unmark-tranche-paid', async ({ request }) => {
        recu = await request.json();
        return HttpResponse.json({ message: 'ok', invoice: factureA3Tranches([true, false, false]) });
      })
    );

    const user = userEvent.setup();
    await ouvrirDetail(user, factureA3Tranches([true, true, false]));

    await user.click(within(carte(1)).getByRole('button', { name: /annuler la réception|cancel reception/i }));

    await waitFor(() => expect(recu).not.toBeNull());
    expect(recu).toEqual({ trancheIndex: 1 });
  });

  it('should show the reception date on a settled tranche', async () => {
    const user = userEvent.setup();
    await ouvrirDetail(user, factureA3Tranches([true, false, false]));

    expect(within(carte(0)).getByText(/reçue le|received/i)).toBeInTheDocument();
  });

  it('should number the tranches out of the real total', async () => {
    const user = userEvent.setup();
    await ouvrirDetail(user, factureA3Tranches());

    expect(within(carte(1)).getByText(/tranche 2 sur 3|instalment 2 of 3/i)).toBeInTheDocument();
  });

  it('should still render a two-tranche invoice exactly as before', async () => {
    // Non-regression : la grande majorite des factures en ont deux.
    const deux = {
      ...factureA3Tranches(),
      _id: 'inv-2',
      paymentPlan: {
        tranches: [
          { label: 'Acompte', percent: 40, amount: 400, paid: true, paidAt: '2026-09-05T00:00:00.000Z', dueDate: null },
          { label: 'Solde', percent: 60, amount: 600, paid: false, paidAt: null, dueDate: null },
        ],
      },
    };
    const user = userEvent.setup();
    await ouvrirDetail(user, deux);

    expect(within(screen.getByTestId('tranche-cards')).getAllByTestId(/tranche-card-/)).toHaveLength(2);
    expect(within(carte(0)).getByText(/réglée|received/i)).toBeInTheDocument();
    expect(within(carte(1)).getByRole('button', { name: /marquer comme reçue|mark as received/i }))
      .toBeInTheDocument();
  });
});
