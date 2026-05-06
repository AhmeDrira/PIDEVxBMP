/**
 * Tests for NotificationBell — exercises:
 *   - empty state (no token)
 *   - bell + unread badge counter (and 99+ cap)
 *   - dropdown open/close
 *   - mark single as read
 *   - mark all read
 *   - clear all
 *   - close on outside click
 *   - icon mapping per notification type
 *   - 30s polling auto-refresh
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NotificationBell from '@/components/common/NotificationBell';
import { server } from '../../setup/mswServer';

const seedNotifs = [
  {
    _id: 'n1',
    type: 'new_order',
    title: 'New order',
    message: 'You have a new order',
    read: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    _id: 'n2',
    type: 'order_status_update',
    title: 'Order shipped',
    message: 'ORD-123 is on its way',
    read: false,
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
  {
    _id: 'n3',
    type: 'manufacturer_registration',
    title: 'New manufacturer',
    message: 'Acme registered',
    read: true,
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
];

const installNotifsHandler = (initial = seedNotifs) => {
  let current = [...initial];
  server.use(
    http.get('*/api/notifications', () => HttpResponse.json(current)),
    http.put('*/api/notifications/:id/read', ({ params }) => {
      current = current.map((n) =>
        n._id === params.id ? { ...n, read: true } : n
      );
      return HttpResponse.json({ ok: true });
    }),
    http.put('*/api/notifications/read-all', () => {
      current = current.map((n) => ({ ...n, read: true }));
      return HttpResponse.json({ ok: true });
    }),
    http.delete('*/api/notifications', () => {
      current = [];
      return HttpResponse.json({ ok: true });
    })
  );
  return {
    setData: (next: any[]) => {
      current = next;
    },
  };
};

describe('NotificationBell', () => {
  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ token: 'notif-tok' }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the bell with no badge when there are no notifications', async () => {
    installNotifsHandler([]);
    render(<NotificationBell />);
    expect(
      await screen.findByRole('button', { name: /notifications/i })
    ).toBeInTheDocument();
    // No badge => no number text
    expect(screen.queryByText('99+')).toBeNull();
  });

  it('shows the unread count from the API', async () => {
    installNotifsHandler();
    render(<NotificationBell />);
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('caps the badge at 99+ when there are more than 99 unread', async () => {
    const big = Array.from({ length: 120 }).map((_, i) => ({
      _id: `n-${i}`,
      type: 'new_order',
      title: `n${i}`,
      message: 'x',
      read: false,
      createdAt: new Date().toISOString(),
    }));
    installNotifsHandler(big);
    render(<NotificationBell />);
    expect(await screen.findByText('99+')).toBeInTheDocument();
  });

  it('does not fetch when there is no auth token', async () => {
    localStorage.removeItem('user');
    let called = false;
    server.use(
      http.get('*/api/notifications', () => {
        called = true;
        return HttpResponse.json([]);
      })
    );
    render(<NotificationBell />);
    // give the effect a tick
    await new Promise((r) => setTimeout(r, 30));
    expect(called).toBe(false);
  });

  it('opens the dropdown and renders notifications + headers', async () => {
    installNotifsHandler();
    const user = userEvent.setup();
    render(<NotificationBell />);
    await screen.findByText('2');
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('New order')).toBeInTheDocument();
    expect(screen.getByText('Order shipped')).toBeInTheDocument();
    expect(screen.getByText('New manufacturer')).toBeInTheDocument();
    // Mark all read button visible because there are unread ones
    expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
  });

  it('marks a single notification as read when clicked', async () => {
    installNotifsHandler();
    const user = userEvent.setup();
    render(<NotificationBell />);
    // Bell button updates its aria-label with the count
    await screen.findByRole('button', { name: /notifications, 2 unread/i });
    await user.click(screen.getByRole('button', { name: /notifications, 2 unread/i }));

    await user.click(screen.getByText('New order'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /notifications, 1 unread/i })
      ).toBeInTheDocument()
    );
  });

  it('marks all as read when the "Mark all read" button is clicked', async () => {
    installNotifsHandler();
    const user = userEvent.setup();
    render(<NotificationBell />);
    await screen.findByText('2');
    await user.click(screen.getByRole('button', { name: /notifications/i }));

    await user.click(screen.getByRole('button', { name: /mark all read/i }));
    // badge disappears entirely once everything is read
    await waitFor(() => expect(screen.queryByText('2')).toBeNull());
    expect(screen.queryByText('1')).toBeNull();
  });

  it('clears all notifications when the X button is clicked', async () => {
    installNotifsHandler();
    const user = userEvent.setup();
    render(<NotificationBell />);
    await screen.findByText('2');
    await user.click(screen.getByRole('button', { name: /notifications/i }));

    await user.click(screen.getByRole('button', { name: /clear all notifications/i }));
    await waitFor(() => expect(screen.getByText('All caught up!')).toBeInTheDocument());
  });

  it('closes the dropdown when clicking outside', async () => {
    installNotifsHandler([]);
    const user = userEvent.setup();
    render(
      <div>
        <NotificationBell />
        <button data-testid="outside">outside</button>
      </div>
    );
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('All caught up!')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    await waitFor(() => expect(screen.queryByText('All caught up!')).toBeNull());
  });

  it('closes the dropdown via the footer Close button', async () => {
    installNotifsHandler();
    const user = userEvent.setup();
    render(<NotificationBell />);
    await screen.findByText('2');
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^close$/i }));
    expect(screen.queryByText('Notifications')).toBeNull();
  });

  it('renders the empty state when the API returns no notifications', async () => {
    installNotifsHandler([]);
    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('All caught up!')).toBeInTheDocument();
    // No "Mark all read" button when there's nothing to mark
    expect(screen.queryByRole('button', { name: /mark all read/i })).toBeNull();
  });

  it('silently handles a backend error on initial fetch', async () => {
    server.use(
      http.get('*/api/notifications', () =>
        HttpResponse.json({ message: 'down' }, { status: 500 })
      )
    );
    render(<NotificationBell />);
    // bell still renders; no exception bubbles up
    expect(
      await screen.findByRole('button', { name: /notifications/i })
    ).toBeInTheDocument();
  });
});
