import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

// ── Step 1: Confirm acceptance ─────────────────────────────────────────────

interface AcceptConfirmStepProps {
  price: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AcceptConfirmStep({ price, loading, onConfirm, onCancel }: AcceptConfirmStepProps) {
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
            margin: '0 0 8px',
          }}
        >
          {tr('Accept this proposal?', 'Accepter cette proposition ?', 'قبول هذا الاقتراح؟')}
        </h3>

        {/* Price */}
        <p
          style={{
            fontSize: 14,
            color: 'var(--muted-foreground)',
            textAlign: 'center',
            margin: '0 0 8px',
            lineHeight: 1.5,
          }}
        >
          {tr('Do you want to accept this offer at', 'Voulez-vous accepter cette offre à', 'هل تريد قبول هذا العرض بـ')}
        </p>
        <p
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#16a34a',
            textAlign: 'center',
            margin: '0 0 24px',
          }}
        >
          {price.toLocaleString()} TND
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
            {tr('No', 'Non', 'لا')}
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
              backgroundColor: '#16a34a',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? tr('Accepting…', 'Acceptation…', 'جاري القبول…')
              : tr('Yes, accept', 'Oui, accepter', 'نعم، أقبل')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Sign now or later (artisan only) ──────────────────────────────

interface PostAcceptStepProps {
  price: number;
  onSignNow: () => void;
  onSignLater: () => void;
}

export function PostAcceptStep({ price, onSignNow, onSignLater }: PostAcceptStepProps) {
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
          ✅ {tr('Offer accepted!', 'Offre acceptée !', 'تم قبول العرض!')}
        </h3>

        {/* Accepted price */}
        <p
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#16a34a',
            textAlign: 'center',
            margin: '0 0 8px',
          }}
        >
          {price.toLocaleString()} TND
        </p>

        {/* Sub-message */}
        <p
          style={{
            fontSize: 14,
            color: 'var(--muted-foreground)',
            textAlign: 'center',
            margin: '0 0 24px',
            lineHeight: 1.5,
          }}
        >
          {tr(
            'Do you want to sign the contract now?',
            'Voulez-vous signer le contrat maintenant ?',
            'هل تريد توقيع العقد الآن؟'
          )}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onSignLater}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              border: '2px solid var(--border)',
              backgroundColor: 'var(--card)',
              color: 'var(--foreground)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {tr('No, later', 'Non, plus tard', 'لا، لاحقًا')}
          </button>
          <button
            type="button"
            onClick={onSignNow}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {tr('Yes, sign now', 'Oui, signer maintenant', 'نعم، وقّع الآن')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AcceptOfferPopupProps {
  price: number;
  phase: 'confirm_accept' | 'post_accept';
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onSignNow: () => void;
  onSignLater: () => void;
}

export default function AcceptOfferPopup({
  price,
  phase,
  loading = false,
  onCancel,
  onConfirm,
  onSignNow,
  onSignLater,
}: AcceptOfferPopupProps) {
  if (phase === 'confirm_accept') {
    return (
      <AcceptConfirmStep
        price={price}
        loading={loading}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }

  return (
    <PostAcceptStep
      price={price}
      onSignNow={onSignNow}
      onSignLater={onSignLater}
    />
  );
}
