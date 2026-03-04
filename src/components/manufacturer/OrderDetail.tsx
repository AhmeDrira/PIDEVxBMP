import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowLeft, Package, User, MapPin, Phone, Mail, Calendar, CreditCard, Truck } from 'lucide-react';

interface OrderDetailProps {
  orderId: string;
  onBack: () => void;
}

export default function OrderDetail({ orderId, onBack }: OrderDetailProps) {
  // Mock order data
  const order = {
    id: orderId,
    customer: {
      name: 'Ahmed Ben Salah',
      email: 'ahmed@example.com',
      phone: '+216 XX XXX XXX',
      location: 'La Marsa, Tunis'
    },
    items: [
      { id: 1, product: 'Premium Cement - 50kg', quantity: 10, price: 45, total: 450 },
      { id: 2, product: 'Steel Rebar 12mm', quantity: 5, price: 120, total: 600 },
    ],
    subtotal: 1050,
    tax: 199.5,
    shipping: 25,
    total: 1274.5,
    status: 'processing',
    orderDate: '2026-02-09',
    estimatedDelivery: '2026-02-15',
    paymentMethod: 'Credit Card',
    paymentStatus: 'paid',
    shippingAddress: 'La Marsa, Tunis, Tunisia',
    notes: 'Please deliver between 9 AM - 5 PM'
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'shipped': return 'bg-primary/10 text-primary border-primary/20';
      case 'delivered': return 'bg-accent/10 text-accent border-accent/20';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    return status === 'paid' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-destructive/10 text-destructive border-destructive/20';
  };

  return (
    <div className="space-y-8">
      <Button variant="ghost" onClick={onBack} className="hover:bg-white rounded-xl">
        <ArrowLeft size={20} className="mr-2" />
        Back to Orders
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Order #{order.id}</h1>
          <p className="text-lg text-muted-foreground">Order details and status</p>
        </div>
        <div className="flex gap-3">
          <Badge className={`${getStatusColor(order.status)} px-4 py-2 text-sm font-semibold border-2`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
          <Badge className={`${getPaymentStatusColor(order.paymentStatus)} px-4 py-2 text-sm font-semibold border-2`}>
            {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-6">Order Items</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center shadow-md">
                      <Package size={32} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-lg mb-1">{item.product}</h4>
                      <p className="text-sm text-muted-foreground">Quantity: {item.quantity} units</p>
                      <p className="text-sm text-muted-foreground">Unit Price: {item.price} TND</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground font-medium mb-1">Total</p>
                    <p className="text-2xl font-bold text-primary">{item.total} TND</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Customer Information */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-6">Customer Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User size={24} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Name</p>
                  <p className="font-bold text-foreground">{order.customer.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Mail size={24} className="text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Email</p>
                  <p className="font-bold text-foreground">{order.customer.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Phone size={24} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Phone</p>
                  <p className="font-bold text-foreground">{order.customer.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <MapPin size={24} className="text-purple-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Location</p>
                  <p className="font-bold text-foreground">{order.customer.location}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Shipping Information */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-6">Shipping Information</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50">
                <Truck size={24} className="text-primary mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Delivery Address</p>
                  <p className="font-bold text-foreground">{order.shippingAddress}</p>
                </div>
              </div>
              {order.notes && (
                <div className="p-4 rounded-xl bg-secondary/5 border-2 border-secondary/20">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Delivery Notes</p>
                  <p className="text-foreground">{order.notes}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Order Summary</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar size={20} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Order Date</p>
                  <p className="font-bold text-foreground">{order.orderDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Truck size={20} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Est. Delivery</p>
                  <p className="font-bold text-foreground">{order.estimatedDelivery}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard size={20} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Payment Method</p>
                  <p className="font-bold text-foreground">{order.paymentMethod}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Payment Summary */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Payment Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground">{order.subtotal} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (19%)</span>
                <span className="font-semibold text-foreground">{order.tax} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-semibold text-foreground">{order.shipping} TND</span>
              </div>
              <div className="pt-4 border-t-2 border-gray-100">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-foreground">Total</span>
                  <span className="text-2xl font-bold text-primary">{order.total} TND</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-4">Actions</h3>
            <div className="space-y-3">
              <Button className="w-full h-11 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md">
                Mark as Shipped
              </Button>
              <Button variant="outline" className="w-full h-11 rounded-xl border-2">
                Contact Customer
              </Button>
              <Button variant="outline" className="w-full h-11 rounded-xl border-2">
                Print Invoice
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
