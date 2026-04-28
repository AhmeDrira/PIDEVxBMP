import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  MapPin,
  Calendar,
  Banknote,
  User,
  Inbox,
  AlertCircle,
  RefreshCw,
  Clock,
  MessageCircle,
  X,
  ArrowRightLeft,
  CheckCircle,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expert {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhoto?: string;
  domain?: string;
}

interface NegotiationEntry {
  _id?: string;
  senderId: string | object;
  senderRole: 'expert' | 'artisan';
  proposedPrice: number;
  message?: string;
  createdAt: string;
}

interface Proposal {
  _id: string;
  expertId: Expert;
  artisanId: string;
  description: string;
  localisation: string;
  proposedPrice: number;
  negotiatedPrice?: number | null;
  currentPrice?: number | null;
  lastProposedBy?: 'expert' | 'artisan' | null;
  negotiationHistory?: NegotiationEntry[];
  startDate: string;
  status: 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'signed';
  messages: unknown[];
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

// ─── Status badge ─────────────────────────────────────────────────────────────

type StatusKey = Proposal['status'];

const STATUS_STYLES: Record<StatusKey, string> = {
  pending:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  negotiating: 'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-300',
  accepted:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected:    'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-300',
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

// ─── Expert Avatar ────────────────────────────────────────────────────────────

function ExpertAvatar({ expert }: { expert: Expert }) {
  const initials = `${expert.firstName?.[0] ?? ''}${expert.lastName?.[0] ?? ''}`.toUpperCase();
  if (expert.profilePhoto) {
    const src = expert.profilePhoto.startsWith('http')
      ? expert.profilePhoto
      : `${API_BASE}/${expert.profilePhoto.replace(/^\/+/, '')}`;
    return (
      <img src={src} alt={initials}
        className="w-10 h-10 rounded-full object-cover ring-2 ring-border flex-shrink-0"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
      {initials || <User size={16} />}
    </div>
  );
}

// ─── Negotiation Modal ────────────────────────────────────────────────────────

interface NegotiationModalProps {
  proposal: Proposal;
  onClose: () => void;
  onSuccess: (updatedProposal: Proposal) => void;
  onNavigateMessages: () => void;
  tr: (en: string, fr: string, ar?: string) => string;
}

function NegotiationModal({ proposal, onClose, onSuccess, onNavigateMessages, tr }: NegotiationModalProps) {
  const expert       = proposal.expertId;
  const latestPrice  = proposal.currentPrice ?? proposal.negotiatedPrice ?? proposal.proposedPrice;
  const history      = proposal.negotiationHistory ?? [];

  const [newPrice,      setNewPrice]      = useState('');
  const [msgText,       setMsgText]       = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState(false);
  const [goToMessages,  setGoToMessages]  = useState(true);
  const [showHistory,   setShowHistory]   = useState(false);

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
      // 1 — Envoyer la contre-offre via le nouvel endpoint
      const counterRes = await axios.post(
        `${API_URL}/proposals/${proposal._id}/counter`,
        { proposedPrice: price, message: msgText.trim() },
        { headers: authHeaders() }
      );
      const updatedProposal: Proposal = counterRes.data;
      onSuccess(updatedProposal);
      setSuccess(true);

      // 2 — Créer ou récupérer la conversation (optionnel pour navigation)
      if (goToMessages) {
        try {
          const convRes = await axios.post(
            `${API_URL}/conversations`,
            { participantId: expert._id },
            { headers: authHeaders() }
          );
          const conversationId = convRes.data._id || convRes.data.id;
          localStorage.setItem('selectedConversationId', conversationId);
        } catch { /* si ça échoue, on navigue quand même */ }
        setTimeout(() => {
          onClose();
          onNavigateMessages();
        }, 1200);
      } else {
        setTimeout(() => onClose(), 1500);
      }
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
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border flex flex-col"
        style={{ maxHeight: 'min(90vh, 680px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-blue-500" />
            {tr('Propose a New Price', 'Proposer un nouveau prix', 'اقتراح سعر جديد')}
          </h2>
          {!submitting && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {success ? (
            /* ─ Succès ─ */
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle size={48} className="text-green-500" />
              <p className="font-semibold text-foreground">
                {tr('Counter-offer sent!', 'Contre-offre envoyée !', 'تم إرسال العرض المضاد!')}
              </p>
              <p className="text-sm text-muted-foreground">
                {goToMessages
                  ? tr('Redirecting to the conversation…', 'Redirection vers la conversation…', 'جاري التوجيه إلى المحادثة…')
                  : tr('The proposal has been updated.', 'La demande a été mise à jour.', 'تم تحديث الطلب.')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Info expert */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <ExpertAvatar expert={expert} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{expert.firstName} {expert.lastName}</p>
                  <p className="text-xs text-muted-foreground">{expert.domain}</p>
                </div>
              </div>

              {/* Prix actuel */}
              <div className="rounded-xl border border-border p-3 space-y-1">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    {tr('Initial price', 'Prix initial', 'السعر الأولي')}
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {proposal.proposedPrice.toLocaleString()} TND
                  </p>
                </div>
                {latestPrice !== proposal.proposedPrice && (
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      {tr('Current offer', 'Offre actuelle', 'العرض الحالي')}
                    </p>
                    <p className="text-sm font-bold text-blue-600">
                      {latestPrice.toLocaleString()} TND
                    </p>
                  </div>
                )}
                {proposal.lastProposedBy && (
                  <p className="text-xs text-muted-foreground">
                    {tr('Last proposed by', 'Dernière proposition de', 'آخر عرض من')}:{' '}
                    <span className="font-semibold">
                      {proposal.lastProposedBy === 'artisan'
                        ? tr('you', 'vous', 'أنت')
                        : tr('the expert', 'l\'expert', 'الخبير')}
                    </span>
                  </p>
                )}
              </div>

              {/* Historique de négociation (collapsible) */}
              {history.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors mb-2"
                  >
                    {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {tr('Negotiation history', 'Historique', 'سجل التفاوض')} ({history.length})
                  </button>
                  {showHistory && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto bg-muted/20 rounded-xl p-2">
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
                            <span className="font-bold text-foreground">{entry.proposedPrice.toLocaleString()} TND</span>
                            {entry.message && (
                              <p className="text-muted-foreground mt-0.5 italic truncate">"{entry.message}"</p>
                            )}
                          </div>
                          <span className="text-muted-foreground flex-shrink-0">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Nouveau prix */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {tr('Your counter-offer (TND)', 'Votre contre-offre (TND)', 'عرضك المضاد (TND)')} *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newPrice}
                  onChange={e => setNewPrice(e.target.value)}
                  placeholder={String(latestPrice)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  autoFocus
                  required
                />
              </div>

              {/* Message optionnel */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {tr('Message (optional)', 'Message (optionnel)', 'رسالة (اختياري)')}
                </label>
                <textarea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={tr('Explain your counter-offer…', 'Expliquez votre contre-offre…', 'اشرح عرضك المضاد…')}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                />
              </div>

              {/* Option redirection messagerie */}
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={goToMessages}
                  onChange={e => setGoToMessages(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {tr('Go to conversation', 'Aller à la conversation', 'الانتقال إلى المحادثة')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tr(
                      'The expert will be notified of your counter-offer.',
                      'L\'expert sera notifié de votre contre-offre.',
                      'سيتم إشعار الخبير بعرضك المضاد.'
                    )}
                  </p>
                </div>
              </label>

              {/* Erreur */}
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
                    : tr('Submit Counter-offer', 'Envoyer ma contre-offre', 'إرسال العرض المضاد')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Accept Confirm Modal ─────────────────────────────────────────────────────

interface AcceptConfirmModalProps {
  proposal: Proposal;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  submitting: boolean;
  error: string;
  tr: (en: string, fr: string, ar?: string) => string;
}

function AcceptConfirmModal({ proposal, onClose, onConfirm, submitting, error, tr }: AcceptConfirmModalProps) {
  const expert     = proposal.expertId;
  const finalPrice = proposal.currentPrice ?? proposal.negotiatedPrice ?? proposal.proposedPrice;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={() => !submitting && onClose()}
    >
      <div
        style={{
          backgroundColor: 'var(--card)',
          borderRadius: 20,
          padding: 32,
          maxWidth: 420,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <h3
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--foreground)',
            textAlign: 'center',
            margin: '0 0 6px',
          }}
        >
          {tr('Accept this proposal?', 'Accepter cette demande ?', 'قبول هذا الطلب؟')}
        </h3>

        {/* Expert name */}
        <p
          style={{
            fontSize: 14,
            color: 'var(--muted-foreground)',
            textAlign: 'center',
            margin: '0 0 6px',
            lineHeight: 1.5,
          }}
        >
          {tr('From', 'De', 'من')} <strong style={{ color: 'var(--foreground)' }}>{expert.firstName} {expert.lastName}</strong>
          {expert.domain ? ` — ${expert.domain}` : ''}
        </p>

        {/* Final price (prominent) */}
        <p
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: '#16a34a',
            textAlign: 'center',
            margin: '0 0 16px',
          }}
        >
          {finalPrice.toLocaleString()} TND
        </p>

        {/* Summary strip */}
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--border)',
            padding: '10px 14px',
            marginBottom: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--muted-foreground)' }}>{tr('Start date', 'Date de début', 'تاريخ البداية')}</span>
            <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{new Date(proposal.startDate).toLocaleDateString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}>{tr('Location', 'Localisation', 'الموقع')}</span>
            <span style={{ fontWeight: 600, color: 'var(--foreground)', textAlign: 'right' }}>{proposal.localisation}</span>
          </div>
        </div>

        {/* Confirmation text */}
        <p
          style={{
            fontSize: 13,
            color: 'var(--muted-foreground)',
            textAlign: 'center',
            margin: '0 0 20px',
            lineHeight: 1.5,
          }}
        >
          {tr(
            'By accepting, you confirm your agreement to carry out this project under the agreed terms.',
            'En acceptant, vous confirmez votre accord pour réaliser ce projet selon les conditions convenues.',
            'بالقبول، تؤكد موافقتك على تنفيذ هذا المشروع وفق الشروط المتفق عليها.'
          )}
        </p>

        {/* Error */}
        {error && (
          <p
            style={{
              fontSize: 13,
              color: '#dc2626',
              margin: '0 0 16px',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #fecaca',
              backgroundColor: '#fef2f2',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              border: '2px solid var(--border)',
              backgroundColor: 'var(--card)',
              color: 'var(--foreground)',
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {tr('Cancel', 'Annuler', 'إلغاء')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              backgroundColor: '#16a34a',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting
              ? tr('Accepting…', 'Acceptation…', 'جاري القبول…')
              : tr('Confirm', 'Confirmer', 'تأكيد')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Proposal Card ────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  tr,
  onNegotiate,
  onAccept,
  onHide,
}: {
  proposal: Proposal;
  tr: (en: string, fr: string, ar?: string) => string;
  onNegotiate: (p: Proposal) => void;
  onAccept: (p: Proposal) => void;
  onHide: (id: string) => void;
}) {
  const expert       = proposal.expertId;
  const latestPrice  = proposal.currentPrice ?? proposal.negotiatedPrice ?? proposal.proposedPrice;
  const priceToShow  = latestPrice;
  const isNegotiated = latestPrice !== proposal.proposedPrice;
  const canAct       = proposal.status === 'pending' || proposal.status === 'negotiating';
  // Badge "new offer" quand l'expert a envoyé une contre-offre non encore traitée
  const hasNewOffer  = proposal.status === 'negotiating' && proposal.lastProposedBy === 'expert';
  const history      = proposal.negotiationHistory ?? [];
  const [showHistory, setShowHistory] = useState(false);

  return (
    <Card className="p-5 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
      {/* ── En-tête : expert + statut ── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <ExpertAvatar expert={expert} />
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">
              {expert.firstName} {expert.lastName}
            </p>
            {expert.domain && (
              <p className="text-xs text-muted-foreground truncate">{expert.domain}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasNewOffer && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse">
              🔔 {tr('New offer', 'Nouvelle offre', 'عرض جديد')}
            </span>
          )}
          <StatusBadge status={proposal.status} tr={tr} />
        </div>
      </div>

      {/* ── Description ── */}
      <p className="text-sm text-foreground leading-relaxed line-clamp-3 mb-4">
        {proposal.description}
      </p>

      {/* ── Métadonnées ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm mb-4">
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
                <span className="font-semibold text-green-600">{priceToShow.toLocaleString()} TND</span>
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

      {/* ── Historique de négociation (collapsible) ── */}
      {history.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {tr('Negotiation history', 'Historique', 'سجل التفاوض')} ({history.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto bg-muted/20 rounded-xl p-2">
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
                    <span className="font-bold text-foreground">{entry.proposedPrice.toLocaleString()} TND</span>
                    {entry.message && (
                      <p className="text-muted-foreground mt-0.5 italic truncate">"{entry.message}"</p>
                    )}
                  </div>
                  <span className="text-muted-foreground flex-shrink-0">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      {canAct && (
        <div className="flex flex-wrap w-full gap-2 pt-3 border-t border-border">
          <Button
            onClick={() => onNegotiate(proposal)}
            variant="outline"
            className="flex-1 min-w-[120px] h-9 text-sm rounded-xl border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center justify-center gap-1.5"
          >
            <MessageCircle size={15} />
            {tr('Negotiate', 'Négocier', 'تفاوض')}
          </Button>
          <Button
            onClick={() => onAccept(proposal)}
            className="flex-1 min-w-[120px] h-9 text-sm rounded-xl text-white bg-green-600 hover:bg-green-700 flex items-center justify-center gap-1.5 shadow-md"
          >
            <ThumbsUp size={15} />
            {tr('Accept', 'Accepter', 'قبول')}
          </Button>
        </div>
      )}
      {proposal.status === 'accepted' && (
        <div className="flex items-center gap-2 pt-3 border-t border-border text-green-600 text-sm font-semibold">
          <CheckCircle size={16} />
          {tr('Proposal accepted', 'Demande acceptée', 'تم قبول الطلب')}
        </div>
      )}

      {/* ── Footer: received date + delete ── */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock size={12} />
          <span>
            {tr('Received on', 'Reçue le', 'وصلت في')} {new Date(proposal.createdAt).toLocaleDateString()}
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

interface ArtisanProposalsProps {
  onNavigate?: (view: string) => void;
}

export default function ArtisanProposals({ onNavigate }: ArtisanProposalsProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const [proposals, setProposals]             = useState<Proposal[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');
  const [negotiatingProposal, setNegotiatingProposal] = useState<Proposal | null>(null);
  const [acceptingProposal, setAcceptingProposal]     = useState<Proposal | null>(null);
  const [acceptSubmitting, setAcceptSubmitting]       = useState(false);
  const [acceptError, setAcceptError]                 = useState('');

  const artisanId = getCurrentUserId();

  const fetchProposals = async () => {
    if (!artisanId) {
      setError(tr('Unable to identify user.', 'Impossible d\'identifier l\'utilisateur.', 'تعذّر التعرف على المستخدم.'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/proposals/artisan/${artisanId}`, {
        headers: authHeaders(),
      });
      setProposals(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        tr('Failed to load proposals.', 'Impossible de charger les demandes.', 'فشل تحميل الطلبات.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProposals(); }, [artisanId]);

  const handleProposalUpdated = (updated: Proposal) => {
    setProposals(prev => prev.map(p => p._id === updated._id ? updated : p));
  };

  const handleHide = async (id: string) => {
    try {
      await axios.put(`${API_URL}/proposals/${id}/hide`, {}, { headers: authHeaders() });
      setProposals(prev => prev.filter(p => p._id !== id));
    } catch {
      // silently ignore
    }
  };

  const openAcceptModal = (proposal: Proposal) => {
    setAcceptError('');
    setAcceptingProposal(proposal);
  };

  const handleAccept = async () => {
    if (!acceptingProposal) return;
    setAcceptError('');
    setAcceptSubmitting(true);
    try {
      const res = await axios.put(
        `${API_URL}/proposals/${acceptingProposal._id}/accept`,
        {},
        { headers: authHeaders() }
      );
      handleProposalUpdated(res.data);
      setAcceptingProposal(null);
    } catch (err: any) {
      setAcceptError(
        err?.response?.data?.message ||
        tr('An error occurred. Please try again.', 'Une erreur est survenue. Veuillez réessayer.', 'حدث خطأ. يرجى المحاولة مجدداً.')
      );
    } finally {
      setAcceptSubmitting(false);
    }
  };

  // Compteurs par statut
  const counts = proposals.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* ── Titre ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Project Proposals', 'Demandes de projets', 'طلبات المشاريع')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'Proposals submitted by experts for your services.',
              'Demandes soumises par des experts pour vos services.',
              'الطلبات التي يرسلها الخبراء لخدماتك.'
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

      {/* ── Compteurs rapides ── */}
      {proposals.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {(Object.entries(counts) as [StatusKey, number][]).map(([status, count]) => (
            <div key={status}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
              <span>{count}</span>
              <span>{({
                pending:     tr('pending',     'en attente',     'قيد الانتظار'),
                negotiating: tr('negotiating', 'en négociation', 'قيد التفاوض'),
                accepted:    tr('accepted',    'acceptée(s)',    'مقبول'),
                rejected:    tr('rejected',    'refusée(s)',     'مرفوض'),
                signed:      tr('signed',      'signée(s)',      'موقع'),
              } as Record<StatusKey, string>)[status]}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── États : loading / erreur / vide ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <RefreshCw size={32} className="animate-spin text-primary" />
          <p className="text-sm">{tr('Loading proposals…', 'Chargement des demandes…', 'جاري تحميل الطلبات…')}</p>
        </div>
      )}

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

      {!loading && !error && proposals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Inbox size={32} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {tr('No proposals yet', 'Aucune demande reçue', 'لا توجد طلبات بعد')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {tr(
                'When an expert sends you a project proposal, it will appear here.',
                'Lorsqu\'un expert vous envoie une demande de projet, elle apparaîtra ici.',
                'عندما يرسل خبير طلب مشروع، سيظهر هنا.'
              )}
            </p>
          </div>
        </div>
      )}

      {!loading && !error && proposals.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {proposals.map(p => (
            <ProposalCard
              key={p._id}
              proposal={p}
              tr={tr}
              onNegotiate={setNegotiatingProposal}
              onAccept={openAcceptModal}
              onHide={handleHide}
            />
          ))}
        </div>
      )}

      {/* ── Modal de négociation ── */}
      {negotiatingProposal && (
        <NegotiationModal
          proposal={negotiatingProposal}
          onClose={() => setNegotiatingProposal(null)}
          onSuccess={handleProposalUpdated}
          onNavigateMessages={() => onNavigate?.('messages')}
          tr={tr}
        />
      )}

      {/* ── Modal de confirmation d'acceptation ── */}
      {acceptingProposal && (
        <AcceptConfirmModal
          proposal={acceptingProposal}
          onClose={() => { if (!acceptSubmitting) { setAcceptingProposal(null); setAcceptError(''); } }}
          onConfirm={handleAccept}
          submitting={acceptSubmitting}
          error={acceptError}
          tr={tr}
        />
      )}
    </div>
  );
}
