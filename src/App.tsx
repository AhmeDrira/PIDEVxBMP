import { useState, useEffect } from 'react';
import LoginPage from './components/auth/LoginPage';
import AdminLoginPage from './components/auth/AdminLoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import AdminCreatePage from './components/auth/AdminCreatePage';
import ManufacturerWaitingPage from './components/auth/ManufacturerWaitingPage';
import ArtisanDashboard from './components/dashboards/ArtisanDashboard';
import ExpertDashboard from './components/dashboards/ExpertDashboard';
import ManufacturerDashboard from './components/dashboards/ManufacturerDashboard';
import AdminDashboard from './components/dashboards/AdminDashboard';
import authService from './services/authService';
import { Toaster, toast } from 'sonner';
import RoleGuard from './components/common/RoleGuard';

type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin' | null;
type AuthView = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'admin-create' | 'manufacturer-waiting' | 'admin-login' | 'admin-forgot-password';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserRole>(null);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetRole, setResetRole] = useState<string | null>(null);
  const [allowAdminSetup, setAllowAdminSetup] = useState<boolean>(false);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user && user.role) {
      setCurrentUser(user.role as UserRole);
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const role = params.get('role');
    if (token) {
      setResetToken(token);
      if (role) setResetRole(role);
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
    setCurrentUser(role);
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

  const handleRegister = (role: UserRole, isPending: boolean = false) => {
    handleLogin(role, isPending);
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
              onForgotPassword={() => setAuthView('forgot-password')}
              onAdminCreate={() => setAuthView('admin-create')}
              allowAdminCreate={false}
            />
          )}
          {authView === 'admin-login' && (
            <AdminLoginPage
              onLogin={(role) => handleLogin(role)}
              onAdminCreate={() => setAuthView('admin-create')}
              onForgotPassword={() => setAuthView('admin-forgot-password')}
            />
          )}
          {authView === 'register' && (
            <RegisterPage
              onRegister={handleRegister}
              onBackToLogin={() => setAuthView('login')}
            />
          )}
          {authView === 'forgot-password' && (
            <ForgotPasswordPage
              onBackToLogin={() => setAuthView('login')}
            />
          )}
          {authView === 'admin-forgot-password' && (
            <ForgotPasswordPage
              onBackToLogin={() => setAuthView('admin-login')}
            />
          )}
          {authView === 'reset-password' && (
            <ResetPasswordPage
              onBackToLogin={() => setAuthView(resetRole === 'admin' ? 'admin-login' : 'login')}
              token={resetToken}
            />
          )}
          {authView === 'admin-create' && (
            <AdminCreatePage
              onBackToLogin={() => setAuthView('login')}
              onCreated={() => setAuthView('login')}
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
