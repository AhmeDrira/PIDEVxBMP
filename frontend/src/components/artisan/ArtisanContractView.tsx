import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  FileText,
  User,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Pen,
  MapPin,
  Banknote,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Party {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhoto?: string;
}

interface Proposal {
  _id: string;
  description: string;
  localisation: string;
  proposedPrice: number;
  negotiatedPrice?: number | null;
  startDate: string;
  status: string;
}

interface Contract {
  _id: string;
  proposalId: Proposal;
  artisanId: Party;
  expertId: Party;
  content: string;
  status: 'draft' | 'pending_artisan_signature' | 'signed' | 'completed';
  signedByArtisanAt?: string | null;
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
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// ─── Status helpers ───────────────────────────────────────────────────────────

type ContractStatus = Contract['status'];

const STATUS_STYLES: Record<ContractStatus, string> = {
  draft:                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending_artisan_signature:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  signed:                     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  completed:                  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

const STATUS_ICONS: Record<ContractStatus, React.ReactNode> = {
  draft:                     <Clock size={13} />,
  pending_artisan_signature: <Pen size={13} />,
  signed:                    <CheckCircle size={13} />,
  completed:                 <CheckCircle size={13} />,
};

function StatusBadge({ status, tr }: {
  status: ContractStatus;
  tr: (en: string, fr: string, ar?: string) => string;
}) {
  const labels: Record<ContractStatus, string> = {
    draft:                     tr('Draft',              'Brouillon',                 'مسودة'),
    pending_artisan_signature: tr('Awaiting signature', 'En attente de signature',   'بانتظار التوقيع'),
    signed:                    tr('Signed',             'Signé',                     'موقع'),
    completed:                 tr('Completed',          'Terminé',                   'مكتمل'),
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_ICONS[status]}
      {labels[status]}
    </span>
  );
}

// ─── Party Avatar ─────────────────────────────────────────────────────────────

function PartyAvatar({ party }: { party: Party }) {
  const initials = `${party.firstName?.[0] ?? ''}${party.lastName?.[0] ?? ''}`.toUpperCase();
  if (party.profilePhoto) {
    const src = party.profilePhoto.startsWith('http')
      ? party.profilePhoto
      : `${API_BASE}/${party.profilePhoto.replace(/^\/+/, '')}`;
    return (
      <img src={src} alt={initials}
        className="w-9 h-9 rounded-full object-cover ring-2 ring-border flex-shrink-0"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
      {initials || <User size={14} />}
    </div>
  );
}

// ─── Contract Card ────────────────────────────────────────────────────────────

function ContractCard({
  contract,
  tr,
  onViewDetails,
}: {
  contract: Contract;
  tr: (en: string, fr: string, ar?: string) => string;
  onViewDetails: (c: Contract) => void;
}) {
  const proposal   = contract.proposalId;
  const finalPrice = proposal?.negotiatedPrice ?? proposal?.proposedPrice;

  return (
    <Card className="p-5 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tr('Contract', 'Contrat', 'عقد')} #{contract._id.slice(-6).toUpperCase()}
            </p>
            <p className="text-xs text-muted-foreground">
              {tr('Created on', 'Créé le', 'أُنشئ في')} {new Date(contract.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <StatusBadge status={contract.status} tr={tr} />
      </div>

      {/* ── Parties ── */}
      <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <PartyAvatar party={contract.artisanId} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{tr('Artisan', 'Artisan', 'حرفي')}</p>
            <p className="text-sm font-medium text-foreground truncate">
              {contract.artisanId.firstName} {contract.artisanId.lastName}
            </p>
          </div>
        </div>
        <div className="text-muted-foreground text-xs">↔</div>
        <div className="flex items-center gap-2 min-w-0">
          <PartyAvatar party={contract.expertId} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{tr('Expert', 'Expert', 'خبير')}</p>
            <p className="text-sm font-medium text-foreground truncate">
              {contract.expertId.firstName} {contract.expertId.lastName}
            </p>
          </div>
        </div>
      </div>

      {/* ── Proposal summary ── */}
      {proposal && (
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
          {finalPrice !== undefined && (
            <div className="flex items-center gap-1.5">
              <Banknote size={12} className="text-green-600 flex-shrink-0" />
              <span className="font-semibold text-green-600">{finalPrice.toLocaleString()} TND</span>
            </div>
          )}
          {proposal.startDate && (
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-blue-500 flex-shrink-0" />
              <span>{new Date(proposal.startDate).toLocaleDateString()}</span>
            </div>
          )}
          {proposal.localisation && (
            <div className="flex items-center gap-1.5 col-span-2">
              <MapPin size={12} className="text-primary flex-shrink-0" />
              <span className="truncate">{proposal.localisation}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Signature info ── */}
      {contract.status === 'signed' && contract.signedByArtisanAt && (
        <div className="flex items-center gap-2 text-xs text-green-600 mb-3">
          <CheckCircle size={12} />
          <span>
            {tr('Signed on', 'Signé le', 'وُقِّع في')} {new Date(contract.signedByArtisanAt).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* ── Action ── */}
      <Button
        onClick={() => onViewDetails(contract)}
        variant="outline"
        className="w-full h-9 text-sm rounded-xl flex items-center justify-center gap-2"
      >
        <FileText size={14} />
        {tr('View contract', 'Voir le contrat', 'عرض العقد')}
      </Button>
    </Card>
  );
}

// ─── Contract Detail Modal ────────────────────────────────────────────────────

function ContractDetailModal({
  contract,
  onClose,
  onNavigateSign,
  tr,
}: {
  contract: Contract;
  onClose: () => void;
  onNavigateSign: (contractId: string) => void;
  tr: (en: string, fr: string, ar?: string) => string;
}) {
  const [expanded, setExpanded] = useState(true);
  const canSign = contract.status === 'pending_artisan_signature';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl border border-border flex flex-col" style={{ maxHeight: 'min(90vh, 100%)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            {tr('Contract', 'Contrat', 'عقد')} #{contract._id.slice(-6).toUpperCase()}
          </h2>
          <div className="flex items-center gap-3">
            <StatusBadge status={contract.status} tr={tr} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {/* Parties */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: tr('Artisan', 'Artisan', 'حرفي'), party: contract.artisanId },
              { label: tr('Expert', 'Expert', 'خبير'),   party: contract.expertId  },
            ].map(({ label, party }) => (
              <div key={party._id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <PartyAvatar party={party} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold text-foreground">{party.firstName} {party.lastName}</p>
                  <p className="text-xs text-muted-foreground">{party.email}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Content */}
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

          {/* Signature info */}
          {contract.status === 'signed' && contract.signedByArtisanAt && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  {tr('Electronically signed', 'Signé électroniquement', 'موقع إلكترونياً')}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {new Date(contract.signedByArtisanAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Pending signature info */}
          {canSign && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <Pen size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {tr(
                  'This contract is awaiting your electronic signature.',
                  'Ce contrat attend votre signature électronique.',
                  'هذا العقد بانتظار توقيعك الإلكتروني.'
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            {tr('Close', 'Fermer', 'إغلاق')}
          </Button>
          {canSign && (
            <Button
              onClick={() => { onClose(); onNavigateSign(contract._id); }}
              className="rounded-xl text-white bg-primary hover:bg-primary/90 flex items-center gap-2"
            >
              <Pen size={15} />
              {tr('Sign this contract', 'Signer ce contrat', 'توقيع هذا العقد')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ArtisanContractViewProps {
  onNavigate?: (view: string, params?: Record<string, string>) => void;
}

export default function ArtisanContractView({ onNavigate }: ArtisanContractViewProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const [contracts, setContracts]           = useState<Contract[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const fetchContracts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/contracts`, { headers: authHeaders() });
      setContracts(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        tr('Failed to load contracts.', 'Impossible de charger les contrats.', 'فشل تحميل العقود.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContracts(); }, []);

  // Status counters
  const counts = contracts.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const pendingSignature = contracts.filter(c => c.status === 'pending_artisan_signature').length;

  return (
    <div className="space-y-6">
      {/* ── Title ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText size={24} className="text-primary" />
            {tr('My Contracts', 'Mes contrats', 'عقودي')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'Contracts generated from accepted proposals.',
              'Contrats générés à partir des demandes acceptées.',
              'العقود المُولَّدة من الطلبات المقبولة.'
            )}
          </p>
        </div>
        <Button
          onClick={fetchContracts}
          variant="outline"
          className="rounded-xl flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {tr('Refresh', 'Actualiser', 'تحديث')}
        </Button>
      </div>

      {/* ── Pending signature banner ── */}
      {pendingSignature > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
          <Pen size={20} className="text-orange-500 flex-shrink-0" />
          <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
            {pendingSignature === 1
              ? tr('1 contract is awaiting your signature.', '1 contrat attend votre signature.', 'عقد واحد بانتظار توقيعك.')
              : tr(`${pendingSignature} contracts are awaiting your signature.`, `${pendingSignature} contrats attendent votre signature.`, `${pendingSignature} عقود بانتظار توقيعك.`)}
          </p>
        </div>
      )}

      {/* ── Status counters ── */}
      {contracts.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {(Object.entries(counts) as [ContractStatus, number][]).map(([status, count]) => (
            <div key={status}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
              {STATUS_ICONS[status]}
              <span>{count}</span>
              <span>{({
                draft:                     tr('draft',    'brouillon',      'مسودة'),
                pending_artisan_signature: tr('to sign',  'à signer',       'للتوقيع'),
                signed:                    tr('signed',   'signé(s)',       'موقع'),
                completed:                 tr('completed','terminé(s)',     'مكتمل'),
              } as Record<ContractStatus, string>)[status]}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <RefreshCw size={32} className="animate-spin text-primary" />
          <p className="text-sm">{tr('Loading contracts…', 'Chargement des contrats…', 'جاري تحميل العقود…')}</p>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-5">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{tr('Error', 'Erreur', 'خطأ')}</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{error}</p>
            <Button onClick={fetchContracts} variant="outline"
              className="mt-3 h-8 text-xs rounded-lg border-red-300 text-red-600 hover:bg-red-50">
              {tr('Retry', 'Réessayer', 'إعادة المحاولة')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && contracts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <FileText size={32} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {tr('No contracts yet', 'Aucun contrat', 'لا توجد عقود بعد')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {tr(
                'Contracts are automatically generated when you accept a project proposal.',
                'Les contrats sont générés automatiquement lorsque vous acceptez une demande.',
                'تُولَّد العقود تلقائياً عند قبولك لطلب مشروع.'
              )}
            </p>
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      {!loading && !error && contracts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {contracts.map(c => (
            <ContractCard
              key={c._id}
              contract={c}
              tr={tr}
              onViewDetails={setSelectedContract}
            />
          ))}
        </div>
      )}

      {/* ── Detail modal ── */}
      {selectedContract && (
        <ContractDetailModal
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
          onNavigateSign={contractId => onNavigate?.('sign-contract', { contractId })}
          tr={tr}
        />
      )}
    </div>
  );
}
