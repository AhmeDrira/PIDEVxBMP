import React from 'react';
import { LocationMapPicker } from './location-map-picker';

import { useLanguage } from '../../context/LanguageContext';
interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  /** Map height in pixels (default 300) */
  mapHeight?: number;
}

export function LocationInput({ value, onChange, mapHeight = 300, className }: LocationInputProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  return (
    <div className={className}>
      <LocationMapPicker value={value} onChange={onChange} height={mapHeight} />
    </div>
  );
}

