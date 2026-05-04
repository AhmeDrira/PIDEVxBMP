import React, { useState } from 'react';
import { ChevronDown, User, LogOut, Settings, KeyRound, Star, SlidersHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { useLanguage } from '../../context/LanguageContext';

interface ProfileDropdownProps {
  userName: string;
  userRole: string;
  profilePhoto?: string;
  onViewProfile: () => void;
  onEditProfile: () => void;
  editProfileLabel?: string;
  onUpdatePassword?: () => void;
  onViewReviews?: () => void;
  onPersonalisation?: () => void;
  onLogout: () => void;
}

export default function ProfileDropdown({ userName, userRole, profilePhoto, onViewProfile, onEditProfile, editProfileLabel, onUpdatePassword, onViewReviews, onPersonalisation, onLogout }: ProfileDropdownProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      // High-contrast (WCAG AA) badge colors — text on bg ratio ≥ 4.5:1
      case 'artisan': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
      case 'expert': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
      case 'manufacturer': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200';
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
      default: return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors"
      >
        <Avatar className="w-10 h-10 ring-2 ring-border">
          <AvatarImage src={profilePhoto || undefined} alt={userName} className="object-cover" />
          <AvatarFallback className="text-white font-semibold" style={{ backgroundColor: 'var(--sidebar-primary)' }}>
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
          <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-2xl shadow-2xl border-0 z-50 overflow-hidden">
            <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-b-2 border-border">
              <div className="flex items-center gap-3 mb-2">
                <Avatar className="w-12 h-12 ring-2 ring-border shadow-md overflow-hidden">
                  <AvatarImage src={profilePhoto || undefined} alt={userName} className="object-cover" />
                  <AvatarFallback className="text-white font-semibold text-lg" style={{ backgroundColor: 'var(--sidebar-primary)' }}>
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
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <User size={18} className="text-muted-foreground" />
                <span className="font-medium text-foreground">{t('profile.viewProfile')}</span>
              </button>
              
              <button
                onClick={() => {
                  onEditProfile();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <Settings size={18} className="text-muted-foreground" />
                <span className="font-medium text-foreground">{editProfileLabel || t('profile.editProfile')}</span>
              </button>

              {onViewReviews && (
                <button
                  onClick={() => {
                    onViewReviews();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <Star size={18} className="text-muted-foreground" />
                  <span className="font-medium text-foreground">{t('profile.viewReviews')}</span>
                </button>
              )}

              {onUpdatePassword && (
                <button
                  onClick={() => {
                    onUpdatePassword();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <KeyRound size={18} className="text-muted-foreground" />
                  <span className="font-medium text-foreground">{t('profile.updatePassword')}</span>
                </button>
              )}
              
              {onPersonalisation && (
                <button
                  onClick={() => {
                    onPersonalisation();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <SlidersHorizontal size={18} className="text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {tr('Personalisation', 'Personnalisation', 'التخصيص')}
                  </span>
                </button>
              )}

              <div className="my-2 h-px bg-border" />

              <button
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-destructive/5 transition-colors text-left text-destructive"
              >
                <LogOut size={18} />
                <span className="font-medium">{t('profile.logout')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
