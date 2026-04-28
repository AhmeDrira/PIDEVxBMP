import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  MapPin, Calendar, Banknote, User, Send, RefreshCw, Clock,
  CheckCircle, XCircle, AlertCircle, FileSignature, ArrowRightLeft,
  ChevronDown, ChevronUp, MessageCircle, Trash2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import CounterProposalModal from './CounterProposalModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NegotiationEntry {
  _id?: string;
  senderId: string | object;
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
  status: 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'signed';
  createdAt: string;
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

const getCurrentUserId = (): string => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return u._id || u.id || '';
  } catch { return ''; }
};

const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// ─── Status config ────────────────────────────────────────────────────────────

type StatusKey = Proposal['status'];

const STATUS_STYLES: Record<StatusKey, string> = {
  pending:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  negotiating: 'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-300',
  accepted:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected:    'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-300',
  signed:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, tr }: {
  status: StatusKey;
  tr: (en: string, fr: string, ar?: string) => string;
}) {
  const labels: Record<StatusKey, string> = {
    pending:     tr('Pending',     'En attente',    'قيد الانتظار'),
    negotiating: tr('Negotiating', 'En négociation','قيد التفاوض'),
    accepted:    tr('Accepted',    'Acceptée',      'مقبول'),
    rejected:    tr('Rejected',    'Refusée',       'مرفوض'),
    signed:      tr('Signed',      'Signée',        'موقع'),
  };
  const icons: Record<StatusKey, React.ReactNode> = {
    pending:     <Clock size={12} />,
    negotiating: <ArrowRightLeft size={12} />,
    accepted:    <CheckCircle size={12} />,
    rejected:    <XCircle size={12} />,
    signed:      <FileSignature size={12} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {icons[status]}
      {labels[status]}
    </span>
  );
}

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
      {initials || <User size={16} />}
    </div>
  );
}

// ─── Negotiation History Inline ───────────────────────────────────────────────

