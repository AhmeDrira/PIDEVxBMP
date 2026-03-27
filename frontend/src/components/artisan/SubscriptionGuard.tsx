import React, { useState, useCallback } from 'react';
import { CreditCard, X } from 'lucide-react';

/** Returns true if the artisan has an active subscription */
export const isSubscriptionActive = (): boolean =>
  sessionStorage.getItem('artisan-sub-active') === '1';

/** Popup shown when a non-subscribed artisan tries a gated action */
export function SubscriptionPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: '#6366f1' }}>
            <CreditCard size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Subscription Required</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            You need an active subscription to use this feature.
            Please subscribe to a plan to unlock all platform capabilities.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#6366f1' }}
          >
            Got it
          </button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
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
