import React from 'react';
import { Card } from '../ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
}

export default function KPICard({ label, value, icon, color, trend, trendUp = true, subtitle }: KPICardProps) {
  return (
    <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
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
