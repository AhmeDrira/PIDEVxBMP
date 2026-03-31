import React from 'react';
import { Card } from '../ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export default function StatsCard({ 
  label, 
  value, 
  icon, 
  color, 
  trend, 
  trendUp = true, 
  subtitle,
  onClick,
  isActive 
}: StatsCardProps) {
  return (
    <Card 
      onClick={onClick}
      className={`p-6 bg-card rounded-2xl border border-border shadow-lg transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl' : ''
      } ${
        isActive ? 'ring-2 ring-primary bg-blue-50/50' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
          style={{ backgroundColor: `${color}15` }}
        >
          <div style={{ color: color }}>{icon}</div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
            trendUp ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'
          }`}>
            {trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trend}
          </div>
        )}
      </div>
      <h3 className="text-4xl font-bold text-foreground mb-2">{value}</h3>
      <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </Card>
  );
}
