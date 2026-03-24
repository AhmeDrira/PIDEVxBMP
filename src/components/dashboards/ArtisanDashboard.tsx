import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Home, FolderKanban, ShoppingCart, FileText, Receipt, MessageSquare, CreditCard, Image, Bell } from 'lucide-react';
import ArtisanHome from '../artisan/ArtisanHome';
import ArtisanProjects from '../artisan/ArtisanProjects';
import ArtisanMarketplace from '../artisan/ArtisanMarketplace';
import ArtisanQuotes from '../artisan/ArtisanQuotes';
import ArtisanInvoices from '../artisan/ArtisanInvoices';
import ArtisanMessages from '../artisan/ArtisanMessages';
import ArtisanSubscription from '../artisan/ArtisanSubscription';
import ArtisanProfile from '../artisan/ArtisanProfile';
import ArtisanPortfolio from '../artisan/ArtisanPortfolio';

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
    window.history.pushState({}, '', '/?openCart=1');
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <button className="p-3 rounded-xl hover:bg-gray-100 relative transition-colors" type="button" aria-label="Notifications">
        <Bell size={20} className="text-muted-foreground" />
      </button>
      <button
        className="p-2.5 w-11 h-11 rounded-xl relative overflow-visible transition-all duration-300 flex items-center justify-center hover:bg-gray-100"
        type="button"
        aria-label="Open cart"
        onClick={openHeaderCart}
      >
        <ShoppingCart size={20} className="text-gray-700" />
        {cartCount > 0 && (
          <span className="absolute -top-2 right-0 translate-x-1/2 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-destructive text-[11px] font-extrabold text-white shadow-md">
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
      editProfileLabel="Portfolio"
      userRole={role}
      userName={fullName}
      profilePhoto={profilePhoto}
      bellComponent={headerActions}
    >
      {renderContent()}
    </DashboardLayout>
  );
}