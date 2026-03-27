import { useEffect } from 'react';
import authService from '../../services/authService';
import { toast } from 'sonner';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleLoginButtonProps {
  onSuccess: (userData: any) => void;
  variant?: 'signin' | 'signup';
  role?: string;
}

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google script'));
    document.body.appendChild(script);
  });
}

export function GoogleLoginButton({ onSuccess, variant = 'signin', role }: GoogleLoginButtonProps) {
  useEffect(() => {
    loadGoogleScript().catch(() =>
      console.error('Google Identity Services script failed to load')
    );
  }, []);

  const handleClick = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error('Google Client ID is not configured (VITE_GOOGLE_CLIENT_ID).');
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      toast.error('Google Sign-In is still loading, please try again.');
      return;
    }

    // initTokenClient opens a standard Google OAuth2 popup — works on HTTP/HTTPS
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'email profile',
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          toast.error('Google sign-in failed: ' + tokenResponse.error);
          return;
        }
        authService
          .loginWithGoogle(tokenResponse.access_token, role)
          .then((userData) => {
            toast.success('Signed in with Google');
            onSuccess(userData);
          })
          .catch((error: any) => {
            const message =
              error?.response?.data?.message || 'Unable to sign in with Google.';
            toast.error(message);
          });
      },
    });

    client.requestAccessToken();
  };

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <button
        type="button"
        onClick={handleClick}
        style={{
          width: '340px',
          maxWidth: '100%',
          height: '40px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          backgroundColor: '#ffffff',
          color: '#3c4043',
          fontSize: '14px',
          fontWeight: '600',
          border: '1px solid #dadce0',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
          position: 'relative',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f8f9fa';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#ffffff';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <span>{variant === 'signup' ? 'Sign up with Google' : 'Continue with Google'}</span>
      </button>
    </div>
  );
}
