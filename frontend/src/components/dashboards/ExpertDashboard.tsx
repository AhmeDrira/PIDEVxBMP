import { useState, useEffect } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Home, BookOpen, Users, MessageSquare, ShoppingCart } from 'lucide-react';
import ExpertHome from '../expert/ExpertHome';
import ExpertKnowledgeLibrary from '../expert/ExpertKnowledgeLibrary';
import ExpertArtisanDirectory from '../expert/ExpertArtisanDirectory';
import ExpertMessages from '../expert/ExpertMessages';
import ExpertMarketplace from '../expert/ExpertMarketplace';
import ExpertProfile from '../expert/ExpertProfile';
import ExpertPayments from '../expert/ExpertPayments';
import NotificationBell from '../common/NotificationBell';
import { Wallet } from 'lucide-react';

interface ExpertDashboardProps {
  onLogout: () => void;
}

export default function ExpertDashboard({ onLogout }: ExpertDashboardProps) {
  const [activeView, setActiveView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('expertView') || params.get('artisanView');
    return fromQuery || 'home';
  });
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromMarketplaceQuery = params.get('expertView') || params.get('artisanView');
    const view = params.get('view');
    if (fromMarketplaceQuery) {
      setActiveView(fromMarketplaceQuery);
      params.delete('expertView');
      params.delete('artisanView');
      const cleaned = params.toString();
      window.history.replaceState({}, '', cleaned ? `/?${cleaned}` : '/');
      return;
    }
    if (view === 'payments') {
      setActiveView('payments');
      // Clean up the URL to remove the parameter
      params.delete('view');
      const cleaned = params.toString();
      window.history.replaceState({}, '', cleaned ? `/?${cleaned}` : '/');
    }
  }, []);

  useEffect(() => {
    const syncCartCount = () => {
      try {
        const raw = sessionStorage.getItem('artisan-marketplace-cart');
        if (!raw) {
          setCartCount(0);
          return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          setCartCount(0);
          return;
        }
        const totalQty = parsed.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0);
        setCartCount(totalQty);
      } catch {
        setCartCount(0);
      }
    };

    syncCartCount();
    window.addEventListener('storage', syncCartCount);
    window.addEventListener('artisan-cart-updated', syncCartCount as EventListener);
    window.addEventListener('focus', syncCartCount);
    return () => {
      window.removeEventListener('storage', syncCartCount);
      window.removeEventListener('artisan-cart-updated', syncCartCount as EventListener);
      window.removeEventListener('focus', syncCartCount);
    };
  }, []);

  const [currentUser, setCurrentUser] = useState(() => {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  });

  useEffect(() => {
    const handler = () => {
      const s = localStorage.getItem('user');
      setCurrentUser(s ? JSON.parse(s) : null);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const fullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Expert';
  const role = currentUser?.role || 'expert';
  const profilePhoto = currentUser?.profilePhoto || '';

  const menuItems = [
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'library', label: 'Knowledge Library', icon: <BookOpen size={20} /> },
    { id: 'directory', label: 'Artisan Directory', icon: <Users size={20} /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare size={20} /> },
    { id: 'marketplace', label: 'Marketplace', icon: <ShoppingCart size={20} /> },
    { id: 'payments', label: 'Payments', icon: <Wallet size={20} /> },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'home':
        return <ExpertHome onNavigate={setActiveView} />;
      case 'library':
        return <ExpertKnowledgeLibrary />;
      case 'directory':
        return <ExpertArtisanDirectory onNavigate={setActiveView} />;
      case 'messages':
        return <ExpertMessages />;
      case 'marketplace':
        return <ExpertMarketplace />;
      case 'payments':
        return <ExpertPayments />;
      case 'profile':
        return <ExpertProfile />;
      default:
        return <ExpertHome onNavigate={setActiveView} />;
    }
  };

  const handleViewProfile = () => {
    setActiveView('profile');
  };

  const handleEditProfile = () => {
    setActiveView('profile');
  };

  const handleUpdatePassword = () => {
    setActiveView('update-password');
  };

  const openHeaderCart = () => {
    setActiveView('marketplace');
    window.history.pushState({}, '', '/?artisanView=marketplace&openCart=1');
    window.dispatchEvent(new Event('artisan-open-cart'));
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <button
        className="p-3 rounded-xl hover:bg-gray-100 relative overflow-visible transition-colors"
        type="button"
        aria-label="Open cart"
        onClick={openHeaderCart}
      >
        <ShoppingCart size={20} className="text-muted-foreground" />
        {cartCount > 0 && (
          <span
            className="absolute top-0 right-0 z-20 inline-flex h-5 min-w-5 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none shadow-sm"
            style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
          >
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        )}
      </button>
    </div>
  );

  return (
    <DashboardLayout
      menuItems={menuItems}
      activeItem={activeView}
      onMenuItemClick={setActiveView}
      onLogoClick={() => setActiveView('home')}
      onLogout={onLogout}
      onViewProfile={handleViewProfile}
      onEditProfile={handleEditProfile}
      userRole={role}
      userName={fullName}
      profilePhoto={profilePhoto}
      bellComponent={headerActions}
    >
      {renderContent()}
    </DashboardLayout>
  );
}
