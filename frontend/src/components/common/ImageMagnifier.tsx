import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

interface ImageMagnifierProps {
  src?: string | null;
  alt?: string;
  className?: string;
  viewerClassName?: string;
  imageClassName?: string;
  zoomLevel?: number;
  hint?: string;
  showHint?: boolean;
  showPreviewPane?: boolean;
  imageFit?: 'cover' | 'contain';
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const ImageMagnifier: React.FC<ImageMagnifierProps> = ({
  src,
  alt = '',
  className = '',
  viewerClassName = '',
  imageClassName = '',
  zoomLevel = 2.35,
  hint = 'Survolez pour zoomer',
  showHint = true,
  showPreviewPane = false,
  imageFit = 'cover',
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });

  const hasImage = Boolean(src) && !hasError;
  const objectFitClass = imageFit === 'contain' ? 'object-contain' : 'object-cover';

  useEffect(() => {
    setHasError(false);
    setIsActive(false);
    setPosition({ x: 50, y: 50 });
  }, [src]);

  const updatePosition = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!viewerRef.current || !hasImage) return;

    const bounds = viewerRef.current.getBoundingClientRect();
    const x = clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100);
    const y = clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100);

    setPosition({ x, y });
  };

  const handleActivate = () => {
    if (hasImage) {
      setIsActive(true);
    }
  };

  const handleDeactivate = () => {
    setIsActive(false);
    setPosition({ x: 50, y: 50 });
  };

  return (
    <div
      className={`${showPreviewPane ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]' : ''} ${className}`.trim()}
    >
      <div
        ref={viewerRef}
        className={`group relative overflow-hidden bg-slate-100 ${hasImage ? 'cursor-zoom-in' : 'cursor-default'} ${viewerClassName}`.trim()}
        onMouseEnter={handleActivate}
        onMouseMove={updatePosition}
        onMouseLeave={handleDeactivate}
      >
        {hasImage ? (
          <img
            src={src!}
            alt={alt}
            onError={() => setHasError(true)}
            className={`h-full w-full transition-transform duration-200 ease-out ${objectFitClass} ${imageClassName}`.trim()}
            style={{
              transform: isActive ? `scale(${zoomLevel})` : 'scale(1)',
              transformOrigin: `${position.x}% ${position.y}%`,
            }}
          />
        ) : (
          <div className="flex h-full min-h-[220px] w-full items-center justify-center bg-slate-100 px-6 text-center text-sm font-medium text-slate-500">
            Image indisponible
          </div>
        )}

        {hasImage && (
          <>
            <div
              className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                background: `radial-gradient(circle at ${position.x}% ${position.y}%, rgba(255,255,255,0.30), rgba(255,255,255,0.10) 20%, rgba(15,23,42,0.24) 68%)`,
              }}
            />

            <div
              className={`pointer-events-none absolute hidden h-28 w-28 rounded-full border border-white/80 bg-white/10 shadow-[0_12px_32px_rgba(15,23,42,0.22)] backdrop-blur-[1px] transition-all duration-150 md:block ${
                isActive ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
              }`}
              style={{
                left: `calc(${position.x}% - 3.5rem)`,
                top: `calc(${position.y}% - 3.5rem)`,
              }}
              aria-hidden="true"
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/12 to-transparent" />

            {showHint && (
              <div
                className={`pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-white/65 bg-slate-950/65 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition-all duration-200 ${
                  isActive ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
                }`}
              >
                <Search size={13} />
                <span>{hint}</span>
              </div>
            )}
          </>
        )}
      </div>

      {showPreviewPane && hasImage && (
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm xl:flex xl:flex-col">
          <div className="border-b border-slate-200/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Zoom live</p>
            <p className="mt-1 text-sm font-medium text-slate-800">Inspectez les details de la matiere</p>
          </div>
          <div className="relative min-h-[240px] flex-1 overflow-hidden bg-slate-100">
            <div
              className="absolute inset-0 bg-no-repeat transition-all duration-150 ease-out"
              style={{
                backgroundImage: `url("${src}")`,
                backgroundPosition: `${position.x}% ${position.y}%`,
                backgroundSize: `${zoomLevel * 100}%`,
              }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 to-transparent p-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                <Search size={12} />
                <span>{isActive ? `${zoomLevel.toFixed(1)}x active` : 'Placez le curseur sur l image'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
