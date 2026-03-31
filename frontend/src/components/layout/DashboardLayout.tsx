import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Menu, X, Bell, LogOut, MessageCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import ProfileDropdown from '../common/ProfileDropdown';
import Logo from '../common/Logo';
import Footer from '../common/Footer';
import LanguageSwitcher from '../common/LanguageSwitcher';
import DarkModeToggle from '../common/DarkModeToggle';
import axios from 'axios';
import { useSocket } from '../../context/SocketContext';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  menuItems: MenuItem[];
  activeItem: string;
  onMenuItemClick: (id: string) => void;
  onLogoClick?: () => void;
  onLogout: () => void;
  userRole: string;
  userName?: string;
  profilePhoto?: string;
  onViewProfile: () => void;
  onEditProfile: () => void;
  editProfileLabel?: string;
  onUpdatePassword?: () => void;
  onViewReviews?: () => void;
  /** Optional custom notification bell component (e.g. for admin) */
  bellComponent?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  menuItems,
  activeItem,
  onMenuItemClick,
  onLogoClick,
  onLogout,
  userRole,
  userName = 'User',
  profilePhoto,
  onViewProfile,
  onEditProfile,
  editProfileLabel,
  onUpdatePassword,
  onViewReviews,
  bellComponent,
}: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket } = useSocket();

  useEffect(() => {
    if (userRole !== 'expert' && userRole !== 'artisan') return;

    const fetchUnreadCount = async () => {
      try {
        let token = localStorage.getItem('token');
        const userStorage = localStorage.getItem('user');
        if (!token && userStorage) {
          try { token = JSON.parse(userStorage).token; } catch (e) {}
        }
        if (!token) return;
        const response = await axios.get('/api/conversations', {
          headers: { Authorization: `Bearer ${token}` }
        });

        const convs = Array.isArray(response.data) ? response.data : [];
        const total = convs.reduce((sum: number, c: any) => sum + (c.unread || 0), 0);
        setUnreadCount(total);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();

    if (socket) {
      const onNewMessage = () => setUnreadCount((prev) => prev + 1);
      socket.on('message:new', onNewMessage);
      return () => {
        socket.off('message:new', onNewMessage);
      };
    }
  }, [userRole, socket]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'artisan': return 'bg-secondary/10 text-secondary';
      case 'expert': return 'bg-accent/10 text-accent';
      case 'manufacturer': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'admin': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col bg-card border-r border-border shadow-sm">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo */}
          <div className="flex items-center h-20 px-6 border-b border-border">
            <button
              type="button"
              onClick={onLogoClick}
              className={onLogoClick ? 'cursor-pointer' : 'cursor-default'}
              aria-label="Go to home"
              disabled={!onLogoClick}
            >
              <Logo />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {menuItems.map((item: any) => (
              <button
                key={item.id}
                onClick={() => onMenuItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : activeItem === item.id
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className={activeItem === item.id ? 'text-white' : ''}>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <div className="w-2 h-2 rounded-full bg-primary dark:bg-blue-500 animate-pulse ml-1" />
                )}
                {activeItem === item.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
                )}
              </button>
            ))}
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t border-border">
            <div className="p-4 rounded-2xl bg-muted">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="w-12 h-12 ring-2 ring-border shadow-md overflow-hidden">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt={userName} className="w-full h-full object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary dark:bg-blue-600 text-white text-lg font-semibold">
                      {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{userName}</p>
                  <Badge className={`${getRoleBadgeColor(userRole)} text-xs font-medium mt-1`}>
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start rounded-xl border-2"
                onClick={onLogout}
              >
                <LogOut size={18} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-16 px-4 bg-card border-b border-border shadow-sm">
        <button
          type="button"
          onClick={onLogoClick}
          className={onLogoClick ? 'flex items-center gap-2 cursor-pointer' : 'flex items-center gap-2 cursor-default'}
          aria-label="Go to home"
          disabled={!onLogoClick}
        >
          <div className="w-8 h-8 rounded-lg bg-primary dark:bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold">B</span>
          </div>
          <h1 className="text-lg font-bold text-primary">BMP.tn</h1>
        </button>
        <div className="flex items-center gap-1">
          {(userRole === 'expert' || userRole === 'artisan') && (
            <button
              onClick={() => { setUnreadCount(0); onMenuItemClick('messages'); }}
              className="p-2 rounded-lg hover:bg-muted relative"
            >
              <MessageCircle size={20} className="text-muted-foreground transition-colors hover:text-primary" />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', color: '#fff', minWidth: 18, height: 18, padding: '0 4px', fontSize: 10, fontWeight: 700, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid transparent', boxSizing: 'border-box' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}
          {bellComponent ?? (
            <button className="p-2 rounded-lg hover:bg-muted relative">
              <Bell size={20} className="text-muted-foreground" />
            </button>
          )}
          <DarkModeToggle />
          <LanguageSwitcher />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-muted"
          >
            {mobileMenuOpen ? (
              <X size={24} className="text-primary" />
            ) : (
              <Menu size={24} className="text-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="absolute top-16 right-0 bottom-0 w-80 bg-card shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="p-4 rounded-2xl bg-muted mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="w-12 h-12 ring-2 ring-border shadow-md overflow-hidden">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <AvatarFallback className="bg-primary dark:bg-blue-600 text-white text-lg font-semibold">
                        {userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground">{userName}</p>
                    <Badge className={`${getRoleBadgeColor(userRole)} text-xs font-medium mt-1`}>
                      {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>

              <nav className="space-y-1 mb-6">
                {menuItems.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onMenuItemClick(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${
                      item.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : activeItem === item.id
                          ? 'bg-primary dark:bg-blue-600 text-white shadow-lg shadow-primary/25'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>

              <Button
                variant="outline"
                className="w-full justify-start rounded-xl border-2"
                onClick={onLogout}
              >
                <LogOut size={18} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Header */}
        <header className="hidden lg:flex items-center justify-between h-20 px-8 bg-card border-b border-border shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {menuItems.find((item) => item.id === activeItem)?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {(userRole === 'expert' || userRole === 'artisan') && (
              <button
                onClick={() => { setUnreadCount(0); onMenuItemClick('messages'); }}
                className="p-3 rounded-xl hover:bg-muted relative transition-colors"
              >
                <MessageCircle size={20} className="text-muted-foreground hover:text-primary transition-colors" />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', color: '#fff', minWidth: 20, height: 20, padding: '0 5px', fontSize: 11, fontWeight: 700, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid transparent', boxSizing: 'border-box' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}
            {bellComponent ?? (
              <button className="p-3 rounded-xl hover:bg-muted relative transition-colors">
                <Bell size={20} className="text-muted-foreground" />
              </button>
            )}
            <DarkModeToggle />
            <LanguageSwitcher />
            <div className="h-10 w-px bg-border mx-2" />
            <ProfileDropdown
              userName={userName}
              userRole={userRole}
              profilePhoto={profilePhoto}
              onViewProfile={onViewProfile}
              onEditProfile={onEditProfile}
              editProfileLabel={editProfileLabel}
              onUpdatePassword={onUpdatePassword}
              onViewReviews={onViewReviews}
              onLogout={onLogout}
            />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8 mt-16 lg:mt-0">
          {children}
        </main>

        {/* Footer */}
        <div className="pb-20 lg:pb-0">
          <Footer />
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg">
          <div className="flex items-center justify-around px-2 py-3">
            {menuItems.slice(0, 5).map((item: any) => (
              <button
                key={item.id}
                onClick={() => onMenuItemClick(item.id)}
                className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all ${
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : activeItem === item.id ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span className={activeItem === item.id ? 'scale-110' : ''}>{item.icon}</span>
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
