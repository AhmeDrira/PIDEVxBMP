/**
 * Smoke + behaviour tests for several lightweight UI primitives.
 * Each test renders the primitive and asserts the contract the rest of the app
 * relies on (data-slot, role, variant class, controlled state, etc.).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordInput } from '@/components/ui/password-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// ---------- Skeleton ---------------------------------------------------------

describe('Skeleton', () => {
  it('renders with the data-slot attribute and merges custom classes', () => {
    const { container } = render(<Skeleton className="custom-cls h-4" />);
    const el = container.querySelector('[data-slot="skeleton"]');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('custom-cls');
    expect(el).toHaveClass('animate-pulse');
  });
});

// ---------- Separator --------------------------------------------------------

describe('Separator', () => {
  it('renders horizontal by default', () => {
    const { container } = render(<Separator />);
    const el = container.querySelector('[data-slot="separator-root"]');
    expect(el).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('respects vertical orientation', () => {
    const { container } = render(<Separator orientation="vertical" />);
    const el = container.querySelector('[data-slot="separator-root"]');
    expect(el).toHaveAttribute('data-orientation', 'vertical');
  });
});

// ---------- Badge ------------------------------------------------------------

describe('Badge', () => {
  it('renders default variant text', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies destructive variant classes', () => {
    const { container } = render(<Badge variant="destructive">!</Badge>);
    const el = container.querySelector('[data-slot="badge"]')!;
    expect(el.className).toMatch(/destructive/);
  });

  it('renders as a different element when asChild is true', () => {
    render(
      <Badge asChild>
        <a href="/x">link badge</a>
      </Badge>
    );
    const link = screen.getByRole('link', { name: 'link badge' });
    expect(link).toBeInTheDocument();
  });
});

// ---------- Alert ------------------------------------------------------------

describe('Alert', () => {
  it('renders alert with role and child title/description', () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Pay attention</AlertDescription>
      </Alert>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Pay attention')).toBeInTheDocument();
  });

  it('applies destructive variant classes', () => {
    const { container } = render(
      <Alert variant="destructive">
        <AlertTitle>Boom</AlertTitle>
      </Alert>
    );
    const el = container.querySelector('[data-slot="alert"]')!;
    expect(el.className).toMatch(/destructive/);
  });
});

// ---------- Progress ---------------------------------------------------------

describe('Progress', () => {
  it('renders with the value applied as a transform style', () => {
    const { container } = render(<Progress value={42} />);
    const indicator = container.querySelector('[data-slot="progress-indicator"]')!;
    expect(indicator.getAttribute('style') || '').toContain('translateX(-58%)');
  });

  it('falls back to 0% when value is undefined', () => {
    const { container } = render(<Progress />);
    const indicator = container.querySelector('[data-slot="progress-indicator"]')!;
    expect(indicator.getAttribute('style') || '').toContain('translateX(-100%)');
  });
});

// ---------- Switch -----------------------------------------------------------

describe('Switch', () => {
  it('toggles its checked state on click', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="notif" />);
    const sw = screen.getByRole('switch', { name: 'notif' });
    expect(sw).toHaveAttribute('data-state', 'unchecked');
    await user.click(sw);
    expect(sw).toHaveAttribute('data-state', 'checked');
  });

  it('respects defaultChecked', () => {
    render(<Switch aria-label="x" defaultChecked />);
    expect(screen.getByRole('switch', { name: 'x' })).toHaveAttribute('data-state', 'checked');
  });
});

// ---------- Checkbox ---------------------------------------------------------

describe('Checkbox', () => {
  it('toggles on click', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="agree" />);
    const cb = screen.getByRole('checkbox', { name: 'agree' });
    expect(cb).toHaveAttribute('data-state', 'unchecked');
    await user.click(cb);
    expect(cb).toHaveAttribute('data-state', 'checked');
  });
});

// ---------- Tabs -------------------------------------------------------------

describe('Tabs', () => {
  it('shows the selected panel and switches on tab click', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>
    );
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    expect(screen.queryByText('Panel B')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Tab B' }));
    expect(screen.getByText('Panel B')).toBeInTheDocument();
  });
});

// ---------- PasswordInput ----------------------------------------------------

describe('PasswordInput', () => {
  it('toggles visibility when the eye button is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Password" />);

    const input = screen.getByPlaceholderText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');

    const showBtn = screen.getByRole('button', { name: /show password/i });
    await user.click(showBtn);
    expect(input.type).toBe('text');

    const hideBtn = screen.getByRole('button', { name: /hide password/i });
    await user.click(hideBtn);
    expect(input.type).toBe('password');
  });

  it('applies the error border when error is true', () => {
    render(<PasswordInput placeholder="Pwd" error />);
    const input = screen.getByPlaceholderText('Pwd');
    expect(input.className).toMatch(/border-red-500/);
  });
});

// ---------- RadioGroup -------------------------------------------------------

describe('RadioGroup', () => {
  it('changes selection on click', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a" aria-label="A" />
        <RadioGroupItem value="b" aria-label="B" />
      </RadioGroup>
    );
    const a = screen.getByRole('radio', { name: 'A' });
    const b = screen.getByRole('radio', { name: 'B' });
    expect(a).toHaveAttribute('data-state', 'checked');

    await user.click(b);
    expect(b).toHaveAttribute('data-state', 'checked');
    expect(a).toHaveAttribute('data-state', 'unchecked');
  });
});
