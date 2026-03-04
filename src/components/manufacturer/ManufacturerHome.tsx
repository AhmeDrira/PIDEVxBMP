import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Package, ShoppingCart, TrendingUp, DollarSign, Eye, ArrowRight, AlertCircle, MessageSquare, Loader2 } from 'lucide-react';
import StatsCard from '../common/StatsCard';
import { Badge } from '../ui/badge';
import axios from 'axios';

interface ManufacturerHomeProps {
  onNavigate: (view: string) => void;
}

export default function ManufacturerHome({ onNavigate }: ManufacturerHomeProps) {
  const userStorage = localStorage.getItem('user');
  const user = userStorage ? JSON.parse(userStorage) : null;
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const companyName = user?.companyName || '';
  const displayName = companyName || `${firstName} ${lastName}`.trim() || 'Manufacturer';

  const [products, setProducts] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getToken = () => {
    const direct = localStorage.getItem('token');
    if (direct) return direct;
    const stored = localStorage.getItem('user');
    if (stored) return JSON.parse(stored).token;
    return null;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = getToken();
        if (!token) return;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const [resProd, resConv] = await Promise.all([
          axios.get('/api/products', config).catch(() => ({ data: [] })),
          axios.get('/api/conversations', config).catch(() => ({ data: [] })),
        ]);
        setProducts(Array.isArray(resProd.data) ? resProd.data : []);
        setConversations(Array.isArray(resConv.data) ? resConv.data : []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalProducts = products.length;
  const activeConversations = conversations.length;

  const stats = [
    { 
      label: 'Total Products', 
      value: loading ? '…' : String(totalProducts),
      icon: <Package size={28} />, 
      color: '#1E40AF', 
    },
    { 
      label: 'Active Conversations', 
      value: loading ? '…' : String(activeConversations),
      icon: <MessageSquare size={28} />, 
      color: '#8B5CF6', 
    },
    { 
      label: 'Revenue (This Month)', 
      value: '—', 
      icon: <DollarSign size={28} />, 
      color: '#10B981', 
    },
    { 
      label: 'Pending Orders', 
      value: '0', 
      icon: <Eye size={28} />, 
      color: '#EF4444', 
    },
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
      label: 'Messages', 
      icon: <ShoppingCart size={24} />, 
      action: () => onNavigate('messages'), 
      color: '#F59E0B',
      description: 'Communicate with your clients'
    },
    { 
      label: 'View Analytics', 
      icon: <TrendingUp size={24} />, 
      action: () => onNavigate('analytics'), 
      color: '#10B981',
      description: 'Check sales performance'
    },
  ];

  const recentConversations = conversations.slice(0, 3).map((conv: any) => {
    const other = conv.participants?.find((p: any) => p._id !== user?._id);
    return {
      name: other ? `${other.firstName} ${other.lastName}` : 'Unknown',
      role: other?.role || 'Client',
      lastContact: conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString() : '—',
      id: conv._id,
    };
  });

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 text-white shadow-2xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-3">Welcome Back, {displayName}! 👋</h1>
          <p className="text-xl text-white/90 leading-relaxed">
            {loading
              ? 'Loading your dashboard...'
              : `You have ${totalProducts} products listed and ${activeConversations} active conversations. Manage your catalog and grow your business!`}
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
        {/* Recent Products */}
        <div className="lg:col-span-2">
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Your Products</h2>
                <p className="text-muted-foreground mt-1">Recently added items in your catalog</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => onNavigate('products')}
                className="rounded-xl border-2 hover:border-primary hover:text-primary"
              >
                View All
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 size={32} className="animate-spin text-primary" /></div>
            ) : products.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No products yet. Add your first product!</p>
            ) : (
              <div className="space-y-4">
                {products.slice(0, 3).map((product: any) => (
                  <div
                    key={product._id}
                    className="p-6 rounded-2xl border-2 border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-foreground text-lg">{product.name || product.title || 'Unnamed Product'}</h4>
                          <Badge className={`${getStatusColor(product.status || 'active')} px-3 py-1 text-sm font-semibold border-2`}>
                            {product.status ? product.status.charAt(0).toUpperCase() + product.status.slice(1) : 'Active'}
                          </Badge>
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          Added: <strong className="text-foreground">{new Date(product.createdAt).toLocaleDateString()}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {product.price !== undefined && (
                          <p className="text-2xl font-bold text-primary">{product.price} TND</p>
                        )}
                        <Button variant="outline" size="sm" className="rounded-xl border-2" onClick={() => onNavigate('products')}>
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent Conversations */}
        <div className="space-y-6">
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare size={24} className="text-primary" />
              <h3 className="text-xl font-bold text-foreground">Recent Messages</h3>
            </div>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : recentConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No messages yet.</p>
            ) : (
              <div className="space-y-3">
                {recentConversations.map((conv, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl bg-gray-50 border-2 border-gray-100 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => onNavigate('messages')}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0"
                        style={{ backgroundColor: '#1E40AF' }}
                      >
                        {conv.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{conv.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{conv.role}</p>
                        <p className="text-xs text-muted-foreground">{conv.lastContact}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <Button size="sm" className="w-full rounded-xl" onClick={() => onNavigate('messages')}>
                  Open Messages
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}