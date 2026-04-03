import React from 'react';
import authService from '../../services/authService';

import { useLanguage } from '../../context/LanguageContext';
type Role = 'artisan' | 'expert' | 'manufacturer' | 'admin';

export default function RoleGuard({ allow, children }: { allow: Role[]; children: React.ReactNode }) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  const user = authService.getCurrentUser();
  const role = user?.role as Role | undefined;
  if (!role || !allow.includes(role)) return null;
  return <>{children}</>;
}
