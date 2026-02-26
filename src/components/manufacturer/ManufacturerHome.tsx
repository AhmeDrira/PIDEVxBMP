import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Package, ShoppingCart, TrendingUp, DollarSign, Eye, ArrowRight, AlertCircle } from 'lucide-react';
import StatsCard from '../common/StatsCard';
import { Badge } from '../ui/badge';

interface ManufacturerHomeProps {
  onNavigate: (view: string) => void;
}

export default function ManufacturerHome({ onNavigate }: ManufacturerHomeProps) {
  const stats = [
    { 
      label: 'Total Products', 
      value: '42', 
      icon: <Package size={28} />, 
      color: '#1E40AF', 
      trend: '+5 this month',
      trendUp: true
    },
    { 
      label: 'Total Orders', 
      value: '156', 
      icon: <ShoppingCart size={28} />, 
      color: '#F59E0B', 
      trend: '+23 this week',
      trendUp: true
    },
    { 
      label: 'Revenue (This Month)', 
      value: '45.2K TND', 
      icon: <DollarSign size={28} />, 
      color: '#10B981', 
      trend: '+15% vs last month',
      trendUp: true
    },
    { 
      label: 'Pending Orders', 
      value: '12', 
      icon: <Eye size={28} />, 
      color: '#EF4444', 
      subtitle: 'Needs attention'
    },
  ];

  const recentOrders = [
    {
      id: 'ORD-1234',
      customer: 'Ahmed Ben Salah',
      products: 'Premium Cement - 50kg (x10)',
      amount: 450,
      status: 'processing',
      date: '2026-02-09'
    },
    {
      id: 'ORD-1233',
      customer: 'Fatma Hamdi',
      products: 'Steel Rebar 12mm (x5)',
      amount: 600,
      status: 'shipped',
      date: '2026-02-08'
    },
    {
      id: 'ORD-1232',
      customer: 'Youssef Trabelsi',
      products: 'Electrical Wire 2.5mm (x3)',
      amount: 285,
      status: 'delivered',
      date: '2026-02-07'
    },
  ];

  const lowStockProducts = [
    { name: 'Premium Cement - 50kg', currentStock: 15, minStock: 50, unit: 'bags' },
    { name: 'Paint - White 20L', currentStock: 8, minStock: 20, unit: 'cans' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'shipped': return 'bg-primary/10 text-primary border-primary/20';
      case 'delivered': return 'bg-accent/10 text-accent border-accent/20';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const quickActions = [
    { 
      label: 'Add Product', 
      icon: <Package size={24} />, 
      action: () => onNavigate('products'), 
      color: '#1E40AF',
      description: 'List new products in catalog'
    },
    { 
      label: 'View Orders', 
      icon: <ShoppingCart size={24} />, 
      action: () => onNavigate('orders'), 
      color: '#F59E0B',
      description: 'Manage customer orders'
    },
    { 
      label: 'View Analytics', 
      icon: <TrendingUp size={24} />, 
      action: () => onNavigate('analytics'), 
      color: '#10B981',
      description: 'Check sales performance'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 text-white shadow-2xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-3">Welcome Back, BuildMaster! 👋</h1>
          <p className="text-xl text-white/90 leading-relaxed">
            You have 156 total orders and 42 products. Monitor your sales and manage your inventory.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Quick Actions</h2>
            <p className="text-muted-foreground mt-1">Common tasks and shortcuts</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className="group p-6 rounded-2xl border-2 border-gray-200 hover:border-transparent hover:shadow-xl transition-all duration-300 text-left"
              style={{
                background: `linear-gradient(135deg, ${action.color}05 0%, ${action.color}10 100%)`
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform"
                style={{ backgroundColor: action.color }}
              >
                <span className="text-white">{action.icon}</span>
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-2">{action.label}</h3>
              <p className="text-sm text-muted-foreground mb-3">{action.description}</p>
              <div className="flex items-center text-sm font-medium" style={{ color: action.color }}>
                Get Started
                <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Recent Orders</h2>
                <p className="text-muted-foreground mt-1">Latest customer orders</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => onNavigate('orders')}
                className="rounded-xl border-2 hover:border-primary hover:text-primary"
              >
                View All
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-6 rounded-2xl border-2 border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="font-bold text-foreground text-lg">Order #{order.id}</h4>
                        <Badge className={`${getStatusColor(order.status)} px-4 py-1.5 text-sm font-semibold border-2`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong className="text-foreground">Customer:</strong> {order.customer}
                      </p>
                      <p className="text-sm text-muted-foreground mb-2">
                        {order.products}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Date: <strong className="text-foreground">{order.date}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground font-medium mb-2">Amount</p>
                        <p className="text-3xl font-bold text-primary">
                          {order.amount} TND
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl border-2">
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <AlertCircle size={24} className="text-destructive" />
              <h3 className="text-xl font-bold text-foreground">Low Stock Alert</h3>
            </div>
            <div className="space-y-4">
              {lowStockProducts.map((product, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl bg-destructive/5 border-2 border-destructive/20"
                >
                  <p className="text-sm font-bold text-foreground mb-2">{product.name}</p>
                  <p className="text-xs text-destructive mb-3">
                    Stock: <strong>{product.currentStock} {product.unit}</strong> (Min: {product.minStock})
                  </p>
                  <Button size="sm" className="w-full h-10 text-white bg-destructive hover:bg-destructive/90 rounded-xl">
                    Restock Now
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}