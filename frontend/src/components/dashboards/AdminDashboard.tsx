import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Home, Users, CheckSquare, BookOpen, BarChart3, ShieldOff, History } from 'lucide-react';
import AdminUserManagement from '../admin/AdminUserManagement';
import AdminManufacturerVerification from '../admin/AdminManufacturerVerification';
import AdminKnowledgeManagement from '../admin/AdminKnowledgeManagement';
import AdminAnalytics from '../admin/AdminAnalytics';
import NotificationBell from '../admin/NotificationBell';
import { Card } from '../ui/card';
import AdminProfile from '../admin/AdminProfile';
import UpdatePasswordPage from '../common/UpdatePasswordPage';
import AdminActionLogs from '../admin/AdminActionLogs';

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeView, setActiveView] = useState('home');

  const [currentUser, setCurrentUser] = useState(() => {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  });

  const permissions = currentUser?.permissions || {};
  const isSuperAdmin = Boolean(currentUser?.isSuperAdmin || currentUser?.adminType === 'super');
  const isSubAdmin = currentUser?.adminType === 'sub';

  useEffect(() => {
    const handler = () => {
      const s = localStorage.getItem('user');
      setCurrentUser(s ? JSON.parse(s) : null);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const profilePhoto = currentUser?.profilePhoto || '';

  const menuItems = useMemo(() => ([
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'users', label: 'User Management', icon: <Users size={20} /> },
    {
      id: 'verification',
      label: 'Manufacturer Verification',
      icon: <CheckSquare size={20} />,
      visible: isSuperAdmin || permissions.canVerifyManufacturers,
    },
    {
      id: 'knowledge',
      label: 'Knowledge Library',
      icon: <BookOpen size={20} />,
      visible: isSuperAdmin || permissions.canManageKnowledge,
    },
    {
      id: 'logs',
      label: 'Logs',
      icon: <History size={20} />,
      visible: isSuperAdmin || isSubAdmin,
    },
  ].filter((item) => item.visible !== false)), [isSuperAdmin, isSubAdmin, permissions]);

  const canSuspendUsers = isSuperAdmin || permissions.canSuspendUsers;
  const canDeleteUsers = isSuperAdmin || permissions.canDeleteUsers;
  const canVerifyManufacturers = isSuperAdmin || permissions.canVerifyManufacturers;
  const canManageKnowledge = isSuperAdmin || permissions.canManageKnowledge;

  useEffect(() => {
    if (!menuItems.length) return;
    const isActiveValid =
      activeView === 'profile' ||
      activeView === 'analytics' ||
      activeView === 'update-password' ||
      menuItems.some((item) => item.id === activeView);
    if (!isActiveValid) {
      setActiveView(menuItems[0].id);
    }
  }, [menuItems, activeView]);

  const PermissionNotice = ({ message }: { message: string }) => (
    <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <ShieldOff className="text-primary" size={28} />
      </div>
      <h2 className="text-2xl font-semibold mb-2 text-foreground">Permission Required</h2>
      <p className="text-muted-foreground max-w-md">{message}</p>
    </Card>
  );

  const renderContent = () => {
    switch (activeView) {
      case 'home':
        return <AdminAnalytics onNavigate={setActiveView} />;
      case 'users':
        return (
          <AdminUserManagement
            canSuspendUsers={canSuspendUsers}
            canDeleteUsers={canDeleteUsers}
          />
        );
      case 'verification':
        return canVerifyManufacturers ? (
          <AdminManufacturerVerification canVerifyManufacturers />
        ) : (
          <PermissionNotice message="This admin does not have access to manufacturer verification." />
        );
      case 'knowledge':
        return canManageKnowledge ? (
          <AdminKnowledgeManagement canManageKnowledge />
        ) : (
          <PermissionNotice message="Knowledge library management is disabled for this admin." />
        );
      case 'logs':
        return (isSuperAdmin || isSubAdmin) ? (
          <AdminActionLogs />
        ) : (
          <PermissionNotice message="Only admins can access action logs." />
        );
      case 'analytics':
        return <AdminAnalytics onNavigate={setActiveView} />;
      case 'update-password':
        return isSubAdmin ? <UpdatePasswordPage /> : <PermissionNotice message="This action is only available to sub-admins." />;
      case 'profile':
        return <AdminProfile />;
      default:
        return <AdminUserManagement />;
    }
  };

  const handleViewProfile = () => {
    setActiveView('profile');
  };

  const handleEditProfile = () => {
    setActiveView('profile');
  };

  const handleUpdatePassword = () => {
    if (isSubAdmin) {
      setActiveView('update-password');
    }
  };

  const fullName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Admin' : 'Admin';

  return (
    <DashboardLayout
      menuItems={menuItems}
      activeItem={activeView}
      onMenuItemClick={setActiveView}
      onLogoClick={() => setActiveView('home')}
      onLogout={onLogout}
      onViewProfile={handleViewProfile}
      onEditProfile={handleEditProfile}
      onUpdatePassword={isSubAdmin ? handleUpdatePassword : undefined}
      userRole="admin"
      userName={fullName}
      profilePhoto={profilePhoto}
      bellComponent={<NotificationBell />}
    >
      {renderContent()}
    </DashboardLayout>
  );
}