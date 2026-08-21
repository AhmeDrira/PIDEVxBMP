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
  Download,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import ContractDocument, { downloadContractPDF } from '../common/ContractDocument';

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
  status: 'draft' | 'pending_expert_signature' | 'pending_artisan_signature' | 'signed' | 'completed';
  signedByExpertAt?: string | null;
  signatureDataExpert?: string | null;
  signedByArtisanAt?: string | null;
  signatureData?: string | null;
  createdAt: string;
}

type ContractForDoc = Omit<Contract, 'proposalId'> & {
  proposalId?: {
    description?: string;
    localisation?: string;
    proposedPrice?: number;
    negotiatedPrice?: number | null;
    startDate?: string;
  } | null;
};

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
  pending_expert_signature:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  pending_artisan_signature:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  signed:                     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  completed:                  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

const STATUS_ICONS: Record<ContractStatus, React.ReactNode> = {
  draft:                     <Clock size={13} />,
  pending_expert_signature:  <Pen size={13} />,
  pending_artisan_signature: <Clock size={13} />,
  signed:                    <CheckCircle size={13} />,
  completed:                 <CheckCircle size={13} />,
};

function StatusBadge({ status, tr }: {
  status: ContractStatus;
  tr: (en: string, fr: string, ar?: string) => string;
}) {
  const labels: Record<ContractStatus, string> = {
    draft:                     tr('Draft',                  'Brouillon',                        'مسودة'),
    pending_expert_signature:  tr('Awaiting your signature','En attente de votre signature',    'بانتظار توقيعك'),
    pending_artisan_signature: tr('Awaiting artisan',       'En attente de l\'artisan',         'بانتظار الحرفي'),
    signed:                    tr('Signed',                 'Signé',                            'موقع'),
    completed:                 tr('Completed',              'Terminé',                          'مكتمل'),
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
  onSign,
}: {
  contract: Contract;
  tr: (en: string, fr: string, ar?: string) => string;
  onViewDetails: (c: Contract) => void;
  onSign: (contractId: string) => void;
}) {
  const proposal   = contract.proposalId;
  const finalPrice = proposal?.negotiatedPrice ?? proposal?.proposedPrice;
  const needsMySignature = !contract.signedByExpertAt && (contract.status === 'pending_expert_signature' || contract.status === 'pending_artisan_signature');

  return (
    <Card
      className="p-5 bg-card rounded-2xl border shadow-sm hover:shadow-md transition-shadow"
      style={{ borderColor: needsMySignature ? '#fcd34d' : undefined }}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${needsMySignature ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-primary/10'}`}>
            <FileText size={18} className={needsMySignature ? 'text-amber-600' : 'text-primary'} />
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

      {/* ── Actions ── */}
      <div className="flex gap-2">
        <Button
          onClick={() => onViewDetails(contract)}
          variant="outline"
          className="flex-1 h-9 text-sm rounded-xl flex items-center justify-center gap-2"
        >
          <FileText size={14} />
          {tr('View', 'Voir', 'عرض')}
        </Button>
        {needsMySignature && (
          <button
            onClick={() => onSign(contract._id)}
            className="flex-1 h-9 text-sm rounded-xl flex items-center justify-center gap-2 font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#f59e0b', color: '#fff' }}
          >
            <Pen size={14} />
            {tr('Sign', 'Signer', 'توقيع')}
          </button>
        )}
      </div>
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
  contract: ContractForDoc;
  onClose: () => void;
  onNavigateSign: (contractId: string) => void;
  tr: (en: string, fr: string, ar?: string) => string;
}) {
  const { language } = useLanguage();
  const needsMySignature = !contract.signedByExpertAt && (
    contract.status === 'pending_expert_signature' ||
    contract.status === 'pending_artisan_signature'
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-3xl flex flex-col bg-background rounded-2xl border-2 border-border shadow-2xl"
        style={{ maxHeight: 'min(92vh, 100%)' }}
      >
        {/* ── Header bar ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText size={15} className="text-primary" />
            {tr('Contract', 'Contrat', 'عقد')} #{contract._id.slice(-6).toUpperCase()}
          </h2>
          <div className="flex items-center gap-2">
            {/* Download PDF */}
            <button
              onClick={() => downloadContractPDF(contract as any, language)}
              className="h-8 px-3 rounded-xl border border-border hover:bg-muted transition-colors text-foreground flex items-center gap-1.5 text-xs font-medium"
            >
              <Download size={13} />
              {tr('PDF', 'PDF', 'PDF')}
            </button>
            {needsMySignature && (
              <button
                onClick={() => { onClose(); onNavigateSign(contract._id); }}
                className="rounded-xl h-8 text-xs px-4 flex items-center gap-1.5 font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#f59e0b', color: '#fff' }}
              >
                <Pen size={13} />
                {tr('Sign', 'Signer', 'توقيع')}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors text-foreground font-bold text-base"
            >✕</button>
          </div>
        </div>

        {/* ── Scrollable contract document ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <ContractDocument contract={contract as any} showDownload={false} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExpertContractViewProps {
  onNavigate?: (view: string, params?: Record<string, string>) => void;
}

export default function ExpertContractView({ onNavigate }: ExpertContractViewProps) {
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
      // Garde defensive : si l'API renvoie autre chose qu'un tableau (typiquement
      // l'index.html du SPA quand VITE_API_URL est mal configuree), l'operation de
      // tableau plus bas ferait planter le rendu React (ecran blanc).
      setContracts(Array.isArray(res.data) ? res.data : []);
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

  const pendingMySignature = contracts.filter(c => c.status === 'pending_expert_signature').length;

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
      {pendingMySignature > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <Pen size={20} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            {pendingMySignature === 1
              ? tr(
                  '1 contract is awaiting your expert signature.',
                  '1 contrat attend votre signature en tant qu\'expert.',
                  'عقد واحد بانتظار توقيعك كخبير.'
                )
              : tr(
                  `${pendingMySignature} contracts are awaiting your expert signature.`,
                  `${pendingMySignature} contrats attendent votre signature en tant qu'expert.`,
                  `${pendingMySignature} عقود بانتظار توقيعك كخبير.`
                )}
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
                draft:                     tr('draft',           'brouillon',        'مسودة'),
                pending_expert_signature:  tr('to sign',         'à signer',         'للتوقيع'),
                pending_artisan_signature: tr('artisan signing', 'artisan signe',    'يوقّع الحرفي'),
                signed:                    tr('signed',          'signé(s)',         'موقع'),
                completed:                 tr('completed',       'terminé(s)',       'مكتمل'),
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
                'Contracts appear here when an artisan accepts your project proposal.',
                'Les contrats apparaissent ici lorsqu\'un artisan accepte votre demande de projet.',
                'تظهر العقود هنا عندما يقبل حرفي طلب مشروعك.'
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
              onSign={contractId => onNavigate?.('sign-contract', { contractId })}
            />
          ))}
        </div>
      )}

      {/* ── Detail modal ── */}
      {selectedContract && (
        <ContractDetailModal
          contract={selectedContract as ContractForDoc}
          onClose={() => setSelectedContract(null)}
          onNavigateSign={contractId => onNavigate?.('sign-contract', { contractId })}
          tr={tr}
        />
      )}
    </div>
  );
}
