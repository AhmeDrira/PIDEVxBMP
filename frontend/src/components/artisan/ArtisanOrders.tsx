import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import StatsCard from '../common/StatsCard';
import {
  ShoppingBag, Package, Truck, CheckCircle, Clock, Search, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => {
  let token = localStorage.getItem('token');
  const userStorage = localStorage.getItem('user');
  if (!token && userStorage) token = JSON.parse(userStorage).token;
  return token;
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200',  icon: <Clock size={14} /> },
  paid:      { label: 'Paid',      color: 'bg-green-100 text-green-700 border-green-200',     icon: <CheckCircle size={14} /> },
  shipped:   { label: 'Shipped',   color: 'bg-blue-100 text-blue-700 border-blue-200',        icon: <Truck size={14} /> },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle size={14} /> },
  failed:    { label: 'Failed',    color: 'bg-red-100 text-red-700 border-red-200',            icon: <Package size={14} /> },
};

export default function ArtisanOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoading(true);
        const token = getToken();
        if (!token) return;
        const res = await axios.get(`${API_URL}/payments/product-payments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOrders(res.data || []);
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const filtered = orders.filter((o) => {
    const q = searchTerm.toLowerCase();
    return (
      !q ||
      String(o._id).toLowerCase().includes(q) ||
      (o.items || []).some((item: any) => item.name?.toLowerCase().includes(q))
    );
  });

  const totalSpent = orders.filter(o => o.status === 'paid' || o.status === 'delivered' || o.status === 'shipped').reduce((s, o) => s + (o.totalAmount || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;

  const toggleExpand = (id: string) => setExpandedOrder(prev => prev === id ? null : id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Orders</h1>
          <p className="text-muted-foreground mt-1">Track your material purchases from the marketplace</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Total Spent"
          value={`${totalSpent.toFixed(2)} TND`}
          icon={<ShoppingBag size={20} />}
          color="primary"
        />
        <StatsCard
          title="Pending Orders"
          value={String(pendingCount)}
          icon={<Clock size={20} />}
          color="secondary"
        />
        <StatsCard
          title="Delivered"
          value={String(deliveredCount)}
          icon={<CheckCircle size={20} />}
          color="accent"
        />
      </div>

      {/* Search */}
      <Card className="p-4 bg-card rounded-2xl border-0 shadow-sm">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders by ID or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 rounded-xl border-2 border-border focus:border-primary"
          />
        </div>
      </Card>

      {/* Orders List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 bg-card rounded-2xl border border-border shadow-lg text-center">
          <ShoppingBag size={48} className="text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-xl font-bold text-foreground mb-2">No orders yet</h3>
          <p className="text-muted-foreground">Your material purchases will appear here after checkout.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => {
            const status = statusConfig[order.status] || statusConfig['pending'];
            const isExpanded = expandedOrder === order._id;
            const date = order.paymentDate
              ? new Date(order.paymentDate).toLocaleDateString('en-GB')
              : order.createdAt
                ? new Date(order.createdAt).toLocaleDateString('en-GB')
                : '—';

            return (
              <Card key={order._id} className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
                {/* Order Header */}
                <div
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpand(order._id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Package size={22} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Order ID</p>
                      <p className="font-bold text-foreground font-mono text-sm">#{String(order._id).slice(-8).toUpperCase()}</p>
                      <p className="text-sm text-muted-foreground mt-1">{date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Total</p>
                      <p className="text-2xl font-bold text-primary">{(order.totalAmount || 0).toFixed(2)} TND</p>
                    </div>
                    <Badge className={`${status.color} border flex items-center gap-1.5 px-3 py-1.5`}>
                      {status.icon}
                      {status.label}
                    </Badge>
                    <div className="text-muted-foreground">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Expandable Items */}
                {isExpanded && (
                  <div className="border-t border-border px-6 pb-6 pt-4">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Items</h4>
                    <div className="space-y-3">
                      {(order.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Package size={16} className="text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{item.name || 'Unknown Product'}</p>
                              <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                          </div>
                          <p className="font-bold text-foreground">
                            {((item.price || 0) * (item.quantity || 1)).toFixed(2)} TND
                          </p>
                        </div>
                      ))}
                    </div>

                    {order.stripeSessionId && (
                      <p className="text-xs text-muted-foreground mt-4 font-mono">
                        Stripe Session: {order.stripeSessionId}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
