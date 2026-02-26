import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Menu, X, Bell, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import ProfileDropdown from '../common/ProfileDropdown';
import Logo from '../common/Logo';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  menuItems: MenuItem[];
  activeItem: string;
  onMenuItemClick: (id: string) => void;
  onLogout: () => void;
  userRole: string;
  userName?: string;
  onViewProfile: () => void;
  onEditProfile: () => void;
}

export default function DashboardLayout({
  children,
  menuItems,
  activeItem,
  onMenuItemClick,
  onLogout,
  userRole,
  userName = 'User',
  onViewProfile,
  onEditProfile,
}: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'artisan': return 'bg-secondary/10 text-secondary';
      case 'expert': return 'bg-accent/10 text-accent';
      case 'manufacturer': return 'bg-purple-100 text-purple-700';
      case 'admin': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col bg-white border-r border-gray-200 shadow-sm">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo */}
          <div className="flex items-center h-20 px-6 border-b border-gray-200">
            <Logo />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onMenuItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${
                  activeItem === item.id
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-muted-foreground hover:bg-gray-50 hover:text-foreground'
                }`}
              >
                <span className={activeItem === item.id ? 'text-white' : ''}>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {activeItem === item.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </button>
            ))}
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t border-gray-200">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="w-12 h-12 ring-2 ring-white shadow-md">
                  <AvatarFallback className="bg-primary text-white text-lg font-semibold">
                    {userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
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
                className="w-full justify-start rounded-xl border-2 hover:bg-white"
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold">B</span>
          </div>
          <h1 className="text-lg font-bold text-primary">BMP.tn</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-gray-100 relative">
            <Bell size={20} className="text-muted-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive"></span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
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
            className="absolute top-16 right-0 bottom-0 w-80 bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="w-12 h-12 ring-2 ring-white shadow-md">
                    <AvatarFallback className="bg-primary text-white text-lg font-semibold">
                      {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
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
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onMenuItemClick(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${
                      activeItem === item.id
                        ? 'bg-primary text-white shadow-lg shadow-primary/25'
                        : 'text-muted-foreground hover:bg-gray-50 hover:text-foreground'
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
        <header className="hidden lg:flex items-center justify-between h-20 px-8 bg-white border-b border-gray-200 shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {menuItems.find((item) => item.id === activeItem)?.label || 'Dashboard'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Welcome back, {userName.split(' ')[0]}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-3 rounded-xl hover:bg-gray-100 relative transition-colors">
              <Bell size={20} className="text-muted-foreground" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive ring-2 ring-white"></span>
            </button>
            <div className="h-10 w-px bg-gray-200" />
            <ProfileDropdown
              userName={userName}
              userRole={userRole}
              onViewProfile={onViewProfile}
              onEditProfile={onEditProfile}
              onLogout={onLogout}
            />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8 mt-16 lg:mt-0 mb-20 lg:mb-0">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="flex items-center justify-around px-2 py-3">
            {menuItems.slice(0, 4).map((item) => (
              <button
                key={item.id}
                onClick={() => onMenuItemClick(item.id)}
                className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all ${
                  activeItem === item.id ? 'text-primary' : 'text-muted-foreground'
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