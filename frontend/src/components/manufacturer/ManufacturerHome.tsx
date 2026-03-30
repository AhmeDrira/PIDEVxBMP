import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Package, BarChart3,
  Loader2, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import axios from 'axios';
import ProfileCompletionBanner from '../common/ProfileCompletionBanner';

interface ManufacturerHomeProps {
  onNavigate: (view: string) => void;
}

export default function ManufacturerAnalytics({ onNavigate }: ManufacturerHomeProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, activeProducts: 0 });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        const token = getToken();
        if (!token) return;
        const res = await axios.get(`${API_URL}/products/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data;
        setStats(data.stats || {});
        setMonthlyData(data.monthlyData || []);
        setTopProducts(data.topProducts || []);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const formatCurrency = (val: number) => {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toFixed(0);
  };

  // Category distribution from top products
  const totalSales = topProducts.reduce((s, p) => s + p.sales, 0);
  const PIE_COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ fontSize: 12, color: entry.color, margin: 0 }}>
            {entry.name === 'sales' ? 'Revenue' : 'Orders'}: <strong>{entry.name === 'sales' ? `${entry.value.toLocaleString()} TND` : entry.value}</strong>
          </p>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Loader2 size={40} className="animate-spin" style={{ color: '#7c3aed' }} />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Revenue',
      value: `${formatCurrency(stats.totalRevenue)} TND`,
      icon: DollarSign,
      color: '#10b981',
      bg: '#ecfdf5',
    },
    {
      label: 'Total Orders',
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: '#7c3aed',
      bg: '#f5f3ff',
    },
    {
      label: 'Avg Order Value',
      value: `${stats.avgOrderValue.toFixed(0)} TND`,
      icon: TrendingUp,
      color: '#f59e0b',
      bg: '#fffbeb',
    },
    {
      label: 'Active Products',
      value: stats.activeProducts,
      icon: Package,
      color: '#3b82f6',
      bg: '#eff6ff',
    },
  ];

  const maxTopSales = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.sales)) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ProfileCompletionBanner onNavigate={onNavigate} profileView="profile" />

      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1f2937', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 15, color: '#6b7280', margin: '4px 0 0' }}>Overview of your business performance</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: '24px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                border: '1px solid #f3f4f6',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#6b7280', margin: 0 }}>{card.label}</p>
                <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#1f2937', margin: 0, lineHeight: 1 }}>
                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Revenue Chart */}
      <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>Revenue Overview</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>Last 6 months performance</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#7c3aed', display: 'inline-block' }} /> Revenue
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#10b981', display: 'inline-block' }} /> Orders
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="sales" stroke="#7c3aed" strokeWidth={2.5} fill="url(#colorRevenue)" name="sales" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Grid: Top Products + Orders Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Top Selling Products */}
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: '0 0 20px' }}>Top Selling Products</h2>
          {topProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <Package size={40} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: 14 }}>No sales data yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {topProducts.map((product, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Rank */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    backgroundColor: index === 0 ? '#f5f3ff' : '#f9fafb',
                    color: index === 0 ? '#7c3aed' : '#6b7280',
                  }}>
                    {index + 1}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>{product.name}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#10b981', margin: 0 }}>{product.sales.toLocaleString()} TND</p>
                    </div>
                    {/* Bar */}
                    <div style={{ height: 6, backgroundColor: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(product.sales / maxTopSales) * 100}%`, backgroundColor: PIE_COLORS[index] || '#7c3aed', borderRadius: 999, transition: 'width 0.5s' }} />
                    </div>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{product.units} units sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Orders */}
        <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: '0 0 20px' }}>Monthly Orders</h2>
          {monthlyData.every(d => d.orders === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <BarChart3 size={40} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: 14 }}>No orders yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="orders" fill="#7c3aed" radius={[6, 6, 0, 0]} name="orders" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
