import { useState, useEffect } from 'react';
import LoginPage from './components/auth/LoginPage';
import AdminLoginPage from './components/auth/AdminLoginPage';
import SubAdminRegisterPage from './components/auth/SubAdminRegisterPage';
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
import { Toaster } from 'sonner';
import RoleGuard from './components/common/RoleGuard';
import PortfolioGalleryPage from './components/artisan/PortfolioGalleryPage';

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
  | 'sub-admin-forgot'
  | 'sub-admin-register';

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
  }, []);

  const renderDashboard = () => {
    const path = window.location.pathname;
    if (path.startsWith('/portfolio/gallery/')) {
      const itemId = path.split('/')[3];
      return <PortfolioGalleryPage itemId={itemId} />;
    }

    switch (currentUser) {
      case 'artisan':
        return <ArtisanDashboard onLogout={handleLogout} />;
      case 'expert':
        return <ExpertDashboard onLogout={handleLogout} />;
      case 'manufacturer':
        return <ManufacturerDashboard onLogout={handleLogout} />;
      case 'admin':
        return <AdminDashboard onLogout={handleLogout} />;
      default:
        return null;
    }
  };

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
      if (adminType === 'sub-admin') {
        navigateToSubAdminLogin();
      } else {
        navigateToAdminLogin();
      }
    } else {
      setAuthView('login');
      window.history.pushState({}, '', '/');
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

  const handleSubAdminEmailSent = (email: string) => {
    setRegisteredEmail(email);
    setEmailSentTarget('admin-login');
    setAuthView('email-sent');
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

  const renderAuthView = () => {
    switch (authView) {
      case 'login':
        return (
          <LoginPage
            onLogin={handleLogin}
            onRegisterClick={() => setAuthView('register')}
            onForgotPasswordClick={() => setAuthView('forgot-password')}
            onAdminLoginClick={navigateToAdminLogin}
          />
        );
      case 'register':
        return (
          <RegisterPage
            onRegister={(email) => {
              setRegisteredEmail(email);
              setEmailSentTarget('login');
              setAuthView('email-sent');
            }}
            onLoginClick={() => setAuthView('login')}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordPage
            onEmailSent={(email) => {
              setForgotEmail(email);
              setAuthView('email-sent');
              setEmailSentTarget('login');
            }}
            onBackToLogin={() => setAuthView('login')}
          />
        );
      case 'reset-password':
        return <ResetPasswordPage token={resetToken!} onPasswordReset={() => setAuthView('login')} />;
      case 'verify-email':
        return <VerifyEmailPage onVerified={() => setAuthView('login')} />;
      case 'email-sent':
        return <EmailSentPage email={registeredEmail || forgotEmail} onNavigateBack={() => setAuthView(emailSentTarget)} />;
      case 'manufacturer-waiting':
        return <ManufacturerWaitingPage onLogout={handleLogout} />;
      case 'admin-login':
        return (
          <AdminLoginPage
            onLogin={handleLogin}
            onSubAdminLoginClick={navigateToSubAdminLogin}
            onUserLoginClick={() => setAuthView('login')}
          />
        );
      case 'sub-admin-login':
        return (
          <SubAdminLoginPage
            onLogin={handleLogin}
            onAdminLoginClick={navigateToAdminLogin}
            onForgotPasswordClick={() => setAuthView('sub-admin-forgot')}
          />
        );
      case 'sub-admin-forgot':
        return (
          <SubAdminForgotPasswordPage
            onEmailSent={(email) => {
              setForgotEmail(email);
              setEmailSentTarget('sub-admin-login');
              setAuthView('email-sent');
            }}
            onBackToLogin={navigateToSubAdminLogin}
          />
        );
      case 'sub-admin-register':
        return (
          <SubAdminRegisterPage
            onRegister={(email) => {
              setRegisteredEmail(email);
              setEmailSentTarget('sub-admin-login');
              setAuthView('email-sent');
            }}
            onLoginClick={navigateToSubAdminLogin}
          />
        );
      default:
        return <LoginPage onLogin={handleLogin} onRegisterClick={() => setAuthView('register')} onForgotPasswordClick={() => setAuthView('forgot-password')} onAdminLoginClick={navigateToAdminLogin} />;
    }
  };

  return (
    <>
      <Toaster
        richColors
        position="top-center"
        offset={48}
        toastOptions={{
          style: {
            zIndex: 99999,
          },
        }}
      />
      {currentUser ? renderDashboard() : renderAuthView()}
    </>
  );
}