function NegotiationHistory({ proposal, tr }: {
  proposal: Proposal;
  tr: (en: string, fr: string, ar?: string) => string;
}) {
  const history = proposal.negotiationHistory ?? [];
  if (history.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {tr('Negotiation history', 'Historique de négociation', 'سجل التفاوض')}
      </p>
      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
        {/* Initial entry */}
        <div className="flex items-start gap-2 text-xs p-2 rounded-lg bg-muted/30">
          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">E</span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-foreground">{tr('Initial offer', 'Offre initiale', 'العرض الأولي')}: </span>
            <span className="text-foreground font-bold">{proposal.proposedPrice.toLocaleString()} TND</span>
          </div>
        </div>
        {history.map((entry, i) => (
          <div key={entry._id ?? i}
            className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
              entry.senderRole === 'expert'
                ? 'bg-blue-50/60 dark:bg-blue-950/20'
                : 'bg-orange-50/60 dark:bg-orange-950/20'
            }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5 text-white ${
              entry.senderRole === 'expert' ? 'bg-blue-500' : 'bg-orange-500'
            }`}>
              {entry.senderRole === 'expert' ? 'E' : 'A'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-foreground">{entry.proposedPrice.toLocaleString()} TND</span>
                <span className="text-muted-foreground flex-shrink-0">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
              </div>
              {entry.message && (
                <p className="text-muted-foreground mt-0.5 italic truncate">"{entry.message}"</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Proposal Card ────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  tr,
  onCounter,
  onNavigateMessages,
  onHide,
}: {
  proposal: Proposal;
  tr: (en: string, fr: string, ar?: string) => string;
  onCounter: (p: Proposal) => void;
  onNavigateMessages: () => void;
  onHide: (id: string) => void;
}) {
  const artisan      = proposal.artisanId;
  const latestPrice  = proposal.currentPrice ?? proposal.negotiatedPrice ?? proposal.proposedPrice;
  const isNegotiated = latestPrice !== proposal.proposedPrice;
  const canCounter   = proposal.status === 'pending' || proposal.status === 'negotiating';
  const hasNewOffer  = proposal.status === 'negotiating' && proposal.lastProposedBy === 'artisan';
  const [expanded, setExpanded] = useState(false);

  const handleMessage = async () => {
    try {
      const token = getToken();
      const convRes = await axios.post(
        `${API_URL}/conversations`,
        { participantId: artisan._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const conversationId = convRes.data._id || convRes.data.id;
      localStorage.setItem('selectedConversationId', conversationId);
      onNavigateMessages();
    } catch {
      onNavigateMessages();
    }
  };

  return (
    <Card className="p-5 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <ArtisanAvatar artisan={artisan} />
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">
              {artisan.firstName} {artisan.lastName}
            </p>
            {artisan.domain && (
              <p className="text-xs text-muted-foreground truncate">{artisan.domain}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasNewOffer && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-2 py-0.5 animate-pulse">
              🔔 {tr('New offer', 'Nouvelle offre', 'عرض جديد')}
            </Badge>
          )}
          <StatusBadge status={proposal.status} tr={tr} />
        </div>
      </div>

      {/* ── Description ── */}
      <p className="text-sm text-foreground leading-relaxed line-clamp-2 mb-3">
        {proposal.description}
      </p>

      {/* ── Metadata ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm mb-3">
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          <MapPin size={14} className="flex-shrink-0 text-primary" />
          <span className="truncate">{proposal.localisation}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          <Banknote size={14} className="flex-shrink-0 text-green-600" />
          <span className="break-all min-w-0">
            {isNegotiated ? (
              <>
                <span className="line-through text-xs mr-1">{proposal.proposedPrice.toLocaleString()} TND</span>
                <span className="font-semibold text-green-600">{latestPrice.toLocaleString()} TND</span>
              </>
            ) : (
              <span className="font-semibold">{proposal.proposedPrice.toLocaleString()} TND</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          <Calendar size={14} className="flex-shrink-0 text-blue-500" />
          <span>{new Date(proposal.startDate).toLocaleDateString()}</span>
        </div>
      </div>

      {/* ── Negotiation history (expandable) ── */}
      {(proposal.negotiationHistory?.length ?? 0) > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {tr('Negotiation history', 'Historique de négociation', 'سجل التفاوض')}
            {` (${proposal.negotiationHistory!.length})`}
          </button>
          {expanded && <NegotiationHistory proposal={proposal} tr={tr} />}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border w-full">
        <Button
          variant="outline"
          onClick={handleMessage}
          className="h-9 text-xs rounded-xl flex items-center gap-1.5 flex-shrink-0"
        >
          <MessageCircle size={14} />
          {tr('Message', 'Message', 'رسالة')}
        </Button>
        {canCounter && (
          <Button
            onClick={() => onCounter(proposal)}
            className="h-9 text-xs rounded-xl text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 flex-shrink-0 shadow-md"
          >
            <ArrowRightLeft size={14} />
            {tr('Counter-offer', 'Contre-offre', 'عرض مضاد')}
          </Button>
        )}
        {proposal.status === 'accepted' && (
          <div className="flex items-center gap-1.5 text-green-600 text-xs font-semibold">
            <CheckCircle size={14} />
            {tr('Accepted by artisan', 'Acceptée par l\'artisan', 'قبلها الحرفي')}
          </div>
        )}
        {proposal.status === 'signed' && (
          <div className="flex items-center gap-1.5 text-purple-600 text-xs font-semibold">
            <FileSignature size={14} />
            {tr('Contract signed', 'Contrat signé', 'العقد موقع')}
          </div>
        )}
        {proposal.status === 'rejected' && (
          <div className="flex items-center gap-1.5 text-red-500 text-xs font-semibold">
            <XCircle size={14} />
            {tr('Rejected', 'Refusée', 'مرفوض')}
          </div>
        )}
      </div>

      {/* ── Footer: sent date + delete ── */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Send size={11} />
          <span>
            {tr('Sent on', 'Envoyée le', 'أُرسلت في')} {new Date(proposal.createdAt).toLocaleDateString()}
          </span>
        </div>
        <button
          onClick={() => onHide(proposal._id)}
          title={tr('Delete from my list', 'Supprimer de ma liste', 'حذف من قائمتي')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
        >
          <Trash2 size={13} />
          {tr('Delete', 'Supprimer', 'حذف')}
        </button>
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExpertProposalsProps {
  onNavigate?: (view: string) => void;
}

export default function ExpertProposals({ onNavigate }: ExpertProposalsProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const [proposals,     setProposals]     = useState<Proposal[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [filterStatus,  setFilterStatus]  = useState<StatusKey | 'all'>('all');
  const [counterTarget, setCounterTarget] = useState<Proposal | null>(null);

  const expertId = getCurrentUserId();

  const fetchProposals = async () => {
    if (!expertId) {
      setError(tr('Unable to identify user.', 'Impossible d\'identifier l\'utilisateur.', 'تعذّر التعرف على المستخدم.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/proposals/expert/${expertId}`, {
        headers: authHeaders(),
      });
      setProposals(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        tr('Failed to load proposals.', 'Impossible de charger les demandes.', 'فشل تحميل الطلبات.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProposals(); }, [expertId]);

  const handleProposalUpdated = (updated: Proposal) => {
    setProposals(prev => prev.map(p => p._id === updated._id ? updated : p));
    setCounterTarget(null);
  };

  const handleHide = async (id: string) => {
    try {
      await axios.put(`${API_URL}/proposals/${id}/hide`, {}, { headers: authHeaders() });
      setProposals(prev => prev.filter(p => p._id !== id));
    } catch {
      // silently ignore — UI already removed it optimistically above if needed
    }
  };

  // Count by status
  const counts = proposals.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const newOfferCount = proposals.filter(
    p => p.status === 'negotiating' && p.lastProposedBy === 'artisan'
  ).length;

  // Filter
  const filtered = filterStatus === 'all'
    ? proposals
    : proposals.filter(p => p.status === filterStatus);

  const filterTabs: { key: StatusKey | 'all'; labelEn: string; labelFr: string; labelAr: string }[] = [
    { key: 'all',         labelEn: 'All',         labelFr: 'Toutes',          labelAr: 'الكل' },
    { key: 'pending',     labelEn: 'Pending',     labelFr: 'En attente',      labelAr: 'قيد الانتظار' },
    { key: 'negotiating', labelEn: 'Negotiating', labelFr: 'En négociation',  labelAr: 'قيد التفاوض' },
    { key: 'accepted',    labelEn: 'Accepted',    labelFr: 'Acceptées',       labelAr: 'مقبول' },
    { key: 'signed',      labelEn: 'Signed',      labelFr: 'Signées',         labelAr: 'موقع' },
    { key: 'rejected',    labelEn: 'Rejected',    labelFr: 'Refusées',        labelAr: 'مرفوض' },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('My Proposals', 'Mes propositions', 'مقترحاتي')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'Project proposals you have sent to artisans.',
              'Propositions de projets envoyées aux artisans.',
              'مقترحات المشاريع التي أرسلتها للحرفيين.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {newOfferCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs px-3 py-1.5 animate-pulse">
              🔔 {newOfferCount} {tr('new offer(s)', 'nouvelle(s) offre(s)', 'عرض جديد')}
            </Badge>
          )}
          <Button
            onClick={fetchProposals}
            variant="outline"
            className="rounded-xl flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {tr('Refresh', 'Actualiser', 'تحديث')}
          </Button>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map(tab => {
          const count = tab.key === 'all' ? proposals.length : (counts[tab.key] ?? 0);
          if (tab.key !== 'all' && count === 0) return null;
          return (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filterStatus === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tr(tab.labelEn, tab.labelFr, tab.labelAr)}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                filterStatus === tab.key ? 'bg-white/20' : 'bg-background'
              }`}>
                {count}
              </span>
              {tab.key === 'negotiating' && newOfferCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── States ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <RefreshCw size={32} className="animate-spin text-primary" />
          <p className="text-sm">{tr('Loading proposals…', 'Chargement des propositions…', 'جاري تحميل المقترحات…')}</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600">
          <AlertCircle size={20} className="flex-shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchProposals} className="ml-auto rounded-xl">
            {tr('Retry', 'Réessayer', 'إعادة المحاولة')}
          </Button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Send size={32} className="text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              {filterStatus === 'all'
                ? tr('No proposals sent yet', 'Aucune proposition envoyée', 'لا توجد مقترحات بعد')
                : tr('No proposals in this category', 'Aucune proposition dans cette catégorie', 'لا توجد مقترحات في هذه الفئة')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {filterStatus === 'all'
                ? tr(
                    'Browse the artisan directory to send project proposals.',
                    'Parcourez l\'annuaire des artisans pour envoyer des propositions.',
                    'تصفح دليل الحرفيين لإرسال مقترحات المشاريع.'
                  )
                : tr('Try selecting a different filter.', 'Essayez un autre filtre.', 'جرب فلترًا مختلفًا.')}
            </p>
          </div>
          {filterStatus === 'all' && onNavigate && (
            <Button
              onClick={() => onNavigate('directory')}
              className="rounded-xl text-white bg-primary hover:bg-primary/90 flex items-center gap-2"
            >
              <User size={15} />
              {tr('Browse artisans', 'Parcourir les artisans', 'تصفح الحرفيين')}
            </Button>
          )}
        </div>
      )}

      {/* ── Proposals grid ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map(proposal => (
            <ProposalCard
              key={proposal._id}
              proposal={proposal}
              tr={tr}
              onCounter={p => setCounterTarget(p)}
              onNavigateMessages={() => onNavigate?.('messages')}
              onHide={handleHide}
            />
          ))}
        </div>
      )}

      {/* ── Counter-proposal modal ── */}
      {counterTarget && (
        <CounterProposalModal
          proposal={counterTarget}
          onClose={() => setCounterTarget(null)}
          onSuccess={handleProposalUpdated}
        />
      )}
    </div>
  );
}
