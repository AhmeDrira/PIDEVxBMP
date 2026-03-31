import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ArrowLeft, Package, User, Mail, Calendar, CreditCard, Truck, FileText,
  CheckCircle, Loader2, MapPin, Phone, Clock, PackageCheck, CircleDot
} from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import axios from 'axios';
import { toast } from 'sonner';

interface OrderDetailProps {
  order: any;
  onBack: () => void;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  processing: { label: 'Processing', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   icon: Package },
  shipped:    { label: 'Shipped',    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',     icon: Truck },
  delivered:  { label: 'Delivered',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: PackageCheck },
  paid:       { label: 'Confirmed',  color: 'text-green-700',   bg: 'bg-green-50 border-green-200',    icon: CheckCircle },
};

const timelineSteps = ['paid', 'processing', 'shipped', 'delivered'];

export default function OrderDetail({ order, onBack }: OrderDetailProps) {
  const [status, setStatus] = useState(order?.status || 'processing');
  const [timeline, setTimeline] = useState(order?.deliveryTimeline || []);
  const [isUpdating, setIsUpdating] = useState(false);

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
      setIsUpdating(true);
      const token = getToken();
      if (!token) return;

      await axios.put(`${API_URL}/products/orders/${order.id}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setStatus(newStatus);
      // Add timeline event locally
      const labels: Record<string, { label: string; description: string }> = {
        processing: { label: 'Order Processing', description: 'Order is being prepared by the manufacturer.' },
        shipped: { label: 'Order Shipped', description: 'Order has been shipped and is on its way.' },
        delivered: { label: 'Order Delivered', description: 'Order has been delivered successfully.' },
      };
      setTimeline((prev: any[]) => [...prev, {
        status: newStatus,
        label: labels[newStatus]?.label || newStatus,
        description: labels[newStatus]?.description || '',
        date: new Date().toISOString(),
      }]);
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.response?.data?.message || "Failed to update order status");
    } finally {
      setIsUpdating(false);
    }
  };

  const getImageUrl = (path: string) => {
    if (!path) return null;
    const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
    return cleanPath.startsWith('http') ? cleanPath : `${SERVER_URL}/${cleanPath}`;
  };

  const currentStatus = status?.toLowerCase() || 'processing';
  const stConf = statusConfig[currentStatus] || statusConfig['processing'];
  const StIcon = stConf.icon;
  const currentStepIndex = timelineSteps.indexOf(currentStatus);

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
        <ArrowLeft size={18} className="mr-2" /> Back to Orders
      </Button>

      {/* Header */}
      <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Order</p>
            <h1 className="text-2xl font-bold text-foreground">
              {order.orderNumber || `#${String(order.id).slice(-6).toUpperCase()}`}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{order.date}</p>
          </div>
          <Badge className={`${stConf.bg} ${stConf.color} border flex items-center gap-1.5 px-4 py-2 text-sm`}>
            <StIcon size={16} />
            {stConf.label}
          </Badge>
        </div>
      </Card>

      {/* Progress Bar */}
      <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
        <h3 className="text-lg font-bold text-foreground mb-5">Order Progress</h3>
        <div className="relative">
          <div className="flex items-center justify-between relative">
            {timelineSteps.map((stepStatus, i) => {
              const sConf = statusConfig[stepStatus];
              const SIcon = sConf?.icon || CircleDot;
              const isReached = currentStepIndex >= i;
              const isCurrent = currentStepIndex === i;
              return (
                <div key={stepStatus} className="flex flex-col items-center z-10" style={{ flex: 1 }}>
                  <div
                    className="rounded-full flex items-center justify-center transition-all duration-500 flex-shrink-0"
                    style={{
                      width: 44, height: 44,
                      minWidth: 44, minHeight: 44,
                      backgroundColor: isReached ? (isCurrent ? 'var(--primary, #2563eb)' : '#22c55e') : 'var(--muted)',
                      color: isReached ? '#ffffff' : '#9ca3af',
                      boxShadow: isCurrent ? '0 4px 14px rgba(37,99,235,0.3)' : 'none',
                    }}
                  >
                    {isReached && !isCurrent
                      ? <CheckCircle size={18} style={{ color: '#ffffff' }} />
                      : <SIcon size={18} style={{ color: isReached ? '#ffffff' : '#9ca3af' }} />
                    }
                  </div>
                  <span
                    className="text-xs mt-1.5 font-medium"
                    style={{ color: isReached ? (isCurrent ? 'var(--primary, #2563eb)' : '#16a34a') : '#9ca3af' }}
                  >
                    {sConf?.label}
                  </span>
                </div>
              );
            })}
            <div className="absolute top-5 left-[12.5%] right-[12.5%] h-1 bg-muted rounded-full">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ backgroundColor: '#22c55e' }}
                style={{ width: currentStepIndex >= 0 ? `${Math.min(100, (currentStepIndex / (timelineSteps.length - 1)) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* Timeline Events */}
        {timeline.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border">
            <div className="space-y-3">
              {timeline.map((event: any, i: number) => {
                const evConf = statusConfig[event.status] || {};
                const EvIcon = evConf.icon || CircleDot;
                return (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${evConf.bg || 'bg-muted'} border`}>
                      <EvIcon size={12} className={evConf.color || 'text-muted-foreground'} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{event.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Package size={20} className="text-primary" /> Order Items
            </h3>
            <div className="space-y-3">
              {(order.items || []).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                      {item.image ? (
                        <img src={getImageUrl(item.image) || ''} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package size={20} className="text-muted-foreground" /></div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-primary">{(item.price * item.quantity).toFixed(2)} DT</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between font-bold text-foreground">
              <span>Total</span>
              <span className="text-xl text-primary">{(order.amount || 0).toFixed(2)} DT</span>
            </div>
          </Card>

          {/* Customer Info */}
          <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <User size={20} className="text-primary" /> Customer
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <User size={18} className="text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-semibold">{order.customer}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <Mail size={18} className="text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-semibold truncate">{order.customerEmail || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Shipping address if available */}
            {order.shippingAddress && (
              <div className="mt-4 p-4 rounded-xl bg-muted/50">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                  <MapPin size={16} className="text-primary" /> Shipping Address
                </p>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {order.shippingAddress.fullName && <p className="font-medium text-foreground">{order.shippingAddress.fullName}</p>}
                  {order.shippingAddress.address && <p>{order.shippingAddress.address}</p>}
                  <p>{[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(', ')}</p>
                  {order.shippingAddress.phone && <p className="flex items-center gap-1"><Phone size={12} /> {order.shippingAddress.phone}</p>}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-4">
          <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Truck size={20} className="text-primary" /> Update Status
            </h3>
            <div className="space-y-3">
              {(currentStatus === 'processing' || currentStatus === 'paid') && (
                <Button
                  onClick={() => updateStatus('shipped')}
                  disabled={isUpdating}
                  className="w-full h-12 text-white rounded-xl font-semibold transition-all"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  {isUpdating ? <Loader2 size={18} className="animate-spin mr-2" /> : <Truck size={18} className="mr-2" />}
                  Mark as Shipped
                </Button>
              )}
              {currentStatus === 'shipped' && (
                <Button
                  onClick={() => updateStatus('delivered')}
                  disabled={isUpdating}
                  className="w-full h-12 text-white rounded-xl font-semibold transition-all"
                  style={{ backgroundColor: '#10b981' }}
                >
                  {isUpdating ? <Loader2 size={18} className="animate-spin mr-2" /> : <PackageCheck size={18} className="mr-2" />}
                  Mark as Delivered
                </Button>
              )}
              {currentStatus === 'delivered' && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <PackageCheck size={24} className="mx-auto mb-2 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-700">Order completed</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5 bg-card rounded-2xl border border-border shadow-lg">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <FileText size={16} className="text-primary" /> Details
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{order.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">Payment:</span>
                <span className="font-medium">Stripe</span>
              </div>
              {order.shippingMethod && (
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Shipping:</span>
                  <span className="font-medium">{order.shippingMethod.name}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
