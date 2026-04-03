import React from 'react';

import { useLanguage } from '../../context/LanguageContext';
interface LogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Logo({ variant = 'dark', size = 'md', className = '' }: LogoProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  // Logo text is primary blue in both modes for the 'dark' variant
  const textColor = variant === 'dark' ? 'text-primary dark:text-blue-300' : 'text-white';

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
      {/* Logo Image from File */}
      <div
        className={`${sizeConfig.logoHeight} aspect-square flex items-center justify-center rounded-xl overflow-hidden`}
      >
        <img 
          src="/logo.png" 
          alt="BMP.tn Logo" 
          className="w-full h-full object-contain"
        />
      </div>
      
      {/* Logo Text */}
      <div>
        <h1 className={`${sizeConfig.title} font-bold ${textColor} leading-none mb-0.5 tracking-tight`}>
          bmp.tn
        </h1>
        <p className={`${sizeConfig.subtitle} ${variant === 'dark' ? 'text-gray-500 dark:text-gray-400' : 'text-white/80'} font-medium`}>
          Plateforme Construction
        </p>
      </div>
    </div>
  );
}
