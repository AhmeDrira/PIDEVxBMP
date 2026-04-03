import { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Users, FolderKanban, ShoppingBag, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import ProfileCompletionBanner from '../common/ProfileCompletionBanner';
import { useLanguage } from '../../context/LanguageContext';

type StatsResponse = {
  totalUsers: number;
  activeUsers: number;
  activeProjects: number;
  totalProjects: number;
  totalInvoices: number;
  satisfaction: number;
  roleCounts: Record<string, number>;
  userGrowth: Array<{ month: string; users: number }>;
  projectActivity: Array<{ month: string; projects: number }>;
};

const roleColors: Record<string, string> = {
  artisan: '#F59E0B',
  expert: '#10B981',
  manufacturer: '#8B5CF6',
  admin: '#1F3A8A',
  user: 'var(--muted-foreground)',
};

export default function AdminAnalytics({ onNavigate }: { onNavigate?: (view: string) => void } = {}) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get('/api/stats');
        setStats(response.data);
      } catch (err) {
        console.error('Failed to load analytics', err);
        setError(tr('Unable to load analytics', "Impossible de charger l'analytique", 'تعذر تحميل التحليلات'));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const userDistribution = useMemo(() => {
    if (!stats?.roleCounts) return [];
    return Object.entries(stats.roleCounts)
      .filter(([role]) => role !== 'user')
      .map(([role, value]) => ({
        name: role.charAt(0).toUpperCase() + role.slice(1),
        value,
        color: roleColors[role] || '#94A3B8',
      }));
  }, [stats]);

  const avgProjectsPerArtisan = useMemo(() => {
    if (!stats) return 0;
    const artisans = stats.roleCounts?.artisan || 0;
    return artisans ? Number((stats.totalProjects / artisans).toFixed(1)) : 0;
  }, [stats]);

  const avgInvoicesPerArtisan = useMemo(() => {
    if (!stats) return 0;
    const artisans = stats.roleCounts?.artisan || 0;
    return artisans ? Number((stats.totalInvoices / artisans).toFixed(1)) : 0;
  }, [stats]);

  const activeUserRate = useMemo(() => {
    if (!stats || stats.totalUsers === 0) return 0;
    return Math.round((stats.activeUsers / stats.totalUsers) * 100);
  }, [stats]);

  return (
    <div className="space-y-6">
      <ProfileCompletionBanner onNavigate={onNavigate} profileView="profile" />

      {loading && (
        <Card className="p-6 bg-card">{tr('Loading analytics...', 'Chargement de l\'analytique...', 'جاري تحميل التحليلات...')}</Card>
      )}
      {error && (
        <Card className="p-6 bg-card text-red-600">{error}</Card>
      )}

      {!loading && !error && stats && (
        <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-6 bg-card">
          <Users size={32} style={{ color: '#1F3A8A' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>{stats.totalUsers}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>{tr('Total Users', 'Utilisateurs totaux', 'إجمالي المستخدمين')}</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>{activeUserRate}{tr('%', '%', '%')} {tr('active', 'actif', 'نشط')}</p>
        </Card>
        <Card className="p-6 bg-card">
          <FolderKanban size={32} style={{ color: '#F59E0B' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>{stats.activeProjects}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>{tr('Active Projects', 'Projets actifs', 'المشاريع النشطة')}</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>{stats.totalProjects} {tr('total', 'total', 'الإجمالي')}</p>
        </Card>
        <Card className="p-6 bg-card">
          <ShoppingBag size={32} style={{ color: '#10B981' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>{stats.totalInvoices}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>{tr('Total Invoices', 'Factures totales', 'إجمالي الفواتير')}</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>{tr('Billing Activity', 'Activité de facturation', 'نشاط الفواتير')}</p>
        </Card>
        <Card className="p-6 bg-card">
          <TrendingUp size={32} style={{ color: '#8B5CF6' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>{stats.satisfaction}%</p>
          <p style={{ color: 'var(--muted-foreground)' }}>{tr('User Satisfaction', "Satisfaction de l'utilisateur", 'رضا المستخدم')}</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>{tr('Engagement Score', "Score d'engagement", 'درجة المشاركة')}</p>
        </Card>
      </div>
      )}

      {!loading && !error && stats && (
        <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-card">
          <h2 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>{tr('User Growth', 'Croissance des utilisateurs', 'نمو المستخدمين')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.userGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="users" stroke="#1F3A8A" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-card">
          <h2 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>{tr('Project Activity', 'Activité du projet', 'نشاط المشروع')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.projectActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="projects" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      )}

      {!loading && !error && stats && (
        <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-card">
          <h2 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>{tr('User Distribution', 'Distribution des utilisateurs', 'توزيع المستخدمين')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={userDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {userDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-card">
          <h2 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>{tr('Key Metrics', 'Métriques clés', 'المقاييس الرئيسية')}</h2>
          <div className="space-y-4">
            {[
              { label: tr('Avg Projects per Artisan', 'Moyenne de projets par artisan', 'متوسط المشاريع لكل حرفي'), value: `${avgProjectsPerArtisan}`, trend: tr('Live', 'En Temps Réel', 'بث مباشر') },
              { label: tr('Avg Invoices per Artisan', 'Moyenne de factures par artisan', 'متوسط الفواتير لكل حرفي'), value: `${avgInvoicesPerArtisan}`, trend: tr('Live', 'En Temps Réel', 'بث مباشر') },
              { label: tr('Active User Rate', "Taux d'utilisateurs actifs", 'معدل المستخدمين النشطين'), value: `${activeUserRate}%`, trend: tr('Live', 'En Temps Réel', 'بث مباشر') },
              { label: tr('Total Experts', 'Experts totaux', 'إجمالي الخبراء'), value: `${stats.roleCounts?.expert || 0}`, trend: tr('Live', 'En Temps Réel', 'بث مباشر') },
              { label: tr('Total Manufacturers', 'Fabricants totaux', 'إجمالي المصنعين'), value: `${stats.roleCounts?.manufacturer || 0}`, trend: tr('Live', 'En Temps Réel', 'بث مباشر') },
            ].map((metric, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{ backgroundColor: '#F9FAFB' }}
              >
                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{metric.label}</p>
                  <p className="text-xl" style={{ color: 'var(--foreground)' }}>{metric.value}</p>
                </div>
                <span
                  className="px-3 py-1 rounded-full text-sm"
                  style={{ backgroundColor: '#D1FAE5', color: '#10B981' }}
                >
                  {metric.trend}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}
