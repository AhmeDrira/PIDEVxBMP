import React, { useState } from 'react';
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

  const menuItems = [
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

  const handleViewProfile = () => {
    setActiveView('profile');
  };

  const handleEditProfile = () => {
    setActiveView('profile');
  };

  return (
    <DashboardLayout
      menuItems={menuItems}
      activeItem={activeView}
      onMenuItemClick={setActiveView}
      onLogout={onLogout}
      onViewProfile={handleViewProfile}
      onEditProfile={handleEditProfile}
      userRole="manufacturer"
      userName="BuildMaster Ltd"
    >
      {renderContent()}
    </DashboardLayout>
  );
}