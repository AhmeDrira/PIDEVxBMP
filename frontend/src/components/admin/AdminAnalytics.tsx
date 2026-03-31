import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Users, FolderKanban, ShoppingBag, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';
import ProfileCompletionBanner from '../common/ProfileCompletionBanner';

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
        setError('Unable to load analytics right now.');
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
        <Card className="p-6 bg-card">Loading analytics...</Card>
      )}
      {error && (
        <Card className="p-6 bg-card text-red-600">{error}</Card>
      )}

      {!loading && !error && stats && (
        <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-6 bg-card">
          <Users size={32} style={{ color: '#1F3A8A' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>{stats.totalUsers}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>Total Users</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>{activeUserRate}% active</p>
        </Card>
        <Card className="p-6 bg-card">
          <FolderKanban size={32} style={{ color: '#F59E0B' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>{stats.activeProjects}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>Active Projects</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>{stats.totalProjects} total</p>
        </Card>
        <Card className="p-6 bg-card">
          <ShoppingBag size={32} style={{ color: '#10B981' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>{stats.totalInvoices}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>Total Invoices</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>Billing activity</p>
        </Card>
        <Card className="p-6 bg-card">
          <TrendingUp size={32} style={{ color: '#8B5CF6' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>{stats.satisfaction}%</p>
          <p style={{ color: 'var(--muted-foreground)' }}>User Satisfaction</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>Engagement score</p>
        </Card>
      </div>
      )}

      {!loading && !error && stats && (
        <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-card">
          <h2 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>User Growth</h2>
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
          <h2 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>Project Activity</h2>
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
          <h2 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>User Distribution</h2>
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
          <h2 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>Key Metrics</h2>
          <div className="space-y-4">
            {[
              { label: 'Avg Projects per Artisan', value: `${avgProjectsPerArtisan}`, trend: 'Live' },
              { label: 'Avg Invoices per Artisan', value: `${avgInvoicesPerArtisan}`, trend: 'Live' },
              { label: 'Active User Rate', value: `${activeUserRate}%`, trend: 'Live' },
              { label: 'Total Experts', value: `${stats.roleCounts?.expert || 0}`, trend: 'Live' },
              { label: 'Total Manufacturers', value: `${stats.roleCounts?.manufacturer || 0}`, trend: 'Live' },
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
