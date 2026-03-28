import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { ArrowLeft, ImageIcon, Film, ImageOff } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, '');

const resolveMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${BACKEND_ORIGIN}${url}`;
  return `${BACKEND_ORIGIN}/${url}`;
};

export default function ExpertPortfolioProjectPage({
  artisanId,
  itemId,
}: {
  artisanId: string;
  itemId: string;
}) {
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchItem = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/artisans/${artisanId}/portfolio/${itemId}`);
        setItem(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load project.');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [artisanId, itemId]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen text-slate-500">Loading project...</div>;
  }
  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
  }
  if (!item) {
    return <div className="flex justify-center items-center h-screen">Project not found.</div>;
  }

  const images = (item.media || []).filter((m: any) => m.type === 'image');
  const videos = (item.media || []).filter((m: any) => m.type === 'video');

  return (
    <div className="h-screen w-full bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-slate-200/80 bg-white/95 px-4 md:px-8 py-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] z-10 w-full relative backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <div className="w-full flex justify-start mb-2">
            <Button
              variant="outline"
              onClick={() => window.location.assign(`/portfolio/artisan/${artisanId}`)}
              className="h-10 rounded-xl border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-800 hover:border-slate-800 hover:text-white font-medium transition-all duration-300 shadow-sm"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Portfolio
            </Button>
          </div>
          <div className="w-full text-center max-w-4xl">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 break-words tracking-tight">
              {item.title}
            </h1>
            <p className="mx-auto mt-3 text-base md:text-lg text-slate-600 break-words leading-relaxed">
              {item.description || 'Project media gallery'}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 pb-24 scroll-smooth">
        <div className="max-w-7xl mx-auto space-y-16">
          {(item.media || []).length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <ImageOff className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No media available for this project.</p>
            </div>
          )}

          {images.length > 0 && (
            <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <ImageIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Photos</h2>
                  <p className="text-sm text-slate-500 font-medium">
                    {images.length} image{images.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {images.map((img: any, index: number) => (
                  <div
                    key={index}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
                  >
                    <img
                      src={resolveMediaUrl(img.url)}
                      alt={`Gallery image ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {videos.length > 0 && (
            <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                <div className="p-2.5 bg-purple-50 rounded-xl">
                  <Film className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Videos</h2>
                  <p className="text-sm text-slate-500 font-medium">
                    {videos.length} video{videos.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {videos.map((vid: any, index: number) => (
                  <div
                    key={index}
                    className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-200/50 shadow-md ring-1 ring-black/5"
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
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
