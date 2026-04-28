import { useLanguage } from '../../context/LanguageContext';

interface ConfirmationPopupProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 'default' = blue, 'success' = green, 'danger' = red */
  confirmVariant?: 'default' | 'success' | 'danger';
  loading?: boolean;
}

export default function ConfirmationPopup({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'default',
  loading = false,
}: ConfirmationPopupProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const btnBg =
    confirmVariant === 'success'
      ? '#16a34a'
      : confirmVariant === 'danger'
      ? '#dc2626'
      : '#2563eb';

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
            margin: '0 0 8px',
          }}
        >
          {title}
        </h3>

        {/* Message */}
        <p
          style={{
            fontSize: 14,
            color: 'var(--muted-foreground)',
            textAlign: 'center',
            margin: '0 0 24px',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
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
            {cancelLabel ?? tr('No', 'Non', 'لا')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              backgroundColor: btnBg,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
