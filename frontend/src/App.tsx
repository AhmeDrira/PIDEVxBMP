import { useState, useEffect } from 'react';
import LoginPage from './components/auth/LoginPage';
import AdminLoginPage from './components/auth/AdminLoginPage';
import SubAdminLoginPage from './components/auth/SubAdminLoginPage';
import SubAdminForgotPasswordPage from './components/auth/SubAdminForgotPasswordPage';
import RegisterPage from './components/auth/RegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import VerifyEmailPage from './components/auth/VerifyEmailPage';
import EmailSentPage from './components/auth/EmailSentPage';
import ManufacturerWaitingPage from './components/auth/ManufacturerWaitingPage';
import ArtisanDashboard from './components/dashboards/ArtisanDashboard';
import ExpertDashboard from './components/dashboards/ExpertDashboard';
import ManufacturerDashboard from './components/dashboards/ManufacturerDashboard';
import AdminDashboard from './components/dashboards/AdminDashboard';
import authService from './services/authService';
import { Toaster, toast } from 'sonner';
import RoleGuard from './components/common/RoleGuard';
import PortfolioGalleryPage from './components/artisan/PortfolioGalleryPage';
import KeyboardShortcutsHelp from './components/common/KeyboardShortcutsHelp';
import axios from 'axios';

