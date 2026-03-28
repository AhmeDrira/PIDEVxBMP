import React, { useState, useCallback } from 'react';
import { CreditCard, X } from 'lucide-react';

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="p-7 flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#ede9fe' }}>
            <CreditCard size={28} style={{ color: '#6366f1' }} />
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2">Subscription Required</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            You need an active subscription to access this feature. Subscribe to a plan to unlock all platform capabilities.
          </p>

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={goToSubscription}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#6366f1' }}
            >
              Subscribe Now
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
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
