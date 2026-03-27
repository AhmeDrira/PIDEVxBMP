import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowLeft, Package, User, Mail, Calendar, CreditCard, Truck, FileText, CheckCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

interface OrderDetailProps {
  order: any;
  onBack: () => void;
}

export default function OrderDetail({ order, onBack }: OrderDetailProps) {
  const [status, setStatus] = useState(order?.status || 'processing');
  const [isUpdating, setIsLoading] = useState(false);

  if (!order) return null;

  const SERVER_URL = 'http://localhost:5000';
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const getToken = () => {
    const s = localStorage.getItem('user');
    if (s) {
      try { return JSON.parse(s).token; } catch { /* */ }
    }
    return localStorage.getItem('token') || null;
  };

  const updateStatus = async (newStatus: string) => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      await axios.put(`${API_URL}/products/orders/${order.id}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setStatus(newStatus);
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.response?.data?.message || "Failed to update order status");
    } finally {
      setIsLoading(false);
    }
  };

  const getImageUrl = (path: string) => {
    if (!path) return null;
    const cleanPath = path.replace(/\\/g, '/');
    return cleanPath.startsWith('http') ? cleanPath : `${SERVER_URL}/${cleanPath}`;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'processing': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'shipped': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'paid': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const currentStatus = status?.toLowerCase() || 'processing';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Button variant="ghost" onClick={onBack} className="hover:bg-white rounded-xl group transition-all">
        <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Orders
      </Button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Order #{order.id.slice(-6)}</h1>
          <p className="text-lg text-muted-foreground flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            Transaction ID: <span className="font-mono text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-700">{order.stripeSessionId}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Badge className={`${getStatusColor(currentStatus)} px-5 py-2.5 text-sm font-bold border-2 shadow-sm uppercase tracking-wider`}>
            {currentStatus}
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Order Summary Table */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-2 h-full bg-primary/20"></div>
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Package size={24} className="text-primary" />
              Order Summary
            </h2>
            <div className="space-y-4">
              {order.items && order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100 shadow-sm mb-4">
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner border border-primary/5 overflow-hidden">
                      {item.image ? (
                        <img src={getImageUrl(item.image) || ''} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={32} className="text-primary" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-xl mb-1">{item.name}</h4>
                      <p className="text-sm text-muted-foreground font-medium bg-slate-100 inline-block px-3 py-1 rounded-full">Quantity: {item.quantity}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mb-1">Price</p>
                    <p className="text-2xl font-black text-primary">{(item.price * item.quantity).toFixed(2)} <span className="text-xs font-bold">TND</span></p>
                  </div>
                </div>
              ))}
              
              {!order.items && (
                <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100 shadow-sm">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner border border-primary/5">
                      <Package size={32} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-xl mb-1">{order.products}</h4>
                      <p className="text-sm text-muted-foreground font-medium bg-slate-100 inline-block px-3 py-1 rounded-full">Items included in this payment</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mb-1">Total Amount</p>
                    <p className="text-3xl font-black text-primary">{order.amount.toFixed(2)} <span className="text-sm font-bold">TND</span></p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Customer Information */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-secondary/20"></div>
            <h2 className="text-2xl font-bold text-foreground mb-8 flex items-center gap-3">
              <User size={24} className="text-secondary" />
              Customer Details
            </h2>
            <div className="grid md:grid-cols-2 gap-10">
              <div className="flex items-center gap-6 p-5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-all duration-300">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm border border-primary/5">
                  <User size={32} className="text-primary" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Customer Name</p>
                  <p className="font-black text-foreground text-xl leading-none">{order.customer}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 p-5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-all duration-300">
                <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center shadow-sm border border-secondary/5">
                  <Mail size={32} className="text-secondary" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Email Address</p>
                  <p className="font-black text-foreground text-xl leading-none truncate max-w-[200px]" title={order.customerEmail}>{order.customerEmail || 'No email provided'}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Action Card - ENHANCED CLARITY */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-2xl ring-1 ring-slate-200 border-t-4 border-blue-600 relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Package size={80} className="text-blue-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3 relative z-10">
                <div 
                  className="p-3 rounded-2xl text-white shadow-lg shadow-blue-200"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  <Truck size={24} />
                </div>
                Manage Order
            </h3>
            <div className="space-y-5 relative z-10">
              {(currentStatus === 'processing' || currentStatus === 'paid') && (
                <Button 
                  onClick={() => updateStatus('shipped')}
                  disabled={isUpdating}
                  className="w-full h-16 text-white rounded-2xl shadow-xl shadow-blue-200 font-black text-base uppercase tracking-widest border-0 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  {isUpdating ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                  Mark as Shipped
                </Button>
              )}
              {currentStatus === 'shipped' && (
                <Button 
                  onClick={() => updateStatus('delivered')}
                  disabled={isUpdating}
                  className="w-full h-16 text-white rounded-2xl shadow-xl shadow-emerald-200 font-black text-base uppercase tracking-widest border-0 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                  style={{ backgroundColor: '#10b981' }}
                >
                  {isUpdating ? <Loader2 size={20} className="animate-spin" /> : <Package size={20} />}
                  Mark as Delivered
                </Button>
              )}
              <div className="pt-2">
                <Button variant="outline" className="w-full h-14 rounded-xl border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
                  <Mail size={18} className="text-blue-600" />
                  Contact Customer
                </Button>
              </div>
            </div>
          </Card>

          {/* Order Details Card */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-xl border-t-4 border-primary">
            <h3 className="text-xl font-bold text-foreground mb-8 pb-4 border-b border-slate-100 flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              Timeline & Payment
            </h3>
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <Calendar size={22} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">Order Date</p>
                  <p className="font-black text-foreground text-lg">{order.date}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <CreditCard size={22} className="text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">Payment Method</p>
                  <p className="font-black text-foreground text-lg">Stripe Online</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <Truck size={22} className="text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">Status</p>
                  <p className="font-black text-foreground text-lg capitalize">{status}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
