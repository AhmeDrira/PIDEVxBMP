import en from './en';
import fr from './fr';
import ar from './ar';
import type { Language } from '../context/LanguageContext';

export const translations: Record<Language, Record<string, string>> = { en, fr, ar };

export type TranslationKey = keyof typeof en;
