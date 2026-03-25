import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Home, BookOpen, Users, MessageSquare, ShoppingCart } from 'lucide-react';
import ExpertHome from '../expert/ExpertHome';
import ExpertKnowledgeLibrary from '../expert/ExpertKnowledgeLibrary';
import ExpertArtisanDirectory from '../expert/ExpertArtisanDirectory';
import ExpertMessages from '../expert/ExpertMessages';
import ExpertMarketplace from '../expert/ExpertMarketplace';
import ExpertProfile from '../expert/ExpertProfile';
import ArtisanSubscription from '../artisan/ArtisanSubscription';
import ExpertPayments from '../expert/ExpertPayments';
import { Button } from '../ui/button';
import NotificationBell from '../common/NotificationBell';
import { CreditCard, Wallet } from 'lucide-react';

interface ExpertDashboardProps {
  onLogout: () => void;
}

export default function ExpertDashboard({ onLogout }: ExpertDashboardProps) {
  const [activeView, setActiveView] = useState('home');
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

  const fullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Expert';
  const role = currentUser?.role || 'expert';
  const profilePhoto = currentUser?.profilePhoto || '';

  const menuItems = [
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'library', label: 'Knowledge Library', icon: <BookOpen size={20} /> },
    { id: 'directory', label: 'Artisan Directory', icon: <Users size={20} /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare size={20} /> },
    { id: 'marketplace', label: 'Marketplace', icon: <ShoppingCart size={20} /> },
    { id: 'subscription', label: 'Subscription', icon: <CreditCard size={20} /> },
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
      case 'subscription':
        return <ArtisanSubscription />;
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
