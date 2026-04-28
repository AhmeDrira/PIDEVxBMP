import React, { createContext, useContext, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TextSize = 'small' | 'medium' | 'large' | 'xlarge';

interface AccessibilityContextValue {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue>({
  textSize: 'medium',
  setTextSize: () => {},
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEXT_SIZE_CLASSES: TextSize[] = ['small', 'medium', 'large', 'xlarge'];

function applyTextSize(size: TextSize) {
  const html = document.documentElement;
  TEXT_SIZE_CLASSES.forEach(s => html.classList.remove(`text-size-${s}`));
  html.classList.add(`text-size-${size}`);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>(() => {
    return (localStorage.getItem('text-size') as TextSize) || 'medium';
  });

  // Apply on mount
  useEffect(() => {
    applyTextSize(textSize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setTextSize = (size: TextSize) => {
    setTextSizeState(size);
    localStorage.setItem('text-size', size);
    applyTextSize(size);
  };

  return (
    <AccessibilityContext.Provider value={{ textSize, setTextSize }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAccessibility() {
  return useContext(AccessibilityContext);
}
