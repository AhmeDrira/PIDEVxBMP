import React, { useState } from 'react';
import RegisterLeftSection from './RegisterLeftSection';
import RegisterRoleSelection from './RegisterRoleSelection';
import RegisterForm from './RegisterForm';

type UserRole = 'artisan' | 'expert' | 'manufacturer' | 'admin';

interface RegisterPageProps {
  onRegister: (role: UserRole, isPending?: boolean) => void;
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
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-background overflow-y-auto">
        {!selectedRole ? (
          <RegisterRoleSelection 
            onRoleSelect={handleRoleSelect}
            onBackToLogin={onBackToLogin}
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
  );
}
