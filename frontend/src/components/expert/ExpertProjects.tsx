import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  FolderKanban,
  MapPin,
  Calendar,
  Banknote,
  User,
  AlertCircle,
  RefreshCw,
  Clock,
  FileText,
  CheckCircle,
  Pen,
  ChevronDown,
  ChevronUp,
  X,
  MessageCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Artisan {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhoto?: string;
  domain?: string;
  location?: string;
}

interface Proposal {
  _id: string;
  artisanId: Artisan;
  expertId: string;
  description: string;
  localisation: string;
  proposedPrice: number;
  negotiatedPrice?: number | null;
  startDate: string;
  status: 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'signed';
  createdAt: string;
}

interface Contract {
  _id: string;
  content: string;
  status: 'draft' | 'pending_artisan_signature' | 'signed' | 'completed';
  signedByArtisanAt?: string | null;
  signatureData?: string | null;
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

// ─── Status styles ────────────────────────────────────────────────────────────

type StatusKey = Proposal['status'];

const STATUS_STYLES: Record<StatusKey, string> = {
  pending:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  negotiating: 'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300',
  accepted:    'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300',
  rejected:    'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-300',
  signed:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

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
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
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
      style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
      {initials || <User size={16} />}
    </div>
  );
}

// ─── Contract Modal ───────────────────────────────────────────────────────────

