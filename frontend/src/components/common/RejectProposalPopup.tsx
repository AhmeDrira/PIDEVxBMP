import { ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface RejectProposalPopupProps {
  price: number;
  loading?: boolean;
  onCancel: () => void;
  onCounter: () => void;
  onReject: () => void;
}

export default function RejectProposalPopup({
  price,
  loading = false,
  onCancel,
  onCounter,
  onReject,
}: RejectProposalPopupProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

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
      onClick={() => !loading && onCancel()}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <AlertTriangle size={20} color="#ef4444" />
          {tr('Reject Proposal', 'Refuser la proposition', 'رفض العرض')}
        </h3>

        {/* Current price */}
        <p
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#ef4444',
            textAlign: 'center',
            margin: '0 0 16px',
          }}
        >
          {price.toLocaleString()} TND
        </p>

        {/* Warning message */}
        <p
          style={{
            fontSize: 14,
            color: 'var(--muted-foreground)',
            textAlign: 'center',
            margin: '0 0 28px',
            lineHeight: 1.6,
          }}
        >
          {tr(
            'Do you really want to reject this proposal? This action cannot be undone. You can also make a counter-offer instead.',
            'Voulez-vous vraiment refuser cette proposition ? Cette action ne pourra pas être annulée. Vous pouvez aussi proposer une contre-offre.',
            'هل تريد فعلاً رفض هذا العرض؟ لا يمكن التراجع عن هذا الإجراء. يمكنك أيضًا تقديم عرض مضاد بدلاً من ذلك.'
          )}
        </p>

        {/* Cancel + Counter row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              border: '2px solid var(--border)',
              backgroundColor: 'var(--card)',
              color: 'var(--foreground)',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {tr('Cancel', 'Annuler', 'إلغاء')}
          </button>
          <button
            type="button"
            onClick={onCounter}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <ArrowRightLeft size={14} />
            {tr('Counter-offer', 'Contre-offre', 'عرض مضاد')}
          </button>
        </div>

        {/* Reject definitively */}
        <button
          type="button"
          onClick={onReject}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 12,
            border: 'none',
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading
            ? tr('Rejecting...', 'Refus en cours...', 'جاري الرفض...')
            : tr('Reject definitively', 'Refuser définitivement', 'رفض نهائي')}
        </button>
      </div>
    </div>
  );
}
