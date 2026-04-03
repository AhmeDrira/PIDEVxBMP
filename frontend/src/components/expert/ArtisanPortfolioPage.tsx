import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ArrowLeft, MapPin, Calendar, ImageOff, Eye, ImageIcon, Film } from 'lucide-react';

import { useLanguage } from '../../context/LanguageContext';
interface ArtisanPortfolioPageProps {
  artisanId: string;
  artisanName: string;
  artisanDomain?: string;
  onBack: () => void;
  onViewItem: (itemId: string) => void;
}

interface PortfolioMedia {
  type: 'image' | 'video';
  url: string;
}

interface PortfolioItem {
  _id: string;
  title: string;
  description: string;
  location?: string;
  completedDate?: string;
  media: PortfolioMedia[];
}

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:5000';

const API_URL = `${API_BASE}/api`;

const resolveMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
};

export default function ArtisanPortfolioPage({ artisanId, artisanName, artisanDomain, onBack, onViewItem }: ArtisanPortfolioPageProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/artisans/${artisanId}/portfolio`);
        setPortfolio(response.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load portfolio');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [artisanId]);

  const getCoverMedia = (item: PortfolioItem) => {
    const image = item.media.find(m => m.type === 'image');
    if (image) return { type: 'image' as const, url: resolveMediaUrl(image.url) };
    const video = item.media.find(m => m.type === 'video');
    if (video) return { type: 'video' as const, url: resolveMediaUrl(video.url) };
    return null;
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
        <ArrowLeft size={20} className="mr-2" />
        Back to Profile
      </Button>

      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px' }}>
          {artisanName}'s Portfolio
        </h1>
        {artisanDomain && (
          <p style={{ fontSize: 15, color: 'var(--muted-foreground)' }}>{artisanDomain}</p>
        )}
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground py-10 text-center">Loading portfolio...</p>
      )}

      {error && (
        <p className="text-sm text-red-500 text-center py-6">{error}</p>
      )}

      {!loading && !error && portfolio.length === 0 && (
        <Card className="p-12 bg-card rounded-2xl border border-border shadow-lg text-center">
          <ImageOff size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-xl font-semibold text-muted-foreground">No portfolio items yet</p>
          <p className="text-muted-foreground mt-1">This artisan hasn't added any work to their portfolio.</p>
        </Card>
      )}

      {!loading && !error && portfolio.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {portfolio.map((item) => {
            const cover = getCoverMedia(item);
            const imageCount = item.media.filter(m => m.type === 'image').length;
            const videoCount = item.media.filter(m => m.type === 'video').length;

            return (
              <Card key={item._id} className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                {/* Cover media */}
                <div style={{ height: 200, background: 'var(--muted)', position: 'relative', overflow: 'hidden' }}>
                  {cover ? (
                    cover.type === 'image' ? (
                      <img
                        src={cover.url}
                        alt={item.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ) : (
                      <video
                        src={cover.url}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        preload="metadata"
                      />
                    )
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageOff size={40} className="text-gray-300" />
                    </div>
                  )}

                  {/* Media count badges */}
                  {(imageCount > 0 || videoCount > 0) && (
                    <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 6 }}>
                      {imageCount > 0 && (
                        <span style={{ background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: 20, padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ImageIcon size={12} /> {imageCount}
                        </span>
                      )}
                      {videoCount > 0 && (
                        <span style={{ background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: 20, padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Film size={12} /> {videoCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px' }}>{item.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 8px', lineHeight: 1.5 }}>
                    {item.description.length > 100 ? item.description.slice(0, 100) + '…' : item.description}
                  </p>

                  <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-foreground">
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {item.location}
                      </span>
                    )}
                    {item.completedDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(item.completedDate).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </div>

                  <Button
                    onClick={() => onViewItem(item._id)}
                    className="w-full h-10 text-white bg-primary hover:bg-primary/90 rounded-xl"
                  >
                    <Eye size={16} className="mr-2" />
                    View Gallery
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
