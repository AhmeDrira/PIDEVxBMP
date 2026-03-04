import React from 'react';
import { Card } from '../ui/card';
import { Users, FolderKanban, ShoppingBag, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AdminAnalytics() {
  const userGrowthData = [
    { month: 'Jan', users: 120 },
    { month: 'Feb', users: 145 },
    { month: 'Mar', users: 178 },
    { month: 'Apr', users: 210 },
    { month: 'May', users: 245 },
    { month: 'Jun', users: 289 },
  ];

  const projectsData = [
    { month: 'Jan', projects: 45 },
    { month: 'Feb', projects: 52 },
    { month: 'Mar', projects: 67 },
    { month: 'Apr', projects: 78 },
    { month: 'May', projects: 89 },
    { month: 'Jun', projects: 94 },
  ];

  const userDistribution = [
    { name: 'Artisans', value: 156, color: '#F59E0B' },
    { name: 'Experts', value: 45, color: '#10B981' },
    { name: 'Manufacturers', value: 88, color: '#8B5CF6' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl mb-1" style={{ color: '#111827' }}>Platform Analytics</h1>
        <p style={{ color: '#6B7280' }}>Monitor platform performance and user activity</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-6 bg-white">
          <Users size={32} style={{ color: '#1F3A8A' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: '#111827' }}>289</p>
          <p style={{ color: '#6B7280' }}>Total Users</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>+18% this month</p>
        </Card>
        <Card className="p-6 bg-white">
          <FolderKanban size={32} style={{ color: '#F59E0B' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: '#111827' }}>94</p>
          <p style={{ color: '#6B7280' }}>Active Projects</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>+12% this month</p>
        </Card>
        <Card className="p-6 bg-white">
          <ShoppingBag size={32} style={{ color: '#10B981' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: '#111827' }}>425</p>
          <p style={{ color: '#6B7280' }}>Total Orders</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>+23% this month</p>
        </Card>
        <Card className="p-6 bg-white">
          <TrendingUp size={32} style={{ color: '#8B5CF6' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: '#111827' }}>87%</p>
          <p style={{ color: '#6B7280' }}>User Satisfaction</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>+5% this month</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white">
          <h2 className="text-xl mb-6" style={{ color: '#111827' }}>User Growth</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={userGrowthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="users" stroke="#1F3A8A" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-white">
          <h2 className="text-xl mb-6" style={{ color: '#111827' }}>Project Activity</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={projectsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="projects" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white">
          <h2 className="text-xl mb-6" style={{ color: '#111827' }}>User Distribution</h2>
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

        <Card className="p-6 bg-white">
          <h2 className="text-xl mb-6" style={{ color: '#111827' }}>Key Metrics</h2>
          <div className="space-y-4">
            {[
              { label: 'Avg Projects per Artisan', value: '7.2', trend: '+0.8' },
              { label: 'Avg Articles per Expert', value: '12.5', trend: '+2.1' },
              { label: 'Avg Products per Manufacturer', value: '18.3', trend: '+3.4' },
              { label: 'Platform Usage Rate', value: '78%', trend: '+5%' },
              { label: 'Monthly Active Users', value: '234', trend: '+12' },
            ].map((metric, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{ backgroundColor: '#F9FAFB' }}
              >
                <div>
                  <p className="text-sm mb-1" style={{ color: '#6B7280' }}>{metric.label}</p>
                  <p className="text-xl" style={{ color: '#111827' }}>{metric.value}</p>
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
    </div>
  );
}
