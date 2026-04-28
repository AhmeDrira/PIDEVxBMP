import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { server } from '../../setup/mswServer';

type SocketHandler = (...args: any[]) => void;

let activeSocket: {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  trigger: (event: string, payload?: unknown) => void;
} | null = null;

function createSocketMock() {
  const listeners = new Map<string, Set<SocketHandler>>();

  return {
    on: vi.fn((event: string, handler: SocketHandler) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)?.add(handler);
      return true;
    }),
    off: vi.fn((event: string, handler: SocketHandler) => {
      listeners.get(event)?.delete(handler);
      return true;
    }),
    trigger: (event: string, payload?: unknown) => {
      listeners.get(event)?.forEach((handler) => handler(payload));
    },
  };
}

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: activeSocket }),
}));

vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/common/ProfileDropdown', () => ({
  default: () => <div data-testid="profile-dropdown-mock" />,
}));

vi.mock('@/components/common/Logo', () => ({
  default: () => <div data-testid="logo-mock">logo</div>,
}));

vi.mock('@/components/common/Footer', () => ({
  default: () => <div data-testid="footer-mock">footer</div>,
}));

vi.mock('@/components/common/LanguageSwitcher', () => ({
  default: () => <div data-testid="language-switcher-mock" />,
}));

vi.mock('@/components/common/DarkModeToggle', () => ({
  default: () => <div data-testid="dark-mode-toggle-mock" />,
}));

const baseMenuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <span>DB</span> },
  { id: 'messages', label: 'Messages', icon: <span>MSG</span> },
  { id: 'quotes', label: 'Quotes', icon: <span>QT</span> },
];

function renderLayout(overrides?: Partial<ComponentProps<typeof DashboardLayout>>) {
  const onMenuItemClick = overrides?.onMenuItemClick || vi.fn();
  const onLogout = overrides?.onLogout || vi.fn();

  const view = render(
    <DashboardLayout
      menuItems={baseMenuItems}
      activeItem={overrides?.activeItem || 'dashboard'}
      onMenuItemClick={onMenuItemClick}
      onLogout={onLogout}
      userRole={overrides?.userRole || 'expert'}
      userName={overrides?.userName || 'Expert User'}
      onViewProfile={overrides?.onViewProfile || vi.fn()}
      onEditProfile={overrides?.onEditProfile || vi.fn()}
    >
      <div>dashboard-content</div>
    </DashboardLayout>
  );

  return { ...view, onMenuItemClick, onLogout };
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'layout-token-1');
    activeSocket = createSocketMock();
  });

  it('should fetch and display unread message count for expert users', async () => {
    // Arrange
    server.use(
      http.get('*/api/conversations', () =>
        HttpResponse.json([
          { _id: 'conv-1', unread: 2 },
          { _id: 'conv-2', unread: 1 },
        ])
      )
    );

    // Act
    renderLayout({ userRole: 'expert' });

    // Assert
    await waitFor(() => {
      expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    });
    expect(activeSocket?.on).toHaveBeenCalledWith('message:new', expect.any(Function));
  });

  it('should increment unread count when a new message socket event arrives', async () => {
    // Arrange
    server.use(
      http.get('*/api/conversations', () => HttpResponse.json([{ _id: 'conv-1', unread: 1 }]))
    );

    // Act
    renderLayout({ userRole: 'artisan' });
    await waitFor(() => {
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    });

    act(() => {
      activeSocket?.trigger('message:new');
    });

    // Assert
    await waitFor(() => {
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });
  });

  it('should trigger menu navigation and logout actions from user interactions', async () => {
    // Arrange
    server.use(http.get('*/api/conversations', () => HttpResponse.json([])));
    const user = userEvent.setup();
    const { onMenuItemClick, onLogout } = renderLayout({ userRole: 'expert' });

    // Act
    await user.click(screen.getAllByRole('button', { name: /quotes/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /layout.logout|logout/i })[0]);

    // Assert
    expect(onMenuItemClick).toHaveBeenCalledWith('quotes');
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('should not request unread conversations for non messaging roles', async () => {
    // Arrange
    let requestCount = 0;
    server.use(
      http.get('*/api/conversations', () => {
        requestCount += 1;
        return HttpResponse.json([{ _id: 'conv-1', unread: 5 }]);
      })
    );

    // Act
    renderLayout({ userRole: 'manufacturer' });

    // Assert
    await waitFor(() => {
      expect(requestCount).toBe(0);
    });
  });
});
