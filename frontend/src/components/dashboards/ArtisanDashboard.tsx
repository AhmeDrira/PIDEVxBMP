import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Home, FolderKanban, ShoppingCart, FileText, Receipt, MessageSquare, CreditCard, Image } from 'lucide-react';
import ArtisanHome from '../artisan/ArtisanHome';
import ArtisanProjects from '../artisan/ArtisanProjects';
import ArtisanMarketplace from '../artisan/ArtisanMarketplace';
import ArtisanQuotes from '../artisan/ArtisanQuotes';
import ArtisanInvoices from '../artisan/ArtisanInvoices';
import ArtisanMessages from '../artisan/ArtisanMessages';
import ArtisanSubscription from '../artisan/ArtisanSubscription';
import ArtisanProfile from '../artisan/ArtisanProfile';
import ArtisanPortfolio from '../artisan/ArtisanPortfolio';
import ArtisanNotificationBell from '../artisan/ArtisanNotificationBell';

interface ArtisanDashboardProps {
  onLogout: () => void;
}

export default function ArtisanDashboard({ onLogout }: ArtisanDashboardProps) {
  const[activeView, setActiveView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('artisanView');
    return fromQuery || 'home';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  });
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const handler = () => {
      const s = localStorage.getItem('user');
      setCurrentUser(s ? JSON.parse(s) : null);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('artisanView');
    if (fromQuery) {
      setActiveView(fromQuery);
      params.delete('artisanView');
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

  const fullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Artisan';
  const role = currentUser?.role || 'artisan';
  const profilePhoto = currentUser?.profilePhoto || '';

  const menuItems =[
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'projects', label: 'My Projects', icon: <FolderKanban size={20} /> },
    { id: 'marketplace', label: 'Marketplace', icon: <ShoppingCart size={20} /> },
    { id: 'quotes', label: 'Quotes', icon: <FileText size={20} /> },
    { id: 'invoices', label: 'Invoices', icon: <Receipt size={20} /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare size={20} /> },
    { id: 'subscription', label: 'Subscription', icon: <CreditCard size={20} /> },
    { id: 'portfolio', label: 'Portfolio', icon: <Image size={20} /> },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'home':
        return <ArtisanHome onNavigate={setActiveView} />;
      case 'projects':
        return <ArtisanProjects />;
      case 'marketplace':
        return <ArtisanMarketplace />;
      case 'quotes':
        return <ArtisanQuotes />;
      case 'invoices':
        return <ArtisanInvoices />;
      case 'messages':
        return <ArtisanMessages />;
      case 'subscription':
        return <ArtisanSubscription />;
      case 'profile':
        return <ArtisanProfile />;
      case 'portfolio':
        return <ArtisanPortfolio />;
      default:
        return <ArtisanHome onNavigate={setActiveView} />;
    }
  };

  const handleViewProfile = () => {
    setActiveView('profile');
  };

  const handleEditProfile = () => {
    setActiveView('portfolio');
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
      <ArtisanNotificationBell />
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
      editProfileLabel="View Portfolio"
      userRole={role}
      userName={fullName}
      profilePhoto={profilePhoto}
      bellComponent={headerActions}
    >
      {renderContent()}
    </DashboardLayout>
  );
}