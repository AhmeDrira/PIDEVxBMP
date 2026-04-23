import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import ArtisanInvoices from '@/components/artisan/ArtisanInvoices';
import { server } from '../../setup/mswServer';

const invoicesFixture = [
  {
    _id: 'invoice-1',
    invoiceNumber: 'INV-1001',
    status: 'pending',
    project: { _id: 'project-1', title: 'Villa Sidi Bou Said' },
    clientName: 'Amal Ben Salah',
    amount: 3000,
    paidAmount: 0,
    description: 'Foundation and first-floor concrete work',
    issueDate: '2026-04-10T00:00:00.000Z',
    dueDate: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
    paymentPlan: {
      firstTranchePercent: 50,
      firstTranchePaid: false,
      secondTranchePaid: false,
    },
  },
  {
    _id: 'invoice-2',
    invoiceNumber: 'INV-2002',
    status: 'paid',
    project: { _id: 'project-2', title: 'Warehouse Sfax' },
    clientName: 'Sami Logistics',
    amount: 5200,
    paidAmount: 5200,
    description: 'Site finishing and painting',
    issueDate: '2026-04-01T00:00:00.000Z',
    dueDate: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-04-18T00:00:00.000Z',
    paymentPlan: {
      firstTranchePercent: 40,
      firstTranchePaid: true,
      secondTranchePaid: true,
    },
  },
];

describe('ArtisanInvoices', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'invoices-token-1');
    localStorage.setItem('user', JSON.stringify({ _id: 'artisan-1', role: 'artisan', token: 'invoices-token-1' }));
    sessionStorage.removeItem('artisan:redirect-toast');
    window.history.pushState({}, '', '/');
  });

  it('should render invoices after loading state', async () => {
    // Arrange
    server.use(
      http.get('*/api/invoices', async () => {
        await delay(120);
        return HttpResponse.json(invoicesFixture);
      })
    );

    // Act
    render(<ArtisanInvoices />);

    // Assert
    expect(screen.getByText(/loading invoices|chargement des factures/i)).toBeInTheDocument();
    expect(await screen.findByText('INV-1001')).toBeInTheDocument();
    expect(screen.getByText('INV-2002')).toBeInTheDocument();
  });

  it('should show empty state when no invoices are returned', async () => {
    // Arrange
    server.use(http.get('*/api/invoices', () => HttpResponse.json([])));

    // Act
    render(<ArtisanInvoices />);

    // Assert
    expect(await screen.findByText(/no invoices found|aucune facture/i)).toBeInTheDocument();
  });

  it('should gracefully show empty state when invoices request fails', async () => {
    // Arrange
    server.use(
      http.get('*/api/invoices', () =>
        HttpResponse.json({ message: 'Unable to load invoices' }, { status: 500 })
      )
    );

    // Act
    render(<ArtisanInvoices />);

    // Assert
    expect(await screen.findByText(/no invoices found|aucune facture/i)).toBeInTheDocument();
  });

  it('should filter invoices by search query and due filter', async () => {
    // Arrange
    server.use(http.get('*/api/invoices', () => HttpResponse.json(invoicesFixture)));
    const user = userEvent.setup();

    // Act
    render(<ArtisanInvoices />);

    const searchInput = await screen.findByPlaceholderText(/search invoices|rechercher des factures/i);
    await user.clear(searchInput);
    await user.type(searchInput, 'warehouse');

    // Assert
    expect(screen.getByText('INV-2002')).toBeInTheDocument();
    expect(screen.queryByText('INV-1001')).not.toBeInTheDocument();

    // Act
    await user.clear(searchInput);
    const dueFilterSelect = screen.getByDisplayValue(/all due|toutes echeances/i);
    await user.selectOptions(dueFilterSelect, 'overdue');

    // Assert
    expect(screen.getByText('INV-1001')).toBeInTheDocument();
    expect(screen.queryByText('INV-2002')).not.toBeInTheDocument();
  });

  it('should delete an invoice after confirmation', async () => {
    // Arrange
    let deletedId = '';
    server.use(
      http.get('*/api/invoices', () => HttpResponse.json(invoicesFixture)),
      http.delete('*/api/invoices/:invoiceId', ({ params }) => {
        deletedId = String(params.invoiceId || '');
        return HttpResponse.json({ success: true });
      })
    );
    const user = userEvent.setup();

    // Act
    render(<ArtisanInvoices />);

    await screen.findByText('INV-1001');
    await user.click(screen.getAllByRole('button', { name: /delete|supprimer/i })[0]);

    const modalHeading = await screen.findByText(/delete invoice|supprimer la facture/i);
    const modal = modalHeading.closest('div')?.parentElement?.parentElement as HTMLElement;
    await user.click(within(modal).getByRole('button', { name: /yes|oui/i }));

    // Assert
    await waitFor(() => {
      expect(deletedId).toBe('invoice-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('INV-1001')).not.toBeInTheDocument();
    });
    expect(screen.getByText('INV-2002')).toBeInTheDocument();
  });
});
