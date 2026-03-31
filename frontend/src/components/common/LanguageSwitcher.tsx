import React, { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage, LANGUAGE_LABELS, Language } from '../../context/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 lg:p-3 rounded-xl hover:bg-muted dark:hover:bg-gray-800 flex items-center gap-1.5 transition-colors"
        aria-label="Change language"
      >
        <Globe size={20} className="text-muted-foreground" />
        <span className="hidden lg:inline text-xs font-semibold text-muted-foreground uppercase">
          {language}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-card dark:bg-gray-900 border border-border dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50">
          {(Object.entries(LANGUAGE_LABELS) as [Language, typeof LANGUAGE_LABELS[Language]][]).map(
            ([code, info]) => (
              <button
                key={code}
                onClick={() => { setLanguage(code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                  ${language === code
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:bg-muted/50 dark:hover:bg-gray-800'
                  }`}
              >
                <span className="text-base">{info.flag}</span>
                <span>{info.native}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
