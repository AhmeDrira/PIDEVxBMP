import React, { useState } from 'react';
import RegisterLeftSection from './RegisterLeftSection';
import RegisterRoleSelection from './RegisterRoleSelection';
import RegisterForm from './RegisterForm';

type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin';

interface RegisterPageProps {
  onRegister: (role: UserRole, isPending?: boolean, email?: string) => void;
  onBackToLogin: () => void;
}

export default function RegisterPage({ onRegister, onBackToLogin }: RegisterPageProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
  };

  const handleBackToRoleSelection = () => {
    setSelectedRole(null);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Section - Static, never re-renders */}
      <RegisterLeftSection />

      {/* Right Section - Only this re-renders when role changes */}
      <div className="lg:w-1/2 flex items-start lg:items-center justify-center p-8 lg:p-12 bg-background overflow-y-auto min-h-screen lg:min-h-0">
        <div className="w-full py-6 lg:py-0">
        {!selectedRole ? (
          <RegisterRoleSelection
            onRoleSelect={handleRoleSelect}
            onBackToLogin={onBackToLogin}
            onGoogleSuccess={(role) => onRegister(role, false)}
          />
        ) : (
          <RegisterForm
            selectedRole={selectedRole}
            onSubmit={onRegister}
            onBackToRoleSelection={handleBackToRoleSelection}
            onBackToLogin={onBackToLogin}
          />
        )}
        </div>
      </div>
    </div>
  );
}
