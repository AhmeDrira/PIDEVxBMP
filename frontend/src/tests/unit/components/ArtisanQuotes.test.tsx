import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import ArtisanQuotes from '@/components/artisan/ArtisanQuotes';
import { server } from '../../setup/mswServer';

const quotesFixture = [
  {
    _id: 'quote-1',
    quoteNumber: 'Q-1001',
    status: 'pending',
    project: { _id: 'project-1', title: 'Villa Sidi Bou Said' },
    clientName: 'Amal Ben Salah',
    description: 'Structural concrete and masonry work for the ground floor.',
    createdAt: '2026-04-20T10:00:00.000Z',
    validUntil: '2026-05-20T10:00:00.000Z',
    amount: 4200,
    laborHand: 2500,
    materialsAmount: 1700,
    hasInvoice: false,
    upfrontPercent: 50,
  },
  {
    _id: 'quote-2',
    quoteNumber: 'Q-1002',
    status: 'approved',
    project: { _id: 'project-2', title: 'Warehouse Sfax' },
    clientName: 'Sami Logistics',
    description: 'Interior finishing and coatings for the full site.',
    createdAt: '2026-04-18T10:00:00.000Z',
    validUntil: '2026-05-18T10:00:00.000Z',
    amount: 6100,
    laborHand: 3200,
    materialsAmount: 2900,
    hasInvoice: true,
    upfrontPercent: 40,
  },
];

describe('ArtisanQuotes', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'quotes-token-1');
    localStorage.setItem('user', JSON.stringify({ _id: 'artisan-1', role: 'artisan', token: 'quotes-token-1' }));
    sessionStorage.setItem('artisan-sub-active', '1');
  });

  it('should render quotes after loading state', async () => {
    // Arrange
    server.use(
      http.get('*/api/quotes', async () => {
        await delay(120);
        return HttpResponse.json(quotesFixture);
      })
    );

    // Act
    render(<ArtisanQuotes />);

    // Assert
    expect(screen.getByText(/loading quotes|chargement des devis/i)).toBeInTheDocument();
    expect(await screen.findByText(/quote q-1001|devis q-1001/i)).toBeInTheDocument();
    expect(screen.getByText(/quote q-1002|devis q-1002/i)).toBeInTheDocument();
  });

  it('should show empty state when no quotes are returned', async () => {
    // Arrange
    server.use(http.get('*/api/quotes', () => HttpResponse.json([])));

    // Act
    render(<ArtisanQuotes />);

    // Assert
    expect(await screen.findByText(/no quotes found|aucun devis/i)).toBeInTheDocument();
  });

  it('should gracefully show empty state when quotes request fails', async () => {
    // Arrange
    server.use(
      http.get('*/api/quotes', () =>
        HttpResponse.json({ message: 'Unable to load quotes' }, { status: 500 })
      )
    );

    // Act
    render(<ArtisanQuotes />);

    // Assert
    expect(await screen.findByText(/no quotes found|aucun devis/i)).toBeInTheDocument();
  });

  it('should filter quotes by search query and status', async () => {
    // Arrange
    server.use(http.get('*/api/quotes', () => HttpResponse.json(quotesFixture)));
    const user = userEvent.setup();

    // Act
    render(<ArtisanQuotes />);

    const searchInput = await screen.findByPlaceholderText(/search quotes|rechercher des devis/i);
    await user.clear(searchInput);
    await user.type(searchInput, 'warehouse');

    // Assert
    expect(screen.getByText(/quote q-1002|devis q-1002/i)).toBeInTheDocument();
    expect(screen.queryByText(/quote q-1001|devis q-1001/i)).not.toBeInTheDocument();

    // Act
    await user.clear(searchInput);
    const statusSelect = screen.getByDisplayValue(/all status|tous les statuts/i);
    await user.selectOptions(statusSelect, 'pending');

    // Assert
    expect(screen.getByText(/quote q-1001|devis q-1001/i)).toBeInTheDocument();
    expect(screen.queryByText(/quote q-1002|devis q-1002/i)).not.toBeInTheDocument();
  });

  it('should delete a quote after confirmation', async () => {
    // Arrange
    let deletedId = '';
    server.use(
      http.get('*/api/quotes', () => HttpResponse.json(quotesFixture)),
      http.delete('*/api/quotes/:quoteId', ({ params }) => {
        deletedId = String(params.quoteId || '');
        return HttpResponse.json({ success: true });
      })
    );
    const user = userEvent.setup();

    // Act
    render(<ArtisanQuotes />);

    await screen.findByText(/quote q-1001|devis q-1001/i);
    await user.click(screen.getAllByRole('button', { name: /delete|supprimer/i })[0]);

    const modalTitle = await screen.findByText(/delete quote|supprimer le devis/i);
    const modal = modalTitle.closest('div')?.parentElement?.parentElement as HTMLElement;
    const confirmDeleteButton = within(modal).getByRole('button', { name: /delete|supprimer/i });
    await user.click(confirmDeleteButton);

    // Assert
    await waitFor(() => {
      expect(deletedId).toBe('quote-1');
    });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /quote q-1001|devis q-1001/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /quote q-1002|devis q-1002/i })).toBeInTheDocument();
  });
});
