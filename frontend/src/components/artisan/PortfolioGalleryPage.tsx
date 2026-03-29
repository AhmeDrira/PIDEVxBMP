import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, ImageIcon, Film, ImageOff, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, '');

interface PortfolioMedia {
  type: 'image' | 'video';
  url: string;
}

interface PortfolioItem {
  _id: string;
  title: string;
  description: string;
  media: PortfolioMedia[];
}

const resolveMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${BACKEND_ORIGIN}${url}`;
  return `${BACKEND_ORIGIN}/${url}`;
};

const getToken = () => {
  const direct = localStorage.getItem('token');
  if (direct) return direct;
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u)?.token || '' : '';
  } catch { return ''; }
};

interface PortfolioGalleryPageProps {
  itemId: string;
  onBack?: () => void;
}

export default function PortfolioGalleryPage({ itemId, onBack }: PortfolioGalleryPageProps) {
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const media = item?.media || [];
  const images = media.filter((m) => m.type === 'image');
  const videos = media.filter((m) => m.type === 'video');

  useEffect(() => {
    const fetchItem = async () => {
      try {
        setLoading(true);
        const token = getToken();
        if (!token) { setError('Session expired.'); setLoading(false); return; }
        const res = await axios.get(`${API_URL}/artisans/me/portfolio/${itemId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItem(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load portfolio item.');
      } finally {
        setLoading(false);
      }
    };
    if (itemId) fetchItem();
  }, [itemId]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex(i => i !== null ? (i + 1) % images.length : null);
      if (e.key === 'ArrowLeft') setLightboxIndex(i => i !== null ? (i - 1 + images.length) % images.length : null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, images.length]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.assign('/?artisanView=portfolio');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Loading gallery...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <ImageOff className="w-12 h-12 text-red-300" />
        <p className="text-red-500 font-medium">{error}</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <ImageOff className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">Portfolio item not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 font-medium text-sm transition-all"
          >
            <ArrowLeft size={16} />
            Back to Portfolio
          </button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{item.title}</h1>
            {item.description && (
              <p className="mt-1 text-gray-500 text-sm leading-relaxed line-clamp-2">{item.description}</p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 shrink-0">
            {images.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
                <ImageIcon size={15} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">{images.length} photo{images.length > 1 ? 's' : ''}</span>
              </div>
            )}
            {videos.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                <Film size={15} className="text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-700">{videos.length} video{videos.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-8">

        {media.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="p-5 bg-gray-100 rounded-full">
              <ImageOff className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium text-lg">No media for this project yet.</p>
          </div>
        )}

        {/* Photos Section */}
        {images.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Section Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="p-2 rounded-xl" style={{ backgroundColor: '#eff6ff' }}>
                <ImageIcon size={18} style={{ color: '#1e40af' }} />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Photos</h2>
                <p className="text-xs text-gray-400">{images.length} image{images.length > 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Grid */}
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {images.map((img, index) => (
                  <div
                    key={index}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                    onClick={() => setLightboxIndex(index)}
                  >
                    <img
                      src={resolveMediaUrl(img.url)}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 rounded-full p-2 shadow-md">
                        <ZoomIn size={16} className="text-gray-700" />
                      </div>
                    </div>
                    {/* Index badge */}
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-xs rounded-md px-1.5 py-0.5 font-medium">
                      {index + 1}/{images.length}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Videos Section */}
        {videos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="p-2 rounded-xl bg-indigo-50">
                <Film size={18} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Videos</h2>
                <p className="text-xs text-gray-400">{videos.length} video{videos.length > 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {videos.map((vid, index) => (
                  <div
                    key={index}
                    className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-200 shadow-sm"
                    style={{ aspectRatio: '16/9' }}
                  >
                    <video
                      src={resolveMediaUrl(vid.url)}
                      className="w-full h-full object-contain"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            onClick={() => setLightboxIndex(null)}
          >
            <X size={22} />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/40 text-white text-sm font-medium backdrop-blur-sm">
            {lightboxIndex + 1} / {images.length}
          </div>

          {/* Prev */}
          {images.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + images.length) % images.length); }}
            >
              <ChevronLeft size={26} />
            </button>
          )}

          {/* Image */}
          <img
            src={resolveMediaUrl(images[lightboxIndex].url)}
            alt={`Photo ${lightboxIndex + 1}`}
            className="max-w-[90vw] max-h-[88vh] object-contain rounded-lg shadow-2xl select-none"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />

          {/* Next */}
          {images.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % images.length); }}
            >
              <ChevronRight size={26} />
            </button>
          )}

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-2 rounded-2xl bg-black/40 backdrop-blur-sm max-w-[80vw] overflow-x-auto">
              {images.map((img, i) => (
                <div
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 transition-all ${i === lightboxIndex ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={resolveMediaUrl(img.url)} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
