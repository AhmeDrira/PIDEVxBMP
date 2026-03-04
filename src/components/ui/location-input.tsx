import React from 'react';
import { LocationMapPicker } from './location-map-picker';

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
  return (
    <div className={className}>
      <LocationMapPicker value={value} onChange={onChange} height={mapHeight} />
    </div>
  );
}

