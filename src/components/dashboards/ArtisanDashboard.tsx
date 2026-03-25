import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Home, FolderKanban, ShoppingCart, FileText, Receipt, MessageSquare, CreditCard, Bell } from 'lucide-react';
import ArtisanHome from '../artisan/ArtisanHome';
import ArtisanProjects from '../artisan/ArtisanProjects';
import ArtisanMarketplace from '../artisan/ArtisanMarketplace';
import ArtisanQuotes from '../artisan/ArtisanQuotes';
import ArtisanInvoices from '../artisan/ArtisanInvoices';
import ArtisanMessages from '../artisan/ArtisanMessages';
import ArtisanSubscription from '../artisan/ArtisanSubscription';
import ArtisanProfile from '../artisan/ArtisanProfile';
import { Button } from '../ui/button';
import NotificationBell from '../common/NotificationBell';

interface ArtisanDashboardProps {
  onLogout: () => void;
}

export default function ArtisanDashboard({ onLogout }: ArtisanDashboardProps) {
  const[activeView, setActiveView] = useState('home');
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as any;
      setCartCount(detail?.count || 0);
    };
    window.addEventListener('cart-count', handler as EventListener);
    return () => {
      window.removeEventListener('cart-count', handler as EventListener);
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
      default:
        return <ArtisanHome onNavigate={setActiveView} />;
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
      bellComponent={
        <div className="flex items-center gap-3">
          <NotificationBell />
          {activeView === 'marketplace' && (
            <Button
              onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))}
              variant="outline"
              className="h-12 px-6 rounded-xl border-2 relative hover:border-primary hover:text-primary transition-colors bg-white shadow-sm"
            >
              <ShoppingCart size={20} className="mr-2" /> Cart
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-destructive flex items-center justify-center text-xs text-white font-bold shadow-lg">
                  {cartCount}
                </span>
              )}
            </Button>
          )}
        </div>
      }
    >
      {renderContent()}
    </DashboardLayout>
  );
}
