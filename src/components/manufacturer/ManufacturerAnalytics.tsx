import React from 'react';
import { Card } from '../ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function ManufacturerAnalytics() {
  const monthlyData = [
    { month: 'Jan', sales: 12500, orders: 45 },
    { month: 'Feb', sales: 15200, orders: 52 },
    { month: 'Mar', sales: 18700, orders: 67 },
    { month: 'Apr', sales: 22100, orders: 78 },
    { month: 'May', sales: 25400, orders: 89 },
    { month: 'Jun', sales: 28900, orders: 94 },
  ];

  const topProducts = [
    { name: 'Premium Cement', sales: 8900, units: 198 },
    { name: 'Steel Rebar', sales: 7200, units: 60 },
    { name: 'Ceramic Tiles', sales: 5400, units: 154 },
    { name: 'Paint - White', sales: 4100, units: 48 },
    { name: 'Electrical Wire', sales: 3800, units: 40 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl mb-1" style={{ color: '#111827' }}>Sales Analytics</h1>
        <p style={{ color: '#6B7280' }}>Track your sales performance</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-6 bg-white">
          <p className="text-sm mb-2" style={{ color: '#6B7280' }}>Total Revenue</p>
          <p className="text-3xl" style={{ color: '#10B981' }}>103.8K TND</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>+23% vs last period</p>
        </Card>
        <Card className="p-6 bg-white">
          <p className="text-sm mb-2" style={{ color: '#6B7280' }}>Total Orders</p>
          <p className="text-3xl" style={{ color: '#1F3A8A' }}>425</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>+18% vs last period</p>
        </Card>
        <Card className="p-6 bg-white">
          <p className="text-sm mb-2" style={{ color: '#6B7280' }}>Avg Order Value</p>
          <p className="text-3xl" style={{ color: '#F59E0B' }}>244 TND</p>
          <p className="text-sm mt-2" style={{ color: '#10B981' }}>+5% vs last period</p>
        </Card>
        <Card className="p-6 bg-white">
          <p className="text-sm mb-2" style={{ color: '#6B7280' }}>Active Products</p>
          <p className="text-3xl" style={{ color: '#8B5CF6' }}>42</p>
          <p className="text-sm mt-2" style={{ color: '#6B7280' }}>All categories</p>
        </Card>
      </div>

      <Card className="p-6 bg-white">
        <h2 className="text-xl mb-6" style={{ color: '#111827' }}>Monthly Sales Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="sales" stroke="#1F3A8A" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white">
          <h2 className="text-xl mb-6" style={{ color: '#111827' }}>Top Selling Products</h2>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <p style={{ color: '#111827' }}>{product.name}</p>
                  <p className="text-sm" style={{ color: '#6B7280' }}>{product.units} units sold</p>
                </div>
                <p className="text-lg" style={{ color: '#10B981' }}>{product.sales.toLocaleString()} TND</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-white">
          <h2 className="text-xl mb-6" style={{ color: '#111827' }}>Monthly Orders</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orders" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
