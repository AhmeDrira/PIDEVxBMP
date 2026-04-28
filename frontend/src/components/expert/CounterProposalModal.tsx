import { useState } from 'react';
import axios from 'axios';
import { X, ArrowRightLeft, CheckCircle, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NegotiationEntry {
  _id?: string;
  senderId: string | { _id: string; firstName: string; lastName: string };
  senderRole: 'expert' | 'artisan';
  proposedPrice: number;
  message?: string;
  createdAt: string;
}

interface Artisan {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhoto?: string;
  domain?: string;
}

interface Proposal {
  _id: string;
  artisanId: Artisan;
  expertId: string | object;
  description: string;
  localisation: string;
  proposedPrice: number;
  negotiatedPrice?: number | null;
  currentPrice?: number | null;
  lastProposedBy?: 'expert' | 'artisan' | null;
  negotiationHistory?: NegotiationEntry[];
  startDate: string;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:5000';
const API_URL = `${API_BASE}/api`;

const getToken = () => {
  const t = localStorage.getItem('token');
  if (t) return t;
  try { return JSON.parse(localStorage.getItem('user') || '{}').token || ''; }
  catch { return ''; }
};
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// ─── Artisan Avatar ───────────────────────────────────────────────────────────

function ArtisanAvatar({ artisan }: { artisan: Artisan }) {
  const initials = `${artisan.firstName?.[0] ?? ''}${artisan.lastName?.[0] ?? ''}`.toUpperCase();
  if (artisan.profilePhoto) {
    const src = artisan.profilePhoto.startsWith('http')
      ? artisan.profilePhoto
      : `${API_BASE}/${artisan.profilePhoto.replace(/^\/+/, '')}`;
    return (
      <img src={src} alt={initials}
        className="w-10 h-10 rounded-full object-cover ring-2 ring-border flex-shrink-0"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
      {initials}
    </div>
  );
}

// ─── Price trend icon ─────────────────────────────────────────────────────────

function PriceTrend({ current, previous }: { current: number; previous: number }) {
  if (current < previous) return <TrendingDown size={14} className="text-green-500" />;
  if (current > previous) return <TrendingUp size={14} className="text-red-500" />;
  return <Minus size={14} className="text-muted-foreground" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CounterProposalModalProps {
  proposal: Proposal;
  onClose: () => void;
  onSuccess: (updatedProposal: Proposal) => void;
}

export default function CounterProposalModal({ proposal, onSuccess, onClose }: CounterProposalModalProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const artisan      = proposal.artisanId;
  const latestPrice  = proposal.currentPrice ?? proposal.negotiatedPrice ?? proposal.proposedPrice;
  const history      = proposal.negotiationHistory ?? [];

  const [newPrice,    setNewPrice]    = useState('');
  const [msgText,     setMsgText]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);
  const [activeTab,   setActiveTab]   = useState<'form' | 'history'>('form');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const price = Number(newPrice);
    if (!newPrice || !Number.isFinite(price) || price <= 0) {
      setError(tr('Please enter a valid price.', 'Veuillez entrer un prix valide.', 'يرجى إدخال سعر صحيح.'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_URL}/proposals/${proposal._id}/counter`,
        { proposedPrice: price, message: msgText.trim() },
        { headers: authHeaders() }
      );
      onSuccess(res.data as Proposal);
      setSuccess(true);
      setTimeout(() => onClose(), 1800);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        tr('An error occurred. Please try again.', 'Une erreur est survenue. Veuillez réessayer.', 'حدث خطأ. يرجى المحاولة مجدداً.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && !submitting && onClose()}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border flex flex-col"
        style={{ maxHeight: 'min(90vh, 700px)' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-blue-500" />
            <h2 className="text-base font-bold text-foreground">
              {tr('Send a Counter-Offer', 'Envoyer une contre-offre', 'إرسال عرض مضاد')}
            </h2>
          </div>
          {!submitting && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── Tabs (form / history) ── */}
        {history.length > 0 && (
          <div className="flex border-b border-border flex-shrink-0">
            {(['form', 'history'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'form'
                  ? tr('New offer', 'Nouvelle offre', 'عرض جديد')
                  : tr('Negotiation history', 'Historique', 'سجل التفاوض') + ` (${history.length})`}
              </button>
            ))}
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* ── Success screen ── */}
          {success && (
            <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
              <CheckCircle size={52} className="text-green-500" />
              <p className="font-semibold text-foreground text-lg">
                {tr('Counter-offer sent!', 'Contre-offre envoyée !', 'تم إرسال العرض المضاد!')}
              </p>
              <p className="text-sm text-muted-foreground">
                {tr('The artisan has been notified.', 'L\'artisan a été notifié.', 'تم إشعار الحرفي.')}
              </p>
            </div>
          )}

          {/* ── Form tab ── */}
          {!success && activeTab === 'form' && (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Artisan info */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <ArtisanAvatar artisan={artisan} />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {artisan.firstName} {artisan.lastName}
                  </p>
                  {artisan.domain && (
                    <p className="text-xs text-muted-foreground">{artisan.domain}</p>
                  )}
                </div>
              </div>

              {/* Current price summary */}
              <div className="rounded-xl border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {tr('Initial price', 'Prix initial', 'السعر الأولي')}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {proposal.proposedPrice.toLocaleString()} TND
                  </span>
                </div>
                {latestPrice !== proposal.proposedPrice && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {tr('Current offer', 'Offre actuelle', 'العرض الحالي')}
                    </span>
                    <span className="text-sm font-bold text-blue-600">
                      {latestPrice.toLocaleString()} TND
                    </span>
                  </div>
                )}
                {proposal.lastProposedBy && (
                  <p className="text-xs text-muted-foreground">
                    {tr('Last proposed by', 'Dernière proposition de', 'آخر عرض من')}:{' '}
                    <span className="font-semibold">
                      {proposal.lastProposedBy === 'expert'
                        ? tr('you (expert)', 'vous (expert)', 'أنت (خبير)')
                        : tr('the artisan', 'l\'artisan', 'الحرفي')}
                    </span>
                  </p>
                )}
              </div>

              {/* New price input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {tr('Your new price (TND)', 'Votre nouveau prix (TND)', 'سعرك الجديد (TND)')} *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newPrice}
                  onChange={e => setNewPrice(e.target.value)}
                  placeholder={String(latestPrice)}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  autoFocus
                  required
                />
              </div>

              {/* Optional message */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {tr('Message (optional)', 'Message (optionnel)', 'رسالة (اختياري)')}
                </label>
                <textarea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder={tr(
                    'Explain your counter-offer…',
                    'Expliquez votre contre-offre…',
                    'اشرح عرضك المضاد…'
                  )}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                />
                <p className="text-xs text-muted-foreground text-right mt-1">{msgText.length}/500</p>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-1 border-t border-border">
                <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                  {tr('Cancel', 'Annuler', 'إلغاء')}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <ArrowRightLeft size={15} />
                  {submitting
                    ? tr('Sending…', 'Envoi…', 'جاري الإرسال…')
                    : tr('Send offer', 'Envoyer l\'offre', 'إرسال العرض')}
                </Button>
              </div>
            </form>
          )}

          {/* ── History tab ── */}
          {!success && activeTab === 'history' && (
            <div className="p-4 space-y-3">
              {/* Initial proposal as first entry */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                  E
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground">
                      {tr('Expert (initial offer)', 'Expert (offre initiale)', 'الخبير (العرض الأولي)')}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(proposal.createdAt ?? '').toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    {proposal.proposedPrice.toLocaleString()} TND
                  </p>
                </div>
              </div>

              {/* Negotiation entries */}
              {history.map((entry, i) => {
                const prevPrice = i === 0
                  ? proposal.proposedPrice
                  : history[i - 1].proposedPrice;
                const isExpert = entry.senderRole === 'expert';
                return (
                  <div
                    key={entry._id ?? i}
                    className={`flex items-start gap-3 p-3 rounded-xl border ${
                      isExpert
                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900'
                        : 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white ${
                      isExpert ? 'bg-blue-500' : 'bg-orange-500'
                    }`}>
                      {isExpert ? 'E' : 'A'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-foreground">
                          {isExpert
                            ? tr('Expert', 'Expert', 'الخبير')
                            : tr('Artisan', 'Artisan', 'الحرفي')}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">
                          {entry.proposedPrice.toLocaleString()} TND
                        </p>
                        <PriceTrend current={entry.proposedPrice} previous={prevPrice} />
                        <span className="text-xs text-muted-foreground">
                          ({entry.proposedPrice > prevPrice ? '+' : ''}{(entry.proposedPrice - prevPrice).toLocaleString()} TND)
                        </span>
                      </div>
                      {entry.message && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{entry.message}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
