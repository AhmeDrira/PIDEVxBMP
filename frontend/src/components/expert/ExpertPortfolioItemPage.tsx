import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { ArrowLeft, MapPin, Calendar, CheckCircle, ImageIcon } from 'lucide-react';

interface ExpertPortfolioItemPageProps {
  artisanId: string;
  itemId: string;
  artisanName: string;
  onBack: () => void;
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
  source?: string;
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

export default function ExpertPortfolioItemPage({ artisanId, itemId, artisanName, onBack }: ExpertPortfolioItemPageProps) {
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchItem = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/artisans/${artisanId}/portfolio/${itemId}`);
        setItem(response.data);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load portfolio item');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [artisanId, itemId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
          <ArrowLeft size={20} className="mr-2" /> Back to Portfolio
        </Button>
        <p className="text-sm text-muted-foreground py-10 text-center">Loading project details...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
          <ArrowLeft size={20} className="mr-2" /> Back to Portfolio
        </Button>
        <p className="text-sm text-red-500 text-center py-6">{error || 'Item not found'}</p>
      </div>
    );
  }

  const images = (item.media || []).filter(m => m.type === 'image');
  const videos = (item.media || []).filter(m => m.type === 'video');

  return (
    <div className="space-y-6 pb-12">
      {/* Back button */}
      <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
        <ArrowLeft size={20} className="mr-2" /> Back to Portfolio
      </Button>

      {/* Main white card */}
      <div style={{ background: 'var(--card)', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '36px 40px' }}>

        {/* Title & description */}
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--foreground)', marginBottom: 14, lineHeight: 1.2 }}>
          {item.title}
        </h1>
        {item.description && (
          <p style={{ fontSize: 15, color: 'var(--foreground)', lineHeight: 1.85, maxWidth: 900, marginBottom: 32 }}>
            {item.description}
          </p>
        )}

        {/* Info cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 40 }}>
          {item.location && (
            <div style={{ background: '#EEF2FF', borderRadius: 16, padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <MapPin size={17} style={{ color: '#6366f1' }} />
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>Location</span>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{item.location}</p>
            </div>
          )}

          {item.completedDate && (
            <div style={{ background: '#ECFDF5', borderRadius: 16, padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Calendar size={17} style={{ color: '#10b981' }} />
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>Completed</span>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                {new Date(item.completedDate).toLocaleDateString('en-GB')}
              </p>
            </div>
          )}

          <div style={{ background: '#FFF7ED', borderRadius: 16, padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <CheckCircle size={17} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>Status</span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Completed</p>
          </div>
        </div>

        {/* Gallery */}
        {(images.length > 0 || videos.length > 0) && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ background: '#EEF2FF', borderRadius: 10, padding: 8, display: 'flex' }}>
                <ImageIcon size={20} style={{ color: '#6366f1' }} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Project Gallery</h2>
            </div>

            {images.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: videos.length > 0 ? 32 : 0 }}>
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    style={{ borderRadius: 14, overflow: 'hidden', aspectRatio: '4/3', background: 'var(--muted)', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}
                  >
                    <img
                      src={resolveMediaUrl(img.url)}
                      alt={`${item.title} — image ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s' }}
                      loading="lazy"
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    />
                  </div>
                ))}
              </div>
            )}

            {videos.length > 0 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>Videos</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                  {videos.map((vid, idx) => (
                    <div
                      key={idx}
                      style={{ borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9', background: 'var(--foreground)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                    >
                      <video
                        src={resolveMediaUrl(vid.url)}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        controls
                        playsInline
                        preload="metadata"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {item.media.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
            <ImageIcon size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <p style={{ fontSize: 15 }}>No media available for this project.</p>
          </div>
        )}
      </div>
    </div>
  );
}
