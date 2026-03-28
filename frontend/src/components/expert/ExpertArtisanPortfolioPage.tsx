import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ArrowLeft, MapPin, Calendar, Image as ImageIcon, Video, ImageOff } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, '');

const resolveMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${BACKEND_ORIGIN}${url}`;
  return `${BACKEND_ORIGIN}/${url}`;
};

export default function ExpertArtisanPortfolioPage({ artisanId }: { artisanId: string }) {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [artisan, setArtisan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [portfolioRes, artisanRes] = await Promise.all([
          axios.get(`${API_URL}/artisans/${artisanId}/portfolio`),
          axios.get(`${API_URL}/artisans/${artisanId}`),
        ]);
        setPortfolio(portfolioRes.data || []);
        setArtisan(artisanRes.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load portfolio.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [artisanId]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen text-slate-500">Loading portfolio...</div>;
  }
  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
  }

  const artisanName = artisan ? `${artisan.firstName} ${artisan.lastName}` : 'Artisan';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/95 px-4 md:px-8 py-5 shadow-sm backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="mb-4 h-10 rounded-xl border-2 border-slate-200 hover:bg-slate-800 hover:border-slate-800 hover:text-white transition-all"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-3xl font-extrabold text-slate-900">{artisanName}'s Portfolio</h1>
          {artisan && (
            <p className="text-slate-500 mt-1">
              {artisan.domain}
              {artisan.location ? ` · ${artisan.location}` : ''}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 lg:p-12">
        {portfolio.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <ImageOff className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">No portfolio items yet.</p>
            <p className="text-sm mt-1">This artisan hasn't added any work to their portfolio.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolio.map((item: any) => {
              const cover = item.media?.[0];
              const imageCount = (item.media || []).filter((m: any) => m.type === 'image').length;
              const videoCount = (item.media || []).filter((m: any) => m.type === 'video').length;

              return (
                <Card
                  key={item._id}
                  className="overflow-hidden bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    {cover ? (
                      cover.type === 'video' ? (
                        <video
                          src={resolveMediaUrl(cover.url)}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={resolveMediaUrl(cover.url)}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ImageIcon size={22} className="mr-2" /> No media
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-3">
                    <h3 className="text-xl font-bold text-foreground">{item.title}</h3>
                    <p className="text-muted-foreground text-sm line-clamp-2">{item.description}</p>

                    {item.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin size={14} /> {item.location}
                      </div>
                    )}
                    {item.completedDate && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar size={14} />
                        {new Date(item.completedDate).toLocaleDateString('en-GB')}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <ImageIcon size={14} /> {imageCount} image{imageCount !== 1 ? 's' : ''}
                      </div>
                      <div className="flex items-center gap-1">
                        <Video size={14} /> {videoCount} video{videoCount !== 1 ? 's' : ''}
                      </div>
                    </div>

                    <Button
                      className="w-full rounded-xl bg-primary text-white hover:bg-primary/90"
                      onClick={() =>
                        window.location.assign(`/portfolio/artisan/${artisanId}/project/${item._id}`)
                      }
                    >
                      View Project
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