function ContractModal({
  contract,
  onClose,
  tr,
}: {
  contract: Contract;
  onClose: () => void;
  tr: (en: string, fr: string, ar?: string) => string;
}) {
  const [expanded, setExpanded] = useState(true);

  const contractStatusStyles: Record<Contract['status'], string> = {
    draft:                     'bg-gray-100   text-gray-700  dark:bg-gray-800  dark:text-gray-300',
    pending_artisan_signature: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    signed:                    'bg-green-100  text-green-700 dark:bg-green-900/30  dark:text-green-300',
    completed:                 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };
  const contractStatusLabels: Record<Contract['status'], string> = {
    draft:                     tr('Draft',               'Brouillon',               'مسودة'),
    pending_artisan_signature: tr('Awaiting signature',  'En attente de signature', 'بانتظار التوقيع'),
    signed:                    tr('Signed',              'Signé',                   'موقع'),
    completed:                 tr('Completed',           'Terminé',                 'مكتمل'),
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border flex flex-col" style={{ maxHeight: 'min(90vh, 100%)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            {tr('Contract', 'Contrat', 'عقد')} #{contract._id.slice(-6).toUpperCase()}
          </h2>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${contractStatusStyles[contract.status]}`}>
              {contract.status === 'signed' ? <CheckCircle size={12} /> : <Pen size={12} />}
              {contractStatusLabels[contract.status]}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {/* Signature info */}
          {contract.status === 'signed' && contract.signedByArtisanAt && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  {tr('Signed by the artisan', 'Signé par l\'artisan', 'وقّعه الحرفي')}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {new Date(contract.signedByArtisanAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {contract.status === 'pending_artisan_signature' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <Pen size={18} className="text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {tr(
                  'Waiting for the artisan\'s electronic signature.',
                  'En attente de la signature électronique de l\'artisan.',
                  'بانتظار التوقيع الإلكتروني للحرفي.'
                )}
              </p>
            </div>
          )}

          {/* Signature image */}
          {contract.signatureData && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                {tr('Artisan\'s signature', 'Signature de l\'artisan', 'توقيع الحرفي')}
              </p>
              <div className="border border-border rounded-xl p-3 bg-white dark:bg-slate-900 inline-block">
                <img
                  src={contract.signatureData}
                  alt="signature"
                  className="max-h-20 object-contain"
                />
              </div>
            </div>
          )}

          {/* Content collapsible */}
          <div className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium text-foreground"
            >
              <span className="flex items-center gap-2">
                <FileText size={14} />
                {tr('Contract content', 'Contenu du contrat', 'محتوى العقد')}
              </span>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expanded && (
              <pre className="p-4 text-sm text-foreground whitespace-pre-wrap break-words font-mono leading-relaxed bg-background overflow-x-hidden w-full">
                {contract.content}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            {tr('Close', 'Fermer', 'إغلاق')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Proposal Card ────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  tr,
  onViewContract,
  onMessage,
}: {
  proposal: Proposal;
  tr: (en: string, fr: string, ar?: string) => string;
  onViewContract: (proposalId: string) => void;
  onMessage: (artisanId: string) => void;
}) {
  const artisan    = proposal.artisanId;
  const finalPrice = proposal.negotiatedPrice ?? proposal.proposedPrice;
  const isNegotiated = proposal.negotiatedPrice != null && proposal.negotiatedPrice !== proposal.proposedPrice;
  const hasContract  = proposal.status === 'accepted' || proposal.status === 'signed';

  return (
    <Card className="p-5 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
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
        <StatusBadge status={proposal.status} tr={tr} />
      </div>

      {/* Description */}
      <p className="text-sm text-foreground leading-relaxed line-clamp-3 mb-4">
        {proposal.description}
      </p>

      {/* Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm mb-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin size={14} className="flex-shrink-0 text-primary" />
          <span className="truncate">{proposal.localisation}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Banknote size={14} className="flex-shrink-0 text-green-600" />
          <span>
            {isNegotiated ? (
              <>
                <span className="line-through text-xs mr-1 opacity-60">{proposal.proposedPrice.toLocaleString()} TND</span>
                <span className="font-semibold text-green-600">{finalPrice.toLocaleString()} TND</span>
              </>
            ) : (
              <span className="font-semibold">{finalPrice.toLocaleString()} TND</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar size={14} className="flex-shrink-0 text-blue-500" />
          <span>{new Date(proposal.startDate).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Actions */}
      {hasContract && (
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button
            onClick={() => onViewContract(proposal._id)}
            variant="outline"
            className="flex-1 h-9 text-sm rounded-xl border-primary/30 text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5"
          >
            <FileText size={14} />
            {tr('View contract', 'Voir le contrat', 'عرض العقد')}
          </Button>
          <Button
            onClick={() => onMessage(artisan._id)}
            variant="outline"
            className="h-9 px-3 text-sm rounded-xl flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <MessageCircle size={14} />
          </Button>
        </div>
      )}

      {/* Sent date */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
        <Clock size={12} />
        <span>
          {tr('Sent on', 'Envoyée le', 'أُرسلت في')} {new Date(proposal.createdAt).toLocaleDateString()}
        </span>
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExpertProjectsProps {
  onNavigate?: (view: string) => void;
}

const ALL_STATUSES: StatusKey[] = ['pending', 'negotiating', 'accepted', 'signed', 'rejected'];

export default function ExpertProjects({ onNavigate }: ExpertProjectsProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const [proposals, setProposals]       = useState<Proposal[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [activeFilter, setActiveFilter] = useState<StatusKey | 'all'>('all');
  const [contract, setContract]         = useState<Contract | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractError, setContractError]     = useState('');

  const expertId = getCurrentUserId();

  const fetchProposals = async () => {
    if (!expertId) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/proposals/expert/${expertId}`, { headers: authHeaders() });
      setProposals(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        tr('Failed to load projects.', 'Impossible de charger les projets.', 'فشل تحميل المشاريع.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProposals(); }, [expertId]);

  const handleViewContract = async (proposalId: string) => {
    setContractError('');
    setContractLoading(true);
    setContract(null);
    try {
      const res = await axios.get(`${API_URL}/contracts/by-proposal/${proposalId}`, { headers: authHeaders() });
      setContract(res.data);
    } catch (err: any) {
      setContractError(
        err?.response?.data?.message ||
        tr('Contract not found.', 'Contrat introuvable.', 'العقد غير موجود.')
      );
    } finally {
      setContractLoading(false);
    }
  };

  const handleMessage = async (artisanId: string) => {
    try {
      const res = await axios.post(
        `${API_URL}/conversations`,
        { participantId: artisanId },
        { headers: authHeaders() }
      );
      const convId = res.data._id || res.data.id;
      localStorage.setItem('selectedConversationId', convId);
    } catch { /* ignore */ }
    onNavigate?.('messages');
  };

  // Filtered list
  const filtered = activeFilter === 'all'
    ? proposals
    : proposals.filter(p => p.status === activeFilter);

  // Counts per status
  const counts = proposals.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const filterLabels: Record<StatusKey | 'all', string> = {
    all:         tr('All', 'Tous', 'الكل'),
    pending:     tr('Pending', 'En attente', 'قيد الانتظار'),
    negotiating: tr('Negotiating', 'En négociation', 'قيد التفاوض'),
    accepted:    tr('Accepted', 'Acceptées', 'مقبول'),
    signed:      tr('Signed', 'Signées', 'موقع'),
    rejected:    tr('Rejected', 'Refusées', 'مرفوض'),
  };

  return (
    <div className="space-y-6">
      {/* ── Title ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderKanban size={24} className="text-primary" />
            {tr('My Projects', 'Mes projets', 'مشاريعي')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'Proposals you sent to artisans.',
              'Demandes que vous avez envoyées aux artisans.',
              'الطلبات التي أرسلتها إلى الحرفيين.'
            )}
          </p>
        </div>
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

      {/* ── Filter tabs ── */}
      {proposals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(['all', ...ALL_STATUSES] as (StatusKey | 'all')[]).map(s => {
            const count = s === 'all' ? proposals.length : (counts[s] || 0);
            if (s !== 'all' && count === 0) return null;
            const isActive = activeFilter === s;
            return (
              <button
                key={s}
                onClick={() => setActiveFilter(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {filterLabels[s]}
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] ${
                  isActive ? 'bg-white/20' : 'bg-muted'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Contract loading/error inline banner ── */}
      {contractLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw size={14} className="animate-spin" />
          {tr('Loading contract…', 'Chargement du contrat…', 'جاري تحميل العقد…')}
        </div>
      )}
      {contractError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{contractError}</p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <RefreshCw size={32} className="animate-spin text-primary" />
          <p className="text-sm">{tr('Loading projects…', 'Chargement des projets…', 'جاري تحميل المشاريع…')}</p>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-5">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{tr('Error', 'Erreur', 'خطأ')}</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{error}</p>
            <Button onClick={fetchProposals} variant="outline"
              className="mt-3 h-8 text-xs rounded-lg border-red-300 text-red-600 hover:bg-red-50">
              {tr('Retry', 'Réessayer', 'إعادة المحاولة')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && proposals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <FolderKanban size={32} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {tr('No projects yet', 'Aucun projet', 'لا توجد مشاريع بعد')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {tr(
                'Send a project proposal to an artisan from the artisan directory.',
                'Envoyez une demande de projet à un artisan depuis l\'annuaire.',
                'أرسل طلب مشروع إلى حرفي من الدليل.'
              )}
            </p>
            <Button
              onClick={() => onNavigate?.('directory')}
              className="mt-4 rounded-xl"
            >
              {tr('Browse artisans', 'Parcourir les artisans', 'تصفح الحرفيين')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Empty filter ── */}
      {!loading && !error && proposals.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {tr('No proposals with this status.', 'Aucune demande avec ce statut.', 'لا توجد طلبات بهذا الحالة.')}
        </div>
      )}

      {/* ── Grid ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {filtered.map(p => (
            <ProposalCard
              key={p._id}
              proposal={p}
              tr={tr}
              onViewContract={handleViewContract}
              onMessage={handleMessage}
            />
          ))}
        </div>
      )}

      {/* ── Contract modal ── */}
      {contract && (
        <ContractModal
          contract={contract}
          onClose={() => { setContract(null); setContractError(''); }}
          tr={tr}
        />
      )}
    </div>
  );
}
