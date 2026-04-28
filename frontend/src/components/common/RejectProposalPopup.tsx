import { X, ArrowRightLeft, AlertTriangle } from 'lucide-react';
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && !loading && onCancel()}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <AlertTriangle size={17} className="text-red-500" />
            {tr('Reject Proposal', 'Refuser la proposition', 'رفض العرض')}
          </h2>
          {!loading && (
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <div className="rounded-xl bg-muted/40 border border-border px-4 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">
              {tr('Current offer', 'Offre actuelle', 'العرض الحالي')}
            </span>
            <span className="font-bold text-foreground">{price.toLocaleString()} TND</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {tr(
              'Do you really want to reject this proposal? This action cannot be undone. You can also make a counter-offer instead.',
              'Voulez-vous vraiment refuser cette proposition ? Cette action ne pourra pas être annulée. Vous pouvez aussi proposer une contre-offre.',
              'هل تريد فعلاً رفض هذا العرض؟ لا يمكن التراجع عن هذا الإجراء. يمكنك أيضًا تقديم عرض مضاد بدلاً من ذلك.'
            )}
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-6 pb-5">
          {/* Cancel + Counter on the same row */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-xl text-sm border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              {tr('Cancel', 'Annuler', 'إلغاء')}
            </button>
            <button
              type="button"
              onClick={onCounter}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <ArrowRightLeft size={14} />
              {tr('Counter-offer', 'Contre-offre', 'عرض مضاد')}
            </button>
          </div>
          {/* Reject definitively - full width, prominent red */}
          <button
            type="button"
            onClick={onReject}
            disabled={loading}
            className="w-full px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading
              ? tr('Rejecting...', 'Refus en cours...', 'جاري الرفض...')
              : tr('Reject definitively', 'Refuser definitivement', 'رفض نهائي')}
          </button>
        </div>
      </div>
    </div>
  );
}
