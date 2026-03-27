import React from 'react';
import authService from '../../services/authService';

type Role = 'artisan' | 'expert' | 'manufacturer' | 'admin';

export default function RoleGuard({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const user = authService.getCurrentUser();
  const role = user?.role as Role | undefined;
  if (!role || !allow.includes(role)) return null;
  return <>{children}</>;
}
