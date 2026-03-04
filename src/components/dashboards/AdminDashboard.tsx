import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Users, CheckSquare, BookOpen, BarChart3 } from 'lucide-react';
import AdminUserManagement from '../admin/AdminUserManagement';
import AdminManufacturerVerification from '../admin/AdminManufacturerVerification';
import AdminKnowledgeManagement from '../admin/AdminKnowledgeManagement';
import AdminAnalytics from '../admin/AdminAnalytics';
import NotificationBell from '../admin/NotificationBell';

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeView, setActiveView] = useState('users');

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

  const profilePhoto = currentUser?.profilePhoto || '';

  const menuItems = [
    { id: 'users', label: 'User Management', icon: <Users size={20} /> },
    { id: 'verification', label: 'Manufacturer Verification', icon: <CheckSquare size={20} /> },
    { id: 'knowledge', label: 'Knowledge Library', icon: <BookOpen size={20} /> },
    { id: 'analytics', label: 'Platform Analytics', icon: <BarChart3 size={20} /> },
  ];

  const renderContent = () => {
    switch (activeView) {
      case 'users':
        return <AdminUserManagement />;
      case 'verification':
        return <AdminManufacturerVerification />;
      case 'knowledge':
        return <AdminKnowledgeManagement />;
      case 'analytics':
        return <AdminAnalytics />;
      default:
        return <AdminUserManagement />;
    }
  };

  const handleViewProfile = () => {
    // Admin doesn't have a profile page, so do nothing or redirect
  };

  const handleEditProfile = () => {
    // Admin doesn't have a profile page, so do nothing or redirect
  };

  return (
    <DashboardLayout
      menuItems={menuItems}
      activeItem={activeView}
      onMenuItemClick={setActiveView}
      onLogout={onLogout}
      onViewProfile={handleViewProfile}
      onEditProfile={handleEditProfile}
      userRole="admin"
      userName="Admin"
      profilePhoto={profilePhoto}
      bellComponent={<NotificationBell />}
    >
      {renderContent()}
    </DashboardLayout>
  );
}