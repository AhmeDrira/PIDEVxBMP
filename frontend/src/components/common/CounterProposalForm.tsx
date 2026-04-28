import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface CounterProposalFormProps {
  currentPrice: number;
  onSubmit: (price: number, message: string) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
}

export default function CounterProposalForm({
  currentPrice,
  onSubmit,
  onCancel,
  loading = false,
  error,
}: CounterProposalFormProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const [price, setPrice] = useState('');
  const [msg, setMsg] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    const parsed = Number(price);
    if (!price.trim()) {
      setLocalError(tr('Please enter a price.', 'Veuillez saisir un prix.', 'يرجى إدخال سعر.'));
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setLocalError(tr('The price must be greater than 0.', 'Le prix doit être supérieur à 0.', 'يجب أن يكون السعر أكبر من 0.'));
      return;
    }
    onSubmit(parsed, msg.trim());
  };

  const displayError = error || localError;

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
          border: '1px solid var(--border)',
          padding: 28,
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
            margin: '0 0 4px',
          }}
        >
          {tr('Counter-offer', 'Contre-proposition', 'عرض مضاد')}
        </h3>

        {/* Current price reference */}
        <p
          style={{
            fontSize: 14,
            color: 'var(--muted-foreground)',
            margin: '0 0 20px',
            lineHeight: 1.5,
          }}
        >
          {tr('Current offer:', 'Offre actuelle :', 'العرض الحالي:')}
          {' '}
          <strong style={{ color: 'var(--foreground)' }}>
            {currentPrice.toLocaleString()} TND
          </strong>
        </p>

        <form onSubmit={handleSubmit}>
          {/* New price */}
          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="counter-price"
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--foreground)',
              }}
            >
              {tr('Proposed price (TND)', 'Prix proposé (TND)', 'السعر المقترح (TND)')} *
            </label>
            <input
              id="counter-price"
              type="number"
              min="1"
              step="1"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder={String(currentPrice)}
              autoFocus
              disabled={loading}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                padding: '0 12px',
                fontSize: 14,
                boxSizing: 'border-box',
                opacity: loading ? 0.6 : 1,
              }}
            />
          </div>

          {/* Optional message */}
          <div style={{ marginBottom: displayError ? 12 : 20 }}>
            <label
              htmlFor="counter-msg"
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--foreground)',
              }}
            >
              {tr('Message (optional)', 'Message (optionnel)', 'رسالة (اختياري)')}
            </label>
            <textarea
              id="counter-msg"
              value={msg}
              onChange={e => setMsg(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={loading}
              placeholder={tr(
                'Explain your counter-offer…',
                'Expliquez votre contre-proposition…',
                'اشرح عرضك المضاد…'
              )}
              style={{
                width: '100%',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                padding: '10px 12px',
                fontSize: 14,
                resize: 'none',
                boxSizing: 'border-box',
                opacity: loading ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Error */}
          {displayError && (
            <p
              style={{
                fontSize: 13,
                color: '#dc2626',
                margin: '0 0 16px',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #fecaca',
                backgroundColor: '#fef2f2',
              }}
            >
              {displayError}
            </p>
          )}

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
              {tr('Cancel', 'Annuler', 'إلغاء')}
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 12,
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? tr('Sending…', 'Envoi…', 'جاري الإرسال…')
                : tr('Send', 'Envoyer', 'إرسال')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
