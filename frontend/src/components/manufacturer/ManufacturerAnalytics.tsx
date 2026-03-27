import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp, Package, DollarSign, ShoppingBag, BarChart3 } from 'lucide-react';
import axios from 'axios';

export default function ManufacturerAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const getToken = () => {
    const s = localStorage.getItem('user');
    if (s) {
      try { return JSON.parse(s).token; } catch { /* */ }
    }
    return localStorage.getItem('token') || null;
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) return;

      const response = await axios.get(`${API_URL}/products/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 size={40} className="animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Loading sales data...</p>
      </div>
    );
  }

  if (!data) return null;

  const { stats, monthlyData, topProducts } = data;

  // Déterminer si on a des données réelles ou que des zéros pour l'affichage
  const hasSalesData = monthlyData.some((d: any) => d.sales > 0);
  const hasOrderData = monthlyData.some((d: any) => d.orders > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Sales Analytics</h1>
        <p className="text-lg text-slate-500">Track your real-time sales performance and inventory</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg border-b-4 border-emerald-500 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
          <div className="absolute -right-2 -top-2 text-emerald-500/5 group-hover:scale-110 transition-transform duration-500">
            <DollarSign size={80} strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalRevenue.toFixed(2)} <span className="text-xs font-bold text-slate-400">TND</span></p>
            <div className="mt-4 flex items-center text-[10px] font-black text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-lg uppercase tracking-wider">
              <TrendingUp size={12} className="mr-1" />
              Live Revenue
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg border-b-4 border-blue-600 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
          <div className="absolute -right-2 -top-2 text-blue-600/5 group-hover:scale-110 transition-transform duration-500">
            <ShoppingBag size={80} strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Orders</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalOrders}</p>
            <div className="mt-4 flex items-center text-[10px] font-black text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-lg uppercase tracking-wider">
              <Package size={12} className="mr-1" />
              Transactions
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg border-b-4 border-amber-500 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
          <div className="absolute -right-2 -top-2 text-amber-500/5 group-hover:scale-110 transition-transform duration-500">
            <BarChart3 size={80} strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Order Value</p>
            <p className="text-2xl font-black text-slate-900">{stats.avgOrderValue.toFixed(2)} <span className="text-xs font-bold text-slate-400">TND</span></p>
            <div className="mt-4 flex items-center text-[10px] font-black text-amber-600 bg-amber-50 w-fit px-2 py-1 rounded-lg uppercase tracking-wider">
              <TrendingUp size={12} className="mr-1" />
              Efficiency
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg border-b-4 border-purple-600 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
          <div className="absolute -right-2 -top-2 text-purple-600/5 group-hover:scale-110 transition-transform duration-500">
            <Package size={80} strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Active Products</p>
            <p className="text-2xl font-black text-slate-900">{stats.activeProducts}</p>
            <div className="mt-4 flex items-center text-[10px] font-black text-purple-600 bg-purple-50 w-fit px-2 py-1 rounded-lg uppercase tracking-wider">
              <Package size={12} className="mr-1" />
              Catalog Size
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-8 bg-white rounded-2xl border-0 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Monthly Sales Trend</h2>
              <p className="text-sm text-slate-400">Revenue performance over time</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sales (TND)</span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                  domain={hasSalesData ? [0, 'auto'] : [0, 100]}
                />
                <Tooltip 
                  cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 800, color: '#2563eb' }}
                  labelStyle={{ fontWeight: 700, marginBottom: '4px', color: '#1e293b' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#2563eb" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorSales)"
                  dot={{ r: 4, fill: '#fff', strokeWidth: 3, stroke: '#2563eb' }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-8 bg-white rounded-2xl border-0 shadow-xl flex flex-col">
          <h2 className="text-xl font-bold text-slate-900 mb-8">Top Selling Products</h2>
          <div className="space-y-6 flex-1">
            {topProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 py-10">
                <Package size={48} className="opacity-10" />
                <p className="font-medium text-sm">No sales recorded</p>
              </div>
            ) : (
              topProducts.map((product: any, index: number) => (
                <div key={index} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{product.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.units} units sold</p>
                    </div>
                    <p className="font-black text-emerald-600 text-sm whitespace-nowrap">{product.sales.toFixed(2)} <span className="text-[10px]">TND</span></p>
                  </div>
                  <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${(product.sales / (topProducts[0].sales || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="p-8 bg-white rounded-2xl border-0 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Order Volume</h2>
            <p className="text-sm text-slate-400">Monthly transaction frequency</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Number of Orders</span>
          </div>
        </div>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                domain={hasOrderData ? [0, 'auto'] : [0, 10]}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 700, marginBottom: '4px', color: '#1e293b' }}
              />
              <Bar 
                dataKey="orders" 
                fill="#f59e0b" 
                radius={[4, 4, 0, 0]}
                barSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
