import { describe, expect, it } from 'vitest';
import { cn } from '@/components/ui/utils';

describe('ui utils', () => {
  it('should merge static and conditional class names', () => {
    // Arrange
    const isActive = true;

    // Act
    const result = cn('base', isActive && 'active', undefined, false && 'hidden', 'extra');

    // Assert
    expect(result).toContain('base');
    expect(result).toContain('active');
    expect(result).toContain('extra');
  });

  it('should keep the latest Tailwind class when conflicts exist', () => {
    // Arrange
    const classNames = ['p-2', 'text-sm', 'p-4', 'text-base'];

    // Act
    const result = cn(...classNames);

    // Assert
    expect(result).toContain('p-4');
    expect(result).toContain('text-base');
    expect(result).not.toContain('p-2');
    expect(result).not.toContain('text-sm');
  });
});
