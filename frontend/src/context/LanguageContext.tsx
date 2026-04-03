import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { translations } from '../locales';

export type Language = 'fr' | 'en' | 'ar';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'fr',
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('app-language') as Language) || 'fr';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  };

  // Sync HTML attributes whenever language changes
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = useCallback((key: string): string => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export const LANGUAGE_LABELS: Record<Language, { label: string; flag: string; native: string }> = {
  fr: { label: 'Français', flag: '\u{1F1EB}\u{1F1F7}', native: 'Français' },
  en: { label: 'English',  flag: '\u{1F1EC}\u{1F1E7}', native: 'English'  },
  ar: { label: 'Arabic',   flag: '\u{1F1F9}\u{1F1F3}', native: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629'  },
};
