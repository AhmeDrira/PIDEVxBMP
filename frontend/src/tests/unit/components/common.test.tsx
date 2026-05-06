/**
 * Lightweight tests for small reusable components in src/components/common.
 * Each test renders the component and asserts the contract its callers depend on.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Logo from '@/components/common/Logo';
import KPICard from '@/components/common/KPICard';
import StatsCard from '@/components/common/StatsCard';
import RoleGuard from '@/components/common/RoleGuard';
import ProductCard from '@/components/common/ProductCard';
import ConfirmationPopup from '@/components/common/ConfirmationPopup';
import DarkModeToggle from '@/components/common/DarkModeToggle';

// Mock next-themes for DarkModeToggle
let resolvedThemeMock = 'light';
const setThemeSpy = vi.fn((next: string) => {
  resolvedThemeMock = next;
});
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: resolvedThemeMock, setTheme: setThemeSpy }),
}));

// Mock authService for RoleGuard
let currentUserMock: { role?: string } | null = null;
vi.mock('@/services/authService', () => ({
  default: {
    getCurrentUser: () => currentUserMock,
  },
}));

// ---------- Logo -------------------------------------------------------------

describe('Logo', () => {
  it('renders bmp.tn brand and tagline by default', () => {
    render(<Logo />);
    expect(screen.getByText('bmp.tn')).toBeInTheDocument();
    expect(screen.getByText('Plateforme Construction')).toBeInTheDocument();
    expect(screen.getByAltText('BMP.tn Logo')).toBeInTheDocument();
  });

  it('uses light variant text colour', () => {
    render(<Logo variant="light" />);
    const heading = screen.getByText('bmp.tn');
    expect(heading.className).toMatch(/text-white/);
  });

  it.each([
    ['sm', 32],
    ['md', 40],
    ['lg', 48],
  ] as const)('respects %s size', (size, px) => {
    render(<Logo size={size} />);
    const img = screen.getByAltText('BMP.tn Logo') as HTMLImageElement;
    expect(img.width).toBe(px);
    expect(img.height).toBe(px);
  });
});

// ---------- KPICard ----------------------------------------------------------

describe('KPICard', () => {
  it('renders label, value and subtitle', () => {
    render(
      <KPICard
        label="Active Users"
        value={1234}
        icon={<svg data-testid="icon" />}
        color="#1e40af"
        subtitle="Last 30 days"
      />
    );
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders trend with up/down indicator', () => {
    const { rerender } = render(
      <KPICard label="Up" value="$100" icon={null} color="#000" trend="+12%" />
    );
    expect(screen.getByText('+12%')).toBeInTheDocument();

    rerender(
      <KPICard label="Down" value="$80" icon={null} color="#000" trend="-5%" trendUp={false} />
    );
    expect(screen.getByText('-5%')).toBeInTheDocument();
  });
});

// ---------- StatsCard --------------------------------------------------------

describe('StatsCard', () => {
  it('renders the card and reacts to onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <StatsCard label="Orders" value={42} icon={null} color="#000" onClick={onClick} />
    );
    expect(screen.getByText('Orders')).toBeInTheDocument();
    await user.click(screen.getByText('42'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows the active ring when isActive is true', () => {
    const { container } = render(
      <StatsCard label="X" value="Y" icon={null} color="#000" isActive />
    );
    expect(container.querySelector('.ring-2')).toBeInTheDocument();
  });

  it('renders trend down indicator when trendUp is false', () => {
    render(
      <StatsCard label="X" value="Y" icon={null} color="#000" trend="-3%" trendUp={false} />
    );
    expect(screen.getByText('-3%')).toBeInTheDocument();
  });
});

// ---------- RoleGuard --------------------------------------------------------

describe('RoleGuard', () => {
  it('renders children when role is allowed', () => {
    currentUserMock = { role: 'artisan' };
    render(
      <RoleGuard allow={['artisan', 'expert']}>
        <span data-testid="ok">visible</span>
      </RoleGuard>
    );
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('renders nothing when role is not allowed', () => {
    currentUserMock = { role: 'manufacturer' };
    render(
      <RoleGuard allow={['artisan']}>
        <span data-testid="hidden">no</span>
      </RoleGuard>
    );
    expect(screen.queryByTestId('hidden')).toBeNull();
  });

  it('renders nothing when there is no current user', () => {
    currentUserMock = null;
    render(
      <RoleGuard allow={['artisan']}>
        <span data-testid="hidden">no</span>
      </RoleGuard>
    );
    expect(screen.queryByTestId('hidden')).toBeNull();
  });
});

// ---------- ProductCard ------------------------------------------------------

describe('ProductCard', () => {
  const baseProps = {
    id: 1,
    name: 'Cement Mix',
    category: 'cement',
    price: 50,
    manufacturer: 'Acme',
    stock: 100,
    image: '/x.jpg',
    rating: 4.5,
    onAddToCart: vi.fn(),
    onViewDetails: vi.fn(),
  };

  it('renders product info', () => {
    render(<ProductCard {...baseProps} />);
    expect(screen.getByText('Cement Mix')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('50 TND')).toBeInTheDocument();
    expect(screen.getByText('100 units')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('cement')).toBeInTheDocument();
  });

  it('triggers onViewDetails when "View Details" is clicked', async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    render(<ProductCard {...baseProps} onViewDetails={onViewDetails} />);
    await user.click(screen.getByRole('button', { name: /view details/i }));
    expect(onViewDetails).toHaveBeenCalledWith(1);
  });

  it('triggers onAddToCart when the cart button is clicked', async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn();
    render(<ProductCard {...baseProps} onAddToCart={onAddToCart} />);
    const buttons = screen.getAllByRole('button');
    // The cart button is the second one (with the ShoppingCart icon)
    await user.click(buttons[1]);
    expect(onAddToCart).toHaveBeenCalledWith(1);
  });

  it.each([
    [60, /text-accent/],
    [20, /text-secondary/],
    [3, /text-destructive/],
  ])('uses correct stock colour for stock=%i', (stock, expected) => {
    render(<ProductCard {...baseProps} stock={stock} />);
    const stockText = screen.getByText(`${stock} units`);
    expect(stockText.className).toMatch(expected);
  });
});

// ---------- ConfirmationPopup -----------------------------------------------

describe('ConfirmationPopup', () => {
  const baseProps = {
    title: 'Are you sure?',
    message: 'This action cannot be undone.',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders title, message and both buttons', () => {
    render(<ConfirmationPopup {...baseProps} />);
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('triggers onConfirm and onCancel correctly', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmationPopup {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows loading dots and disables buttons during loading', () => {
    render(<ConfirmationPopup {...baseProps} loading />);
    const confirmBtn = screen.getByRole('button', { name: '…' });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('uses success colour when confirmVariant=success', () => {
    render(<ConfirmationPopup {...baseProps} confirmVariant="success" />);
    const btn = screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement;
    expect(btn.style.backgroundColor).toMatch(/rgb\(22, 163, 74\)/);
  });

  it('uses danger colour when confirmVariant=danger', () => {
    render(<ConfirmationPopup {...baseProps} confirmVariant="danger" />);
    const btn = screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement;
    expect(btn.style.backgroundColor).toMatch(/rgb\(220, 38, 38\)/);
  });

  it('falls back to localized "No" label when cancelLabel is not provided', () => {
    render(
      <ConfirmationPopup
        {...baseProps}
        cancelLabel={undefined}
      />
    );
    // default language is fr, fallback localized label is "Non"
    expect(screen.getByRole('button', { name: 'Non' })).toBeInTheDocument();
  });
});

// ---------- DarkModeToggle ---------------------------------------------------

describe('DarkModeToggle', () => {
  it('shows moon icon and switches to dark when clicked from light', async () => {
    resolvedThemeMock = 'light';
    setThemeSpy.mockClear();
    const user = userEvent.setup();
    render(<DarkModeToggle />);
    const btn = screen.getByRole('button', { name: /switch to dark mode/i });
    await user.click(btn);
    expect(setThemeSpy).toHaveBeenCalledWith('dark');
  });

  it('shows sun icon and switches back to light from dark', async () => {
    resolvedThemeMock = 'dark';
    setThemeSpy.mockClear();
    const user = userEvent.setup();
    render(<DarkModeToggle />);
    const btn = screen.getByRole('button', { name: /switch to light mode/i });
    await user.click(btn);
    expect(setThemeSpy).toHaveBeenCalledWith('light');
  });
});
