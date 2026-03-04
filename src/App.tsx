import { useState, useEffect } from 'react';
import LoginPage from './components/auth/LoginPage';
import AdminLoginPage from './components/auth/AdminLoginPage';
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

type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin' | null;
type AuthView = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'verify-email' | 'email-sent' | 'manufacturer-waiting' | 'admin-login';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserRole>(null);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [forgotEmail, setForgotEmail] = useState<string>('');

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
    if (window.location.pathname === '/admin' || params.get('setup') === 'admin') {
      setAuthView('admin-login');
      // Clean up URL without reload
      window.history.replaceState({}, '', '/');
    } else if (params.get('view') === 'register') {
      setAuthView('register');
    }
  }, []);

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
      setAuthView('admin-login');
    } else {
      setAuthView('login');
    }
  };

  const handleRegister = (role: UserRole, isPending: boolean = false, email?: string) => {
    if (email) {
      setRegisteredEmail(email);
      setAuthView('email-sent');
    } else {
      handleLogin(role, isPending);
    }
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
          {authView === 'register' && (
            <RegisterPage
              onRegister={handleRegister}
              onBackToLogin={() => setAuthView('login')}
            />
          )}
          {authView === 'email-sent' && (
            <EmailSentPage
              email={registeredEmail}
              onBackToLogin={() => setAuthView('login')}
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
            {currentUser === 'artisan' && <ArtisanDashboard onLogout={handleLogout} />}
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
    </>
  );
}
