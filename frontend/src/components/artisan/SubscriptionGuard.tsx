import React, { useState, useCallback } from 'react';
import { Crown, X, Zap, CheckCircle } from 'lucide-react';

/** Returns true if the artisan has an active subscription */
export const isSubscriptionActive = (): boolean =>
  sessionStorage.getItem('artisan-sub-active') === '1';

/** Popup shown when a non-subscribed artisan tries a gated action */
export function SubscriptionPopup({ onClose }: { onClose: () => void }) {
  const goToSubscription = () => {
    onClose();
    window.location.href = '/?artisanView=subscription';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />

      {/* Card */}
      <div style={{
        position: 'relative', background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(15,23,42,0.18)', overflow: 'hidden',
        animation: 'popIn 0.2s ease-out',
      }}>
        {/* Blue top banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1e40af, #2563eb)',
          padding: '28px 28px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14, width: 32, height: 32,
              borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>

          {/* Icon */}
          <div style={{
            width: 60, height: 60, borderRadius: 16, background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <Crown size={30} color="#ffffff" />
          </div>

          <h2 style={{ color: '#ffffff', fontSize: 20, fontWeight: 800, margin: 0, textAlign: 'center', letterSpacing: '-0.3px' }}>
            Subscription Required
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: '8px 0 0', textAlign: 'center', lineHeight: 1.5 }}>
            Unlock all platform features with an active plan
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px 28px' }}>
          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {[
              'Manage projects & generate quotes',
              'Create and send professional invoices',
              'Showcase your portfolio to experts',
            ].map((feat) => (
              <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={16} style={{ color: '#1e40af', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{feat}</span>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <button
            onClick={goToSubscription}
            style={{
              width: '100%', height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #1e40af, #2563eb)', color: '#ffffff',
              fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 10, boxShadow: '0 4px 14px rgba(30,64,175,0.35)',
            }}
          >
            <Zap size={16} />
            Subscribe Now
          </button>
          <button
            onClick={onClose}
            style={{
              width: '100%', height: 40, borderRadius: 12, border: '1.5px solid #e5e7eb',
              background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Not now
          </button>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/**
 * Hook that returns a guard function + the popup JSX.
 *
 * Usage:
 *   const { guard, PopupElement } = useSubscriptionGuard();
 *   <button onClick={() => guard(doSomething)}>Action</button>
 *   {PopupElement}
 */
export function useSubscriptionGuard() {
  const [showPopup, setShowPopup] = useState(false);

  const guard = useCallback((action: () => void) => {
    if (!isSubscriptionActive()) {
      setShowPopup(true);
      return;
    }
    action();
  }, []);

  const PopupElement = showPopup
    ? <SubscriptionPopup onClose={() => setShowPopup(false)} />
    : null;

  return { guard, PopupElement };
}
