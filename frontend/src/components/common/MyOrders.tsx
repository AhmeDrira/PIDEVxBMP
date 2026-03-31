import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  ShoppingBag, Package, Truck, CheckCircle, Clock, Search,
  ChevronRight, Loader2, MapPin, Phone, Mail, ArrowLeft,
  CircleDot, PackageCheck, XCircle
} from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => {
  let token = localStorage.getItem('token');
  const userStorage = localStorage.getItem('user');
  if (!token && userStorage) token = JSON.parse(userStorage).token;
  return token;
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:    { label: 'Pending',    color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200',   icon: Clock },
  paid:       { label: 'Confirmed',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200',     icon: CheckCircle },
  processing: { label: 'Processing', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',       icon: Package },
  shipped:    { label: 'Shipped',    color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200',   icon: Truck },
  delivered:  { label: 'Delivered',  color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200', icon: PackageCheck },
  cancelled:  { label: 'Cancelled',  color: 'text-red-700',    bg: 'bg-red-50 border-red-200',         icon: XCircle },
  failed:     { label: 'Failed',     color: 'text-red-700',    bg: 'bg-red-50 border-red-200',         icon: XCircle },
};

const timelineSteps = ['paid', 'processing', 'shipped', 'delivered'];

export default function MyOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;
      const res = await axios.get(`${API_URL}/products/my-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(res.data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrderDetail = async (orderId: string) => {
    try {
      setIsLoadingDetail(true);
      const token = getToken();
      if (!token) return;
      const res = await axios.get(`${API_URL}/products/my-orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedOrder(res.data);
    } catch (err) {
      console.error('Error fetching order detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const filtered = orders.filter((o) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      (o.orderNumber || '').toLowerCase().includes(q) ||
      String(o.id || o._id).toLowerCase().includes(q) ||
      (o.items || []).some((item: any) => item.name?.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSpent = orders.filter(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status)).reduce((s, o) => s + (o.totalAmount || 0), 0);
  const activeCount = orders.filter(o => ['paid', 'processing', 'shipped'].includes(o.status)).length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;

  // --- ORDER DETAIL VIEW ---
  if (selectedOrder) {
    const order = selectedOrder;
    const status = statusConfig[order.status] || statusConfig['pending'];
    const StatusIcon = status.icon;
    const currentStepIndex = timelineSteps.indexOf(order.status);

    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setSelectedOrder(null)} className="rounded-xl border-2">
          <ArrowLeft size={18} className="mr-2" /> Back to Orders
        </Button>

        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Order Header */}
            <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Order</p>
                  <h2 className="text-2xl font-bold text-foreground">{order.orderNumber || `#${String(order.id).slice(-8).toUpperCase()}`}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Placed on {new Date(order.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at {new Date(order.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <Badge className={`${status.bg} ${status.color} border flex items-center gap-1.5 px-4 py-2 text-sm`}>
                  <StatusIcon size={16} />
                  {status.label}
                </Badge>
              </div>
            </Card>

            {/* Delivery Timeline */}
            <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
              <h3 className="text-lg font-bold text-foreground mb-6">Delivery Timeline</h3>

              {/* Visual Progress Bar */}
              <div className="relative mb-8">
                <div className="flex items-center justify-between relative">
                  {timelineSteps.map((stepStatus, i) => {
                    const stepConf = statusConfig[stepStatus];
                    const StepIcon = stepConf?.icon || CircleDot;
                    const isReached = currentStepIndex >= i;
                    const isCurrent = currentStepIndex === i;
                    return (
                      <div key={stepStatus} className="flex flex-col items-center z-10" style={{ flex: 1 }}>
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500"
                          style={{
                            backgroundColor: isReached ? (isCurrent ? 'var(--primary, #2563eb)' : '#22c55e') : 'var(--muted)',
                            color: isReached ? '#ffffff' : '#9ca3af',
                            boxShadow: isCurrent ? '0 4px 14px rgba(37,99,235,0.3)' : 'none',
                          }}
                        >
                          {isReached && !isCurrent
                            ? <CheckCircle size={20} style={{ color: '#ffffff' }} />
                            : <StepIcon size={20} style={{ color: isReached ? '#ffffff' : '#9ca3af' }} />
                          }
                        </div>
                        <span
                          className="text-xs mt-2 font-medium"
                          style={{ color: isReached ? (isCurrent ? 'var(--primary, #2563eb)' : '#16a34a') : '#9ca3af' }}
                        >
                          {stepConf?.label}
                        </span>
                      </div>
                    );
                  })}
                  {/* Connecting line */}
                  <div className="absolute top-6 left-[12.5%] right-[12.5%] h-1 bg-muted rounded-full">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        backgroundColor: '#22c55e',
                        width: currentStepIndex >= 0 ? `${Math.min(100, (currentStepIndex / (timelineSteps.length - 1)) * 100)}%` : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Timeline Events */}
              {(order.deliveryTimeline || []).length > 0 && (
                <div className="border-t border-border pt-5">
                  <div className="space-y-4">
                    {(order.deliveryTimeline || []).map((event: any, i: number) => {
                      const eventConf = statusConfig[event.status] || {};
                      const EventIcon = eventConf.icon || CircleDot;
                      return (
                        <div key={i} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${eventConf.bg || 'bg-muted'} border`}>
                              <EventIcon size={14} className={eventConf.color || 'text-muted-foreground'} />
                            </div>
                            {i < (order.deliveryTimeline || []).length - 1 && (
                              <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-2">
                            <p className="font-semibold text-foreground text-sm">{event.label}</p>
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
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

            {/* Items & Details Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Items */}
              <div className="lg:col-span-2">
                <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
                  <h3 className="text-lg font-bold text-foreground mb-4">Order Items</h3>
                  <div className="space-y-3">
                    {(order.items || []).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                          <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{item.name || 'Unknown Product'}</p>
                          {item.manufacturerName && (
                            <p className="text-xs text-muted-foreground">by {item.manufacturerName}</p>
                          )}
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity} x {(item.price || 0).toFixed(2)} DT</p>
                        </div>
                        <p className="font-bold text-foreground text-right">
                          {((item.price || 0) * (item.quantity || 1)).toFixed(2)} DT
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{((order.totalAmount || 0) - (order.shippingAmount || 0)).toFixed(2)} DT</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Shipping</span>
                      <span>{(order.shippingAmount || 0).toFixed(2)} DT</span>
                    </div>
                    <div className="flex justify-between font-bold text-foreground pt-2 border-t border-border">
                      <span>Total</span>
                      <span className="text-primary text-lg">{(order.totalAmount || 0).toFixed(2)} DT</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Shipping Info */}
              <div className="space-y-4">
                {order.shippingAddress && (
                  <Card className="p-5 bg-card rounded-2xl border border-border shadow-lg">
                    <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <MapPin size={16} className="text-primary" /> Shipping Address
                    </h4>
                    <div className="space-y-1 text-sm">
                      {order.shippingAddress.fullName && <p className="font-medium">{order.shippingAddress.fullName}</p>}
                      {order.shippingAddress.address && <p className="text-muted-foreground">{order.shippingAddress.address}</p>}
                      <p className="text-muted-foreground">
                        {[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postalCode].filter(Boolean).join(', ')}
                      </p>
                      {order.shippingAddress.country && <p className="text-muted-foreground">{order.shippingAddress.country}</p>}
                    </div>
                  </Card>
                )}

                {order.contactInfo && (
                  <Card className="p-5 bg-card rounded-2xl border border-border shadow-lg">
                    <h4 className="text-sm font-bold text-foreground mb-3">Contact Info</h4>
                    <div className="space-y-2 text-sm">
                      {order.contactInfo.email && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <Mail size={14} /> {order.contactInfo.email}
                        </p>
                      )}
                      {order.contactInfo.phone && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <Phone size={14} /> {order.contactInfo.phone}
                        </p>
                      )}
                    </div>
                  </Card>
                )}

                {order.shippingMethod && (
                  <Card className="p-5 bg-card rounded-2xl border border-border shadow-lg">
                    <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Truck size={16} className="text-primary" /> Shipping Method
                    </h4>
                    <p className="font-medium text-sm">{order.shippingMethod.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Est. {order.shippingMethod.estimatedDays} business days &middot; {(order.shippingMethod.cost || 0).toFixed(2)} DT
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- ORDER LIST VIEW ---
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-card rounded-2xl border border-border shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingBag size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Spent</p>
              <p className="text-xl font-bold text-foreground">{totalSpent.toFixed(2)} DT</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-card rounded-2xl border border-border shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Package size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Active Orders</p>
              <p className="text-xl font-bold text-foreground">{activeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-card rounded-2xl border border-border shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <PackageCheck size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Delivered</p>
              <p className="text-xl font-bold text-foreground">{deliveredCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="p-4 bg-card rounded-2xl border border-border shadow-lg">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by order number or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 rounded-xl border-2 border-border focus:border-primary"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'paid', 'processing', 'shipped', 'delivered'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-primary dark:bg-blue-600 text-white shadow-md'
                    : 'bg-muted text-muted-foreground hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'All' : (statusConfig[s]?.label || s)}
              </button>
            ))}
          </div>
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
          <h3 className="text-xl font-bold text-foreground mb-2">No orders found</h3>
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Your material purchases will appear here after checkout.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const st = statusConfig[order.status] || statusConfig['pending'];
            const StIcon = st.icon;
            const date = order.date
              ? new Date(order.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—';
            const itemCount = (order.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
            const firstImage = order.items?.[0]?.image;

            return (
              <Card
                key={order.id || order._id}
                className="bg-card rounded-2xl border border-border shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                onClick={() => fetchOrderDetail(order.id || order._id)}
              >
                <div className="flex items-center gap-4 p-5">
                  {/* Order Image Preview */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0 relative">
                    {firstImage ? (
                      <ImageWithFallback src={firstImage} alt="Order" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={24} className="text-muted-foreground" />
                      </div>
                    )}
                    {itemCount > 1 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary dark:bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                        {itemCount}
                      </div>
                    )}
                  </div>

                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-foreground">{order.orderNumber || `#${String(order.id || order._id).slice(-8).toUpperCase()}`}</p>
                      <Badge className={`${st.bg} ${st.color} border flex items-center gap-1 px-2 py-0.5 text-xs`}>
                        <StIcon size={12} />
                        {st.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {(order.items || []).map((i: any) => i.name).join(', ')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                  </div>

                  {/* Amount & Arrow */}
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-bold text-primary">{(order.totalAmount || 0).toFixed(2)} DT</p>
                    <ChevronRight size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>

                {/* Mini progress bar */}
                {['paid', 'processing', 'shipped', 'delivered'].includes(order.status) && (
                  <div className="px-5 pb-4">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${((timelineSteps.indexOf(order.status) + 1) / timelineSteps.length) * 100}%`,
                          backgroundColor: order.status === 'delivered' ? '#10b981' : '#7c3aed',
                        }}
                      />
                    </div>
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
