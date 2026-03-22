import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Home, Package, ShoppingBag, BarChart3 } from 'lucide-react';
import ManufacturerHome from '../manufacturer/ManufacturerHome';
import ManufacturerProducts from '../manufacturer/ManufacturerProducts';
import ManufacturerOrders from '../manufacturer/ManufacturerOrders';
import ManufacturerAnalytics from '../manufacturer/ManufacturerAnalytics';
import ManufacturerProfile from '../manufacturer/ManufacturerProfile';

interface ManufacturerDashboardProps {
  onLogout: () => void;
}

export default function ManufacturerDashboard({ onLogout }: ManufacturerDashboardProps) {
  const [activeView, setActiveView] = useState('home');

  // --- RÉCUPÉRATION DYNAMIQUE ---
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

  // Pour un manufacturer, on affiche le nom de l'entreprise. S'il n'y en a pas, on met le nom du gérant.
  const displayName = currentUser?.companyName || (currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Manufacturer');
  const role = currentUser?.role || 'manufacturer';
  const profilePhoto = currentUser?.profilePhoto || '';
  // ------------------------------

  const menuItems =[
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'products', label: 'My Products', icon: <Package size={20} /> },
    { id: 'orders', label: 'Orders', icon: <ShoppingBag size={20} /> },
    { id: 'analytics', label: 'Sales Analytics', icon: <BarChart3 size={20} /> },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'home':
        return <ManufacturerHome onNavigate={setActiveView} />;
      case 'products':
        return <ManufacturerProducts />;
      case 'orders':
        return <ManufacturerOrders />;
      case 'analytics':
        return <ManufacturerAnalytics />;
      case 'profile':
        return <ManufacturerProfile />;
      default:
        return <ManufacturerHome onNavigate={setActiveView} />;
    }
  };

  return (
    <DashboardLayout
      menuItems={menuItems}
      activeItem={activeView}
      onMenuItemClick={setActiveView}
      onLogoClick={() => setActiveView('home')}
      onLogout={onLogout}
      onViewProfile={() => setActiveView('profile')}
      onEditProfile={() => setActiveView('profile')}
      userRole={role}
      userName={displayName}
      profilePhoto={profilePhoto}
    >
      {renderContent()}
    </DashboardLayout>
  );
}