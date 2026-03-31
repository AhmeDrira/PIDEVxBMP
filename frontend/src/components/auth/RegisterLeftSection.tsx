import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import Logo from '../common/Logo';

export default function RegisterLeftSection() {
  const [siteStats, setSiteStats] = useState({ activeUsers: 0, projects: 0, satisfaction: 0 });

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => setSiteStats({
        activeUsers: data.activeUsers ?? 0,
        projects: data.totalProjects ?? data.projects ?? 0,
        satisfaction: data.satisfaction ?? 0,
      }))
      .catch(() => {});
  }, []);

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
    return String(n);
  };
  const features = [
    {
      icon: <CheckCircle2 size={24} />,
      title: 'Project Management',
      description: 'Track and manage all your construction projects in one place'
    },
    {
      icon: <CheckCircle2 size={24} />,
      title: 'Marketplace',
      description: 'Access quality materials from verified manufacturers'
    },
    {
      icon: <CheckCircle2 size={24} />,
      title: 'Expert Network',
      description: 'Connect with construction experts and professionals'
    }
  ];

  return (
    <div className="lg:w-1/2 relative overflow-hidden bg-[#1e40af]">
      <div className="absolute inset-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1693679758394-6d56a1e5c1a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwbW9kZXJuJTIwYnVpbGRpbmd8ZW58MXx8fHwxNzcwNTc2NzAyfDA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Construction"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af]/95 via-[#1e3a8a]/90 to-[#1e40af]/95" />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-center px-8 lg:px-16 py-16 text-white">
        <div className="max-w-lg">
          <div className="mb-8">
            <Logo variant="light" size="lg" />
          </div>

          <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-white leading-tight">
            Build Better, Faster, Together
          </h2>
          <p className="text-xl text-white/90 mb-12 leading-relaxed">
            Join the complete platform for construction professionals to manage projects, connect with experts, and access quality materials.
          </p>

          <div className="space-y-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 shadow-lg">
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-white mb-1">{feature.title}</h4>
                  <p className="text-white/80 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 grid grid-cols-3 gap-8">
            <div>
              <p className="text-4xl font-bold text-white mb-1">{formatCount(siteStats.activeUsers)}</p>
              <p className="text-white/70">Active Users</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-white mb-1">{formatCount(siteStats.projects)}</p>
              <p className="text-white/70">Projects</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-white mb-1">{siteStats.satisfaction}%</p>
              <p className="text-white/70">Satisfaction</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
