import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  AccessibilityProvider,
  useAccessibility,
} from '@/context/AccessibilityContext';

describe('AccessibilityContext', () => {
  it('useAccessibility() returns the default context value when no provider is mounted', () => {
    const { result } = renderHook(() => useAccessibility());
    expect(result.current.textSize).toBe('medium');
    expect(typeof result.current.setTextSize).toBe('function');
  });

  it('mounts with the value from localStorage and applies the corresponding html class', () => {
    localStorage.setItem('text-size', 'large');
    const wrapper = ({ children }: any) => (
      <AccessibilityProvider>{children}</AccessibilityProvider>
    );
    const { result } = renderHook(() => useAccessibility(), { wrapper });
    expect(result.current.textSize).toBe('large');
    expect(document.documentElement.classList.contains('text-size-large')).toBe(true);
  });

  it('falls back to "medium" when localStorage is empty', () => {
    localStorage.removeItem('text-size');
    const wrapper = ({ children }: any) => (
      <AccessibilityProvider>{children}</AccessibilityProvider>
    );
    const { result } = renderHook(() => useAccessibility(), { wrapper });
    expect(result.current.textSize).toBe('medium');
  });

  it('setTextSize updates state, localStorage and the html class set', () => {
    localStorage.removeItem('text-size');
    const wrapper = ({ children }: any) => (
      <AccessibilityProvider>{children}</AccessibilityProvider>
    );
    const { result } = renderHook(() => useAccessibility(), { wrapper });

    act(() => {
      result.current.setTextSize('xlarge');
    });

    expect(result.current.textSize).toBe('xlarge');
    expect(localStorage.getItem('text-size')).toBe('xlarge');
    expect(document.documentElement.classList.contains('text-size-xlarge')).toBe(true);

    // previous classes are removed
    expect(document.documentElement.classList.contains('text-size-medium')).toBe(false);
    expect(document.documentElement.classList.contains('text-size-large')).toBe(false);
    expect(document.documentElement.classList.contains('text-size-small')).toBe(false);
  });

  it('integrates with consumer components: clicking a button changes the size', async () => {
    const user = userEvent.setup();

    function Consumer() {
      const { textSize, setTextSize } = useAccessibility();
      return (
        <div>
          <span data-testid="size">{textSize}</span>
          <button onClick={() => setTextSize('small')}>shrink</button>
        </div>
      );
    }

    render(
      <AccessibilityProvider>
        <Consumer />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('size').textContent).toBe('medium');
    await user.click(screen.getByRole('button', { name: 'shrink' }));
    expect(screen.getByTestId('size').textContent).toBe('small');
    expect(document.documentElement.classList.contains('text-size-small')).toBe(true);
  });
});
