import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  TrendingUp, DollarSign, ShoppingBag, Package, BarChart3,
  Loader2
} from 'lucide-react';
import axios from 'axios';
import ProfileCompletionBanner from '../common/ProfileCompletionBanner';
import { useLanguage } from '../../context/LanguageContext';

interface ManufacturerHomeProps {
  onNavigate: (view: string) => void;
}

export default function ManufacturerAnalytics({ onNavigate }: ManufacturerHomeProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
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
  const PIE_COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ fontSize: 12, color: entry.color, margin: 0 }}>
            {entry.name === 'sales' ? tr('Revenue', 'Revenu', 'الإيرادات') : tr('Orders', 'Commandes', 'الطلبات')}: <strong>{entry.name === 'sales' ? `${entry.value.toLocaleString()} TND` : entry.value}</strong>
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
      label: tr('Total Revenue', 'Revenu total', 'إجمالي الإيرادات'),
      value: `${formatCurrency(stats.totalRevenue)} TND`,
      icon: DollarSign,
      color: '#10b981',
      bg: 'rgba(5,150,105,0.1)',
    },
    {
      label: tr('Total Orders', 'Commandes totales', 'إجمالي الطلبات'),
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: '#7c3aed',
      bg: 'rgba(124,58,237,0.1)',
    },
    {
      label: tr('Avg Order Value', 'Valeur moyenne des commandes', 'متوسط قيمة الطلب'),
      value: `${stats.avgOrderValue.toFixed(0)} TND`,
      icon: TrendingUp,
      color: '#f59e0b',
      bg: 'rgba(217,119,6,0.1)',
    },
    {
      label: tr('Active Products', 'Produits actifs', 'المنتجات النشطة'),
      value: stats.activeProducts,
      icon: Package,
      color: '#3b82f6',
      bg: 'rgba(37,99,235,0.1)',
    },
  ];

  const maxTopSales = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.sales)) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ProfileCompletionBanner onNavigate={onNavigate} profileView="profile" />

      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>{tr('Manufacturer Dashboard', 'Tableau de bord fabricant', 'لوحة معلومات الصانع')}</h1>
        <p style={{ fontSize: 15, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>{tr('Manage your product sales, revenue, and business metrics', 'Gérez vos ventes de produits, vos revenus et vos métriques commerciales', 'إدارة مبيعاتك والإيرادات والمقاييس التجارية')}</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              style={{
                backgroundColor: 'var(--card)',
                borderRadius: 16,
                padding: '24px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)', margin: 0 }}>{card.label}</p>
                <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1 }}>
                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Revenue Chart */}
      <div style={{ backgroundColor: 'var(--card)', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{tr('Revenue Overview', 'Aperçu des revenus', 'نظرة عامة على الإيرادات')}</h2>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{tr('Last 6 months performance', 'Performance des 6 derniers mois', 'الأداء خلال الـ 6 أشهر الماضية')}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#7c3aed', display: 'inline-block' }} /> {tr('Revenue', 'Revenu', 'الإيرادات')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#10b981', display: 'inline-block' }} /> {tr('Orders', 'Commandes', 'الطلبات')}
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
            <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="sales" stroke="#7c3aed" strokeWidth={2.5} fill="url(#colorRevenue)" name="sales" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Grid: Top Products + Orders Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Top Selling Products */}
        <div style={{ backgroundColor: 'var(--card)', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 20px' }}>{tr('Top Selling Products', 'Produits les mieux vendus', 'أفضل المنتجات مبيعاً')}</h2>
          {topProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <Package size={40} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: 14 }}>{tr('No sales data available', 'Aucune donnée de vente disponible', 'لا توجد بيانات مبيعات متاحة')}</p>
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
                    backgroundColor: index === 0 ? 'rgba(124,58,237,0.1)' : '#f9fafb',
                    color: index === 0 ? '#7c3aed' : 'var(--muted-foreground)',
                  }}>
                    {index + 1}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>{product.name}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#10b981', margin: 0 }}>{product.sales.toLocaleString()} TND</p>
                    </div>
                    {/* Bar */}
                    <div style={{ height: 6, backgroundColor: 'var(--muted)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(product.sales / maxTopSales) * 100}%`, backgroundColor: PIE_COLORS[index] || '#7c3aed', borderRadius: 999, transition: 'width 0.5s' }} />
                    </div>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{product.units} {tr('units sold', 'unités vendues', 'وحدات مباعة')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Orders */}
        <div style={{ backgroundColor: 'var(--card)', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 20px' }}>{tr('Monthly Orders', 'Commandes mensuelles', 'الطلبات الشهرية')}</h2>
          {monthlyData.every(d => d.orders === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <BarChart3 size={40} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: 14 }}>{tr('No orders yet', 'Pas d\'commandes pour le moment', 'لا توجد طلبات حتى الآن')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
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