type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin' | null;
type AuthView =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password'
  | 'verify-email'
  | 'email-sent'
  | 'manufacturer-waiting'
  | 'admin-login'
  | 'sub-admin-login'
  | 'sub-admin-forgot';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserRole>(null);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [emailSentTarget, setEmailSentTarget] = useState<'login' | 'admin-login' | 'sub-admin-login'>('login');

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user && user.role) {
      const role = user.role === 'user' ? 'artisan' : user.role;
      setCurrentUser(role as UserRole);
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (window.location.pathname === '/verify-email' || (token && !window.location.pathname.includes('reset-password'))) {
      setAuthView('verify-email');
    } else if (token) {
      setResetToken(token);
      setAuthView('reset-password');
    }
    
    // Check for /admin path or setup=admin
    const path = window.location.pathname;
    if (path === '/admin/sub-admin') {
      setAuthView('sub-admin-login');
    } else if (path === '/admin' || params.get('setup') === 'admin') {
      setAuthView('admin-login');
    } else if (params.get('view') === 'register') {
      setAuthView('register');
    }

    // Handle Checkout Success
    const checkoutStatus = params.get('checkout');
    const sessionId = params.get('session_id');
    
    if (checkoutStatus === 'success' && sessionId) {
      const verifyCheckout = async () => {
        try {
          const user = authService.getCurrentUser();
          const token = user?.token || localStorage.getItem('token');
          if (!token) return;

          const API_URL = '/api';
          await axios.get(`${API_URL}/payments/checkout/verify?sessionId=${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          toast.success("Payment successful! Your order has been placed.");
          // Clean up URL and redirect to payments view if possible
          const redirectUrl = user?.role === 'expert' || user?.role === 'artisan' ? '/?view=payments' : '/';
          window.history.replaceState({}, '', redirectUrl);
          // Trigger a storage event to update the dashboard if it's already open
          window.dispatchEvent(new Event('storage'));
        } catch (err) {
          console.error("Verification error:", err);
          toast.error("There was an error verifying your payment.");
        }
      };
      verifyCheckout();
    } else if (checkoutStatus === 'cancel') {
      toast.error("Payment cancelled.");
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const navigateToAdminLogin = () => {
    setAuthView('admin-login');
    if (window.location.pathname !== '/admin') {
      window.history.pushState({}, '', '/admin');
    }
  };

  const navigateToSubAdminLogin = () => {
    setAuthView('sub-admin-login');
    if (window.location.pathname !== '/admin/sub-admin') {
      window.history.pushState({}, '', '/admin/sub-admin');
    }
  };

  const handleLogin = (role: UserRole, isPending: boolean = false) => {
    if (isPending || (role === 'manufacturer' && authService.getCurrentUser()?.verificationStatus === 'pending')) {
      setAuthView('manufacturer-waiting');
      return;
    }
    // Normalize legacy 'user' role (old OAuth accounts) to 'artisan'
    const effectiveRole: UserRole = (role as string) === 'user' ? 'artisan' : role;
    setCurrentUser(effectiveRole);
  };

  const handleLogout = () => {
    const user = authService.getCurrentUser();
    const isAdmin = user && user.role === 'admin';
    authService.logout();
    setCurrentUser(null);
    if (isAdmin) {
      const adminType = user?.adminType;
      if (adminType === 'sub') {
        navigateToSubAdminLogin();
      } else {
        navigateToAdminLogin();
      }
    } else {
      setAuthView('login');
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
    }
  };

  const handleRegister = (role: UserRole, isPending: boolean = false, email?: string) => {
    if (email) {
      setRegisteredEmail(email);
      setEmailSentTarget('login');
      setAuthView('email-sent');
    } else {
      handleLogin(role, isPending);
    }
  };

  const handleEmailSentBack = () => {
    if (emailSentTarget === 'admin-login') {
      navigateToAdminLogin();
      return;
    }
    if (emailSentTarget === 'sub-admin-login') {
      navigateToSubAdminLogin();
      return;
    }
    setAuthView('login');
  };

  const getPortfolioGalleryItemId = () => {
    const path = window.location.pathname;
    if (!path.startsWith('/portfolio/gallery/')) return null;
    const itemId = path.split('/')[3];
    return itemId || null;
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      {/* Main Content */}
      {!currentUser ? (
        <>
          {authView === 'login' && (
            <LoginPage
              onLogin={handleLogin}
              onRegister={() => setAuthView('register')}
              onForgotPassword={(email) => { setForgotEmail(email || ''); setAuthView('forgot-password'); }}
            />
          )}
          {authView === 'admin-login' && (
            <AdminLoginPage
              onLogin={(role) => handleLogin(role)}
            />
          )}
          {authView === 'sub-admin-login' && (
            <SubAdminLoginPage
              onLogin={(role) => handleLogin(role)}
              onForgotPassword={() => setAuthView('sub-admin-forgot')}
            />
          )}
          {authView === 'sub-admin-forgot' && (
            <SubAdminForgotPasswordPage
              onBackToLogin={navigateToSubAdminLogin}
            />
          )}
          {authView === 'register' && (
            <RegisterPage
              onRegister={handleRegister}
              onBackToLogin={() => setAuthView('login')}
            />
          )}
          {authView === 'email-sent' && (
            <EmailSentPage
              email={registeredEmail}
              onBackToLogin={handleEmailSentBack}
            />
          )}
          {authView === 'forgot-password' && (
            <ForgotPasswordPage
              onBackToLogin={() => setAuthView('login')}
              initialEmail={forgotEmail || undefined}
            />
          )}
          {authView === 'reset-password' && (
            <ResetPasswordPage
              onBackToLogin={() => setAuthView('login')}
              token={resetToken}
            />
          )}
          {authView === 'verify-email' && (
            <VerifyEmailPage
              onBackToLogin={() => setAuthView('login')}
            />
          )}
          {authView === 'manufacturer-waiting' && (
            <ManufacturerWaitingPage
              onBackToLogin={() => setAuthView('login')}
            />
          )}
        </>
      ) : (
        <>
          <RoleGuard allow={['artisan']}>
            {currentUser === 'artisan' && (() => {
              const itemId = getPortfolioGalleryItemId();
              return itemId
                ? <PortfolioGalleryPage itemId={itemId} />
                : <ArtisanDashboard onLogout={handleLogout} />;
            })()}
          </RoleGuard>
          <RoleGuard allow={['expert']}>
            {currentUser === 'expert' && <ExpertDashboard onLogout={handleLogout} />}
          </RoleGuard>
          <RoleGuard allow={['manufacturer']}>
            {currentUser === 'manufacturer' && <ManufacturerDashboard onLogout={handleLogout} />}
          </RoleGuard>
          <RoleGuard allow={['admin']}>
            {currentUser === 'admin' && <AdminDashboard onLogout={handleLogout} />}
          </RoleGuard>
        </>
      )}

      <KeyboardShortcutsHelp />
    </>
  );
}
