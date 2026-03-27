import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Loader2 } from 'lucide-react';

// Fix default marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Tunisia bounds — map is locked inside these
const TUNISIA_BOUNDS: L.LatLngBoundsExpression = [
  [30.0, 7.0],
  [37.5, 11.5],
];
const TUNISIA_CENTER: [number, number] = [33.8869, 9.5375];

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr,en`,
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

interface LocationMapPickerProps {
  /** Currently selected address string */
  value: string;
  /** Called with the resolved address whenever user picks a new point */
  onChange: (address: string) => void;
  /** Height of the map area (default 320px) */
  height?: number;
}

export function LocationMapPicker({ value, onChange, height = 320 }: LocationMapPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const handlePick = async (lat: number, lng: number) => {
    setPosition([lat, lng]);
    setIsResolving(true);
    try {
      const address = await reverseGeocode(lat, lng);
      onChange(address);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="w-full rounded-xl overflow-hidden border-2 border-gray-200 focus-within:border-primary transition-colors">
      {/* Instruction bar */}
      <div className="px-3 py-2 bg-primary/5 border-b border-gray-200 flex items-center gap-2">
        <MapPin size={14} className="text-primary flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Click anywhere on the map to set your location
        </p>
      </div>

      {/* Map */}
      <div style={{ height }}>
        <MapContainer
          center={TUNISIA_CENTER}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          maxBounds={TUNISIA_BOUNDS}
          maxBoundsViscosity={1.0}
          minZoom={5}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapResizer />
          <MapClickHandler onPick={handlePick} />
          {position && <Marker position={position} />}
        </MapContainer>
      </div>

      {/* Selected address display */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 min-h-[36px] flex items-center gap-2">
        {isResolving ? (
          <>
            <Loader2 size={14} className="animate-spin text-primary flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Resolving address…</span>
          </>
        ) : value ? (
          <>
            <MapPin size={14} className="text-primary flex-shrink-0 mt-0.5" />
            <span className="text-xs text-foreground line-clamp-2">{value}</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground italic">No location selected</span>
        )}
      </div>
    </div>
  );
}
