import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';

// Fix for default marker icon in Leaflet with React
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

// Tunisia bounds (approximate)
const TUNISIA_BOUNDS: L.LatLngBoundsExpression = [
  [30.0, 7.0], // Southwest
  [37.5, 11.5] // Northeast
];

const TUNISIA_CENTER: [number, number] = [33.8869, 9.5375];

interface MapLocationPickerProps {
  value: string;
  onChange: (address: string, latlng?: { lat: number, lng: number }) => void;
  onClose?: () => void;
}

// Component to handle map clicks
function LocationMarker({ position, setPosition, setAddress }: { 
  position: [number, number] | null, 
  setPosition: (pos: [number, number]) => void,
  setAddress: (addr: string) => void
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      reverseGeocode(lat, lng, setAddress);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

// Component to update map view
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

async function reverseGeocode(lat: number, lng: number, setAddress: (addr: string) => void) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr,en`
    );
    const data = await response.json();
    setAddress(data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  } catch (error) {
    console.error('Reverse geocoding error:', error);
  }
}

export function MapLocationPicker({ value, onChange, onClose }: MapLocationPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [address, setAddress] = useState(value);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(TUNISIA_CENTER);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      // Search restricted to Tunisia area
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=tn&limit=1`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setPosition(newPos);
        setMapCenter(newPos);
        setAddress(display_name);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    onChange(address, position ? { lat: position[0], lng: position[1] } : undefined);
    if (onClose) onClose();
  };

  // Force Leaflet to recalculate size when mounted
  const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }, [map]);
    return null;
  };

  return (
    <div className="flex flex-col gap-4 h-[500px] w-full bg-card rounded-xl overflow-hidden border shadow-sm">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <MapPin size={18} className="text-primary" />
            Select Location in Tunisia
          </h4>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X size={20} />
            </Button>
          )}
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search city, street, or place in Tunisia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 h-11"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching} className="h-11 px-6">
            {isSearching ? <Loader2 className="animate-spin" size={18} /> : 'Search'}
          </Button>
        </div>
      </div>

      <div className="flex-1 relative z-0">
        <MapContainer
          center={mapCenter}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          maxBounds={TUNISIA_BOUNDS}
          minZoom={6}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapResizer />
          <ChangeView center={mapCenter} />
          <LocationMarker position={position} setPosition={setPosition} setAddress={setAddress} />
        </MapContainer>
      </div>

      <div className="p-4 border-t bg-muted/50 flex flex-col gap-3">
        <div className="text-sm text-muted-foreground flex items-start gap-2">
          <MapPin size={14} className="mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{address || 'Click on the map to select a location'}</span>
        </div>
        <Button 
          onClick={handleConfirm} 
          disabled={!address} 
          className="w-full h-11 font-semibold"
        >
          Confirm Location
        </Button>
      </div>
    </div>
  );
}
