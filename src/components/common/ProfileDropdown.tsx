import React, { useState } from 'react';
import { ChevronDown, User, LogOut, Settings } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';

interface ProfileDropdownProps {
  userName: string;
  userRole: string;
  onViewProfile: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
}

export default function ProfileDropdown({ userName, userRole, onViewProfile, onEditProfile, onLogout }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

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
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <Avatar className="w-10 h-10 ring-2 ring-gray-200">
          <AvatarFallback className="bg-primary text-white font-semibold">
            {userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="text-left hidden xl:block">
          <p className="text-sm font-semibold text-foreground">{userName}</p>
          <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
        </div>
        <ChevronDown size={16} className="text-muted-foreground hidden xl:block" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border-0 z-50 overflow-hidden">
            <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-b-2 border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <Avatar className="w-12 h-12 ring-2 ring-white shadow-md">
                  <AvatarFallback className="bg-primary text-white font-semibold text-lg">
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
            </div>
            
            <div className="py-2">
              <button
                onClick={() => {
                  onViewProfile();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <User size={18} className="text-muted-foreground" />
                <span className="font-medium text-foreground">View Profile</span>
              </button>
              
              <button
                onClick={() => {
                  onEditProfile();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <Settings size={18} className="text-muted-foreground" />
                <span className="font-medium text-foreground">Edit Profile</span>
              </button>
              
              <div className="my-2 h-px bg-gray-200" />
              
              <button
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-destructive/5 transition-colors text-left text-destructive"
              >
                <LogOut size={18} />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
