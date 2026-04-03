import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import {
  Users, BookOpen, MessageSquare, Wallet, ArrowRight, Loader2,
  Star, ShoppingBag, TrendingUp, Award, Eye, Package, ChevronRight,
} from 'lucide-react';
import StatsCard from '../common/StatsCard';
import ViewArtisanProfile from './ViewArtisanProfile';
import ProfileCompletionBanner from '../common/ProfileCompletionBanner';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';

interface ExpertHomeProps {
  onNavigate: (view: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => {
  const direct = localStorage.getItem('token');
  if (direct) return direct;
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored).token : null;
  } catch { return null; }
};

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          style={{
            fill: s <= filled ? '#f59e0b' : 'var(--border)',
            color: s <= filled ? '#f59e0b' : 'var(--border)',
          }}
        />
      ))}
    </div>
  );
}

export default function ExpertHome({ onNavigate }: ExpertHomeProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const userStorage = localStorage.getItem('user');
  const user = userStorage ? JSON.parse(userStorage) : null;

  const [conversations, setConversations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [artisans, setArtisans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingArtisanId, setViewingArtisanId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = getToken();
        if (!token) return;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const [resConv, resProj, resPay, resArtisans] = await Promise.all([
          axios.get(`${API_URL}/conversations`, config).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/projects`, config).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/payments/product-payments`, config).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/artisans`).catch(() => ({ data: [] })),
        ]);
        setConversations(Array.isArray(resConv.data) ? resConv.data : []);
        setProjects(Array.isArray(resProj.data) ? resProj.data : []);
        setPayments(Array.isArray(resPay.data) ? resPay.data : []);
        setArtisans(Array.isArray(resArtisans.data) ? resArtisans.data : []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ─── Stats ───────────────────────────────────────────────────────────────
  const stats = [
    { label: tr('Active Projects', 'Projets actifs', 'المشاريع النشطة'), value: loading ? '…' : String(projects.length), icon: <BookOpen size={28} />, color: '#1E40AF' },
    { label: tr('Conversations', 'Conversations', 'المحادثات'), value: loading ? '…' : String(conversations.length), icon: <MessageSquare size={28} />, color: '#8B5CF6' },
    { label: tr('Artisan Network', 'Réseau d\'artisans', 'شبكة الحرفيين'), value: loading ? '…' : String(conversations.length), icon: <Users size={28} />, color: '#10B981' },
    { label: tr('Purchases', 'Achats', 'المشتريات'), value: loading ? '…' : String(payments.length), icon: <Wallet size={28} />, color: '#F59E0B' },
  ];

  // ─── Top Manufacturers ───────────────────────────────────────────────────
  const topManufacturers = (() => {
    const map = new Map<string, { id: string; name: string; initials: string; orders: number; totalAmount: number; totalItems: number }>();
    for (const payment of payments) {
      for (const item of payment.items || []) {
        const mfr = item.manufacturerId;
        if (!mfr) continue;
        const id = typeof mfr === 'object' ? mfr._id : String(mfr);
        const nameRaw = typeof mfr === 'object'
          ? (mfr.companyName || `${mfr.firstName || ''} ${mfr.lastName || ''}`.trim() || tr('Manufacturer', 'Fabricant', 'مُصنّع'))
          : tr('Manufacturer', 'Fabricant', 'مُصنّع');
        const initials = nameRaw.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'M';
        const existing = map.get(id) || { id, name: nameRaw, initials, orders: 0, totalAmount: 0, totalItems: 0 };
        existing.orders += 1;
        existing.totalAmount += (item.price || 0) * (item.quantity || 1);
        existing.totalItems += item.quantity || 1;
        map.set(id, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders).slice(0, 4);
  })();

  // ─── Top Artisans ────────────────────────────────────────────────────────
  const topArtisans = [...artisans]
    .sort((a, b) => {
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.reviewCount || 0) - (a.reviewCount || 0);
    })
    .slice(0, 5);

  // ─── Recent Conversations ────────────────────────────────────────────────
  const recentConnections = conversations.slice(0, 3).map((conv: any) => {
    const other = conv.participants?.find((p: any) => p._id !== user?._id);
    return {
      name: other ? `${other.firstName} ${other.lastName}` : tr('unknown', 'inconnu', 'غير معروف'),
      role: other?.role || tr('Artisan', 'Artisan', 'حرفي'),
      lastContact: conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString() : '—',
    };
  });

  const PALETTE = ['#1E40AF', '#7C3AED', '#059669', '#D97706', '#DC2626'];

  // ─── View artisan profile ────────────────────────────────────────────────
  if (viewingArtisanId) {
    return (
      <ViewArtisanProfile
        artisanId={viewingArtisanId}
        onBack={() => setViewingArtisanId(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      <ProfileCompletionBanner onNavigate={onNavigate} profileView="profile" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => <StatsCard key={i} {...stat} />)}
      </div>

      {/* Top row: Manufacturers + Top Artisans */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">

        {/* ── Top Manufacturers ── */}
        <Card className="p-0 bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          {/* White header */}
          <div className="px-6 pt-6 pb-5 bg-card" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(37,99,235,0.1)' }}>
                  <Package size={20} style={{ color: '#1e40af' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{tr('Top Manufacturers', 'Meilleurs fabricants', 'أفضل المصنعين')}</h2>
                  <p className="text-xs mt-0.5 text-muted-foreground">{tr('Your most loyal suppliers', 'Vos fournisseurs les plus fidèles', 'الموردين الأكثر ولاءً لك')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/50">
                <TrendingUp size={13} style={{ color: '#1e40af' }} />
                <span className="text-xs font-semibold" style={{ color: '#1e40af' }}>{tr('By Orders', 'Par commandes', 'حسب الطلبات')}</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
            ) : topManufacturers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <ShoppingBag size={36} className="text-gray-200" />
                <p className="text-sm text-muted-foreground font-medium">{tr('No purchases yet', 'Pas d\'achats pour le moment', 'لا توجد مشتريات حتى الآن')}</p>
                <Button size="sm" variant="outline" className="mt-1 rounded-xl text-xs" onClick={() => onNavigate('marketplace')}>
                  {tr('Browse Marketplace', 'Parcourir le marché', 'تصفح السوق')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {topManufacturers.map((mfr, index) => {
                  const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
                  return (
                    <div
                      key={mfr.id}
                      className="flex items-center gap-4 p-4 rounded-2xl border-2 border-transparent transition-all group bg-card"
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                    >
                      {/* Rank */}
                      <div className="shrink-0 w-8 text-center">
                        {medalEmoji
                          ? <span className="text-xl leading-none">{medalEmoji}</span>
                          : <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                        }
                      </div>

                      {/* Avatar circle - perfectly round */}
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md shrink-0 border-2 border-white dark:border-gray-700 aspect-square"
                        style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                      >
                        {mfr.initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground truncate text-sm">{mfr.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(37,99,235,0.1)', color: '#1e40af' }}>
                            {mfr.orders} {mfr.orders !== 1 ? tr('orders', 'commandes', 'طلبات') : tr('order', 'commande', 'طلب')}
                          </span>
                          <span className="text-xs text-muted-foreground">{mfr.totalItems} {tr('items', 'articles', 'عناصر')}</span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-extrabold" style={{ color: '#1e40af' }}>{mfr.totalAmount.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground font-medium">{tr('TND spent', 'TND dépensé', 'دينار تم إنفاقه')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* ── Top Artisans ── */}
        <Card className="p-0 bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          {/* White header */}
          <div className="px-6 pt-6 pb-5 bg-card" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(217,119,6,0.1)' }}>
                  <Award size={20} style={{ color: '#d97706' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{tr('Top Artisans', 'Meilleurs artisans', 'أفضل الحرفيين')}</h2>
                  <p className="text-xs mt-0.5 text-muted-foreground">{tr('Highest rated professionals', 'Professionnels les mieux notés', 'أعلى المهنيين المقيمين')}</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('directory')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-muted/50 hover:border-amber-300 dark:hover:bg-gray-800 transition-colors text-muted-foreground dark:text-gray-300"
              >
                {tr('View All', 'Voir tout', 'عرض الجميع')} <ChevronRight size={13} />
              </button>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin" style={{ color: '#f59e0b' }} /></div>
            ) : topArtisans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Users size={36} className="text-gray-200" />
                <p className="text-sm text-muted-foreground font-medium">{tr('No artisans found', 'Aucun artisan trouvé', 'لم يتم العثور على حرفيين')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topArtisans.map((artisan, index) => {
                  const artisanId = artisan._id || artisan.id;
                  const name = `${artisan.firstName || ''} ${artisan.lastName || ''}`.trim() || 'Artisan';
                  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'A';
                  const rating = artisan.rating || 0;
                  const reviews = artisan.reviewCount || 0;
                  const domain = artisan.domain || artisan.specialty || '';
                  const completed = artisan.completedProjects || 0;
                  const rankColors = ['#f59e0b', 'var(--muted-foreground)', '#b45309', '#1e40af', '#059669'];

                  return (
                    <button
                      key={artisanId}
                      onClick={() => setViewingArtisanId(artisanId)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-transparent hover:border-border hover:shadow-md transition-all group text-left bg-card"
                    >
                      {/* Rank circle */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                        style={{ backgroundColor: rankColors[index] || '#9ca3af' }}
                      >
                        {index === 0 ? '★' : index + 1}
                      </div>

                      {/* Avatar — fixed 44×44 px, strictly clipped */}
                      <div
                        className="shrink-0 border-2 border-border"
                        style={{
                          width: 44, height: 44, borderRadius: '50%',
                          overflow: 'hidden', position: 'relative',
                          backgroundColor: PALETTE[index % PALETTE.length],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 14, fontWeight: 700,
                        }}
                      >
                        {artisan.profilePhoto
                          ? <img src={artisan.profilePhoto} alt={name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initials
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm truncate group-hover:text-blue-700 transition-colors leading-tight">
                          {name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <StarRating rating={rating} />
                          <span className="text-xs font-bold" style={{ color: '#d97706' }}>{rating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">· {reviews} {reviews !== 1 ? tr('reviews', 'avis', 'تقييمات') : tr('review', 'avis', 'تقييم')}</span>
                        </div>
                        {domain && (
                          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(37,99,235,0.1)', color: '#1e40af' }}>
                            {domain}
                          </span>
                        )}
                      </div>

                      {/* Right */}
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {completed > 0 && (
                          <div className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(5,150,105,0.1)', color: '#15803d' }}>
                            {completed} {tr('done', 'terminé', 'مكتمل')}
                          </div>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <Eye size={12} style={{ color: '#1e40af' }} />
                          <span className="text-xs font-semibold" style={{ color: '#1e40af' }}>{tr('Profile', 'Profil', 'الملف الشخصي')}</span>
                          <ChevronRight size={12} style={{ color: '#1e40af' }} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Conversations */}
      <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{tr('Recent Conversations', 'Conversations récentes', 'المحادثات الأخيرة')}</h2>
            <p className="text-muted-foreground mt-1">{tr('Your artisan network', "Votre réseau d'artisans", 'شبكة الحرفيين الخاصة بك')}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => onNavigate('messages')}
            className="rounded-xl border-2 hover:border-primary hover:text-primary"
          >
            {tr('View All', 'Voir tout', 'عرض الجميع')} <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={32} className="animate-spin text-primary" /></div>
        ) : recentConnections.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{tr('No conversations yet. Connect with artisans!', "Pas encore de conversations. Connectez-vous avec des artisans!", 'لا توجد محادثات حتى الآن. تواصل مع الحرفيين!')}</p>
        ) : (
          <div className="space-y-4">
            {recentConnections.map((connection, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border-2 border-border hover:border-primary/20 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md"
                    style={{ backgroundColor: '#1E40AF' }}
                  >
                    {connection.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-lg">{connection.name}</h4>
                    <p className="text-sm text-muted-foreground capitalize">{connection.role === 'Artisan' ? tr('Artisan', 'Artisan', 'حرفي') : connection.role}</p>
                    <p className="text-sm text-muted-foreground">{connection.lastContact}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="rounded-xl border-2" onClick={() => onNavigate('messages')}>
                  {tr('Message', 'Message', 'رسالة')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
