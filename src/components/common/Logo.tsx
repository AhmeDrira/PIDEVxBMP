import React from 'react';

interface LogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Logo({ variant = 'dark', size = 'md', className = '' }: LogoProps) {
  const textColor = variant === 'dark' ? 'text-foreground' : 'text-white';

  const sizes = {
    sm: {
      container: 'gap-2',
      logoHeight: 'h-8',
      title: 'text-xl',
      subtitle: 'text-xs'
    },
    md: {
      container: 'gap-3',
      logoHeight: 'h-10',
      title: 'text-2xl',
      subtitle: 'text-sm'
    },
    lg: {
      container: 'gap-3',
      logoHeight: 'h-12',
      title: 'text-3xl',
      subtitle: 'text-base'
    }
  };

  const sizeConfig = sizes[size];

  return (
    <div className={`flex items-center ${sizeConfig.container} ${className}`}>
      {/* Logo Image */}
      <div className={`${sizeConfig.logoHeight} aspect-square flex items-center justify-center bg-primary rounded-lg`}>
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full p-2"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Building/Construction Icon */}
          <path 
            d="M20 80V30L50 10L80 30V80H20Z" 
            fill="white" 
            stroke="white" 
            strokeWidth="3"
          />
          <rect x="35" y="40" width="10" height="10" fill="#1E40AF" />
          <rect x="55" y="40" width="10" height="10" fill="#1E40AF" />
          <rect x="35" y="55" width="10" height="10" fill="#1E40AF" />
          <rect x="55" y="55" width="10" height="10" fill="#1E40AF" />
          <rect x="42" y="70" width="16" height="10" fill="#1E40AF" />
        </svg>
      </div>
      
      {/* Logo Text */}
      <div>
        <h1 className={`${sizeConfig.title} font-bold ${textColor} leading-none mb-0.5`}>
          BMP.tn
        </h1>
        <p className={`${sizeConfig.subtitle} ${variant === 'dark' ? 'text-muted-foreground' : 'text-white/80'}`}>
          Construction Marketplace
        </p>
      </div>
    </div>
  );
}
