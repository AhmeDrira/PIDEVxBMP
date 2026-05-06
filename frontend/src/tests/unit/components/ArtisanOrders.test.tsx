/**
 * Tests for ArtisanOrders — covers:
 *   - loading spinner → list rendered
 *   - empty state when API returns no orders
 *   - missing token branch (no fetch)
 *   - search by id / product name
 *   - row expand/collapse
 *   - status fallback (unknown status → "pending" config)
 *   - Stripe session id rendering on expanded rows
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import ArtisanOrders from '@/components/artisan/ArtisanOrders';
import { server } from '../../setup/mswServer';

const seedOrders = [
  {
    _id: 'order-aaaaaaa1',
    paymentDate: '2026-04-01T10:00:00Z',
    status: 'paid',
    totalAmount: 250,
    stripeSessionId: 'cs_session_123',
    items: [
      { name: 'Cement Bag', quantity: 5, price: 30 },
      { name: 'Tile Sand', quantity: 2, price: 50 },
    ],
  },
  {
    _id: 'order-bbbbbbb2',
    paymentDate: '2026-04-05T11:00:00Z',
    status: 'pending',
    totalAmount: 80,
    items: [{ name: 'Paint Roller', quantity: 4, price: 20 }],
  },
  {
    _id: 'order-ccccccc3',
    paymentDate: '2026-04-10T12:00:00Z',
    status: 'delivered',
    totalAmount: 130,
    items: [{ name: 'Pipe Fitting', quantity: 1, price: 130 }],
  },
  {
    _id: 'order-ddddddd4',
    createdAt: '2026-04-12T13:00:00Z',
    status: 'unknown_state',
    totalAmount: 50,
    items: [{ name: 'Brush Set', quantity: 1, price: 50 }],
  },
];

const installHandlers = (orders: any[] = seedOrders) => {
  server.use(
    http.get('*/api/payments/product-payments', () => HttpResponse.json(orders))
  );
};

beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ token: 'ao-tok' }));
});

afterEach(() => {
  localStorage.clear();
});

describe('ArtisanOrders', () => {
  it('shows loading spinner then the list', async () => {
    installHandlers();
    const { container } = render(<ArtisanOrders />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/AAAAAAA1/)).toBeInTheDocument()
    );
  });

  it('renders the empty state when there are no orders', async () => {
    installHandlers([]);
    render(<ArtisanOrders />);
    await waitFor(() =>
      expect(screen.getByText(/No orders yet/i)).toBeInTheDocument()
    );
  });

  it('does not call the API when no token is in storage', async () => {
    localStorage.clear();
    let called = false;
    server.use(
      http.get('*/api/payments/product-payments', () => {
        called = true;
        return HttpResponse.json([]);
      })
    );
    render(<ArtisanOrders />);
    await new Promise((r) => setTimeout(r, 30));
    expect(called).toBe(false);
  });

  it('filters orders by id (last 8 chars)', async () => {
    installHandlers();
    render(<ArtisanOrders />);
    await waitFor(() => expect(screen.getByText(/AAAAAAA1/)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Search orders by ID/i), 'bbbbbbb2');
    expect(screen.queryByText(/AAAAAAA1/)).toBeNull();
    expect(screen.getByText(/BBBBBBB2/)).toBeInTheDocument();
  });

  it('filters orders by product name', async () => {
    installHandlers();
    render(<ArtisanOrders />);
    await waitFor(() => expect(screen.getByText(/AAAAAAA1/)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Search orders by ID/i), 'paint');
    expect(screen.queryByText(/AAAAAAA1/)).toBeNull();
    expect(screen.getByText(/BBBBBBB2/)).toBeInTheDocument();
    expect(screen.queryByText(/CCCCCCC3/)).toBeNull();
  });

  it('expands and collapses an order on click, showing items + Stripe session', async () => {
    installHandlers();
    const user = userEvent.setup();
    render(<ArtisanOrders />);
    await waitFor(() => expect(screen.getByText(/AAAAAAA1/)).toBeInTheDocument());

    // Items hidden initially
    expect(screen.queryByText('Cement Bag')).toBeNull();

    await user.click(screen.getByText(/AAAAAAA1/));
    expect(screen.getByText('Cement Bag')).toBeInTheDocument();
    expect(screen.getByText('Tile Sand')).toBeInTheDocument();
    expect(
      screen.getByText(/Stripe Session: cs_session_123/i)
    ).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByText(/AAAAAAA1/));
    expect(screen.queryByText('Cement Bag')).toBeNull();
  });

  it('only one order is expanded at a time (toggle replaces previous)', async () => {
    installHandlers();
    const user = userEvent.setup();
    render(<ArtisanOrders />);
    await waitFor(() => expect(screen.getByText(/AAAAAAA1/)).toBeInTheDocument());

    await user.click(screen.getByText(/AAAAAAA1/));
    expect(screen.getByText('Cement Bag')).toBeInTheDocument();

    await user.click(screen.getByText(/BBBBBBB2/));
    expect(screen.queryByText('Cement Bag')).toBeNull();
    expect(screen.getByText('Paint Roller')).toBeInTheDocument();
  });

  it('falls back to "pending" status badge for an unknown status string', async () => {
    installHandlers();
    render(<ArtisanOrders />);
    await waitFor(() => expect(screen.getByText(/DDDDDDD4/)).toBeInTheDocument());
    // 2 "Pending" badges are rendered: real pending order + unknown-state fallback
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(2);
  });

  it('shows "—" date when both paymentDate and createdAt are missing', async () => {
    installHandlers([
      { _id: 'order-no-date', status: 'paid', totalAmount: 10, items: [] },
    ]);
    render(<ArtisanOrders />);
    await waitFor(() =>
      expect(screen.getByText(/—/)).toBeInTheDocument()
    );
  });
});
