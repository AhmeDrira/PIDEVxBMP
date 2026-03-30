import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'fr' | 'en' | 'ar';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'fr',
  setLanguage: () => {},
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

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export const LANGUAGE_LABELS: Record<Language, { label: string; flag: string; native: string }> = {
  fr: { label: 'Français', flag: '🇫🇷', native: 'Français' },
  en: { label: 'English',  flag: '🇬🇧', native: 'English'  },
  ar: { label: 'Arabic',   flag: '🇹🇳', native: 'العربية'  },
};
