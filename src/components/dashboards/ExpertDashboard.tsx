import React, { useState } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Home, BookOpen, Users, MessageSquare, ShoppingCart } from 'lucide-react';
import ExpertHome from '../expert/ExpertHome';
import ExpertKnowledgeLibrary from '../expert/ExpertKnowledgeLibrary';
import ExpertArtisanDirectory from '../expert/ExpertArtisanDirectory';
import ExpertMessages from '../expert/ExpertMessages';
import ExpertMarketplace from '../expert/ExpertMarketplace';
import ExpertProfile from '../expert/ExpertProfile';

interface ExpertDashboardProps {
  onLogout: () => void;
}

export default function ExpertDashboard({ onLogout }: ExpertDashboardProps) {
  const [activeView, setActiveView] = useState('home');

  const menuItems = [
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'library', label: 'Knowledge Library', icon: <BookOpen size={20} /> },
    { id: 'directory', label: 'Artisan Directory', icon: <Users size={20} /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare size={20} /> },
    { id: 'marketplace', label: 'Marketplace', icon: <ShoppingCart size={20} /> },
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

  return (
    <DashboardLayout
      menuItems={menuItems}
      activeItem={activeView}
      onMenuItemClick={setActiveView}
      onLogout={onLogout}
      onViewProfile={handleViewProfile}
      onEditProfile={handleEditProfile}
      userRole="expert"
      userName="Dr. Karim Mansour"
    >
      {renderContent()}
    </DashboardLayout>
  );
}