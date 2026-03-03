import React from 'react';
import { Button } from '../ui/button';
import { GoogleLoginButton } from './GoogleLoginButton';

type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin';

interface RegisterRoleSelectionProps {
  onRoleSelect: (role: UserRole) => void;
  onBackToLogin: () => void;
  onGoogleSuccess?: (role: UserRole) => void;
}

export default function RegisterRoleSelection({ onRoleSelect, onBackToLogin, onGoogleSuccess }: RegisterRoleSelectionProps) {
  const roles = [
    {
      id: 'artisan' as UserRole,
      title: 'Artisan',
      description: 'Manage projects, create quotes, and order materials',
      icon: '👷',
      color: '#F59E0B',
      features: ['Project Management', 'Quote Generation', 'Marketplace Access'],
    },
    {
      id: 'expert' as UserRole,
      title: 'Expert',
      description: 'Share knowledge and connect with artisans',
      icon: '👨‍🏫',
      color: '#10B981',
      features: ['Knowledge Sharing', 'Artisan Network', 'Consultation'],
    },
    {
      id: 'manufacturer' as UserRole,
      title: 'Manufacturer',
      description: 'List products and manage orders',
      icon: '🏭',
      color: '#8B5CF6',
      features: ['Product Listing', 'Order Management', 'Analytics'],
    },
  ];

  return (
    <div className="w-full max-w-xl">
      <div className="mb-8">
        <Button variant="ghost" onClick={onBackToLogin} className="mb-6 hover:bg-white rounded-xl">
          ← Back to Login
        </Button>
        <h2 className="text-3xl font-bold text-foreground mb-3">Create Your Account</h2>
        <p className="text-lg text-muted-foreground">Choose your role to get started</p>
      </div>

      {onGoogleSuccess && (
        <>
          <div className="mb-4 space-y-3">
            <GoogleLoginButton
              variant="signup"
              onSuccess={(userData) => {
                if (userData?.role) onGoogleSuccess(userData.role as UserRole);
              }}
            />
          </div>
          <div className="relative py-2 mb-6">
            <div className="border-t border-gray-200" />
            <div className="absolute inset-0 flex justify-center">
              <span className="px-3 text-xs font-semibold text-muted-foreground bg-background uppercase tracking-[0.18em] -mt-3">
                Or choose a role to sign up with email
              </span>
            </div>
          </div>
        </>
      )}

      <div className="space-y-4">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => onRoleSelect(role.id)}
            className="w-full group text-left p-6 rounded-2xl border-2 border-gray-200 hover:border-primary hover:shadow-xl transition-all duration-300 bg-white"
          >
            <div className="flex items-start gap-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-md group-hover:scale-110 transition-transform"
                style={{ backgroundColor: `${role.color}15` }}
              >
                {role.icon}
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-foreground mb-2">{role.title}</h4>
                <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                <div className="flex flex-wrap gap-2">
                  {role.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-3 py-1 rounded-full font-semibold"
                      style={{ backgroundColor: `${role.color}15`, color: role.color }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
