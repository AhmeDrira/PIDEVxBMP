import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';

function LanguageProbe() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div>
      <span data-testid="current-language">{language}</span>
      <span data-testid="translated-logout">{t('layout.logout')}</span>
      <button type="button" onClick={() => setLanguage('ar')}>
        set-ar
      </button>
      <button type="button" onClick={() => setLanguage('en')}>
        set-en
      </button>
    </div>
  );
}

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.removeItem('app-language');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('should provide default language and update document attributes when language changes', async () => {
    // Arrange
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'set-ar' }));

    // Assert
    expect(screen.getByTestId('current-language')).toHaveTextContent('ar');
    expect(localStorage.getItem('app-language')).toBe('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('should read persisted language and expose translations from the selected locale', () => {
    // Arrange
    localStorage.setItem('app-language', 'en');

    // Act
    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    );

    // Assert
    expect(screen.getByTestId('current-language')).toHaveTextContent('en');
    expect(screen.getByTestId('translated-logout')).toHaveTextContent(/logout/i);
  });
});
