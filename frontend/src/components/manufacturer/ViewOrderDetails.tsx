import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, Package, User, Calendar, MapPin, Phone, Mail, CreditCard } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface ViewOrderDetailsProps {
  orderId?: string;
  onBack?: () => void;
}

export default function ViewOrderDetails({ orderId, onBack }: ViewOrderDetailsProps) {
  // Mock order data - in real app this would come from API/props
  const order = {
    id: orderId || 'ORD-2024-1234',
    date: '2026-02-15',
    status: 'processing',
    paymentStatus: 'paid',
    paymentMethod: 'Credit Card',
    paymentDate: '2026-02-15',
    buyer: {
      name: 'Ahmed Ben Salah',
      email: 'ahmed.bensalah@email.com',
      phone: '+216 98 765 432',
      address: '123 Avenue Habib Bourguiba, Tunis 1000, Tunisia'
    },
    products: [
      {
        id: 1,
        name: 'Premium Cement - 50kg',
        category: 'Building Materials',
        quantity: 10,
        unitPrice: 45,
        total: 450,
        image: 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=200&h=150&fit=crop'
      },
      {
        id: 2,
        name: 'Steel Rebar 12mm',
        category: 'Construction Steel',
        quantity: 5,
        unitPrice: 120,
        total: 600,
        image: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=200&h=150&fit=crop'
      },
      {
        id: 3,
        name: 'Ceramic Floor Tiles',
        category: 'Finishing Materials',
        quantity: 15,
        unitPrice: 35,
        total: 525,
        image: 'https://images.unsplash.com/photo-1615875474908-f403087c0052?w=200&h=150&fit=crop'
      }
    ],
    subtotal: 1575,
    tax: 299.25,
    shipping: 20,
    total: 1894.25,
    notes: 'Please deliver between 9 AM - 5 PM. Call before delivery.'
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700';
      case 'processing': return 'bg-secondary/10 text-secondary';
      case 'shipped': return 'bg-primary/10 text-primary';
      case 'delivered': return 'bg-accent/10 text-accent';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-accent/10 text-accent';
      case 'pending': return 'bg-secondary/10 text-secondary';
      case 'failed': return 'bg-destructive/10 text-destructive';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {onBack && (
        <Button 
          variant="outline" 
          onClick={onBack} 
          className="rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Orders
        </Button>
      )}

      {/* Order Header */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Package size={32} className="text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Order #{order.id}</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge className={`${getStatusColor(order.status)} text-sm px-3 py-1.5 border-0 font-semibold`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Badge>
              <Badge className={`${getPaymentStatusColor(order.paymentStatus)} text-sm px-3 py-1.5 border-0 font-semibold`}>
                Payment: {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-1">Order Date</p>
            <p className="text-lg font-semibold text-foreground">
              {new Date(order.date).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Buyer Information */}
          <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-0">
            <div className="flex items-center gap-2 mb-4">
              <User size={20} className="text-primary" />
              <h3 className="font-bold text-foreground">Buyer Information</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <User size={18} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground mb-0.5">Name</p>
                  <p className="font-semibold text-foreground">{order.buyer.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={18} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground mb-0.5">Email</p>
                  <p className="font-medium text-foreground">{order.buyer.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={18} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground mb-0.5">Phone</p>
                  <p className="font-medium text-foreground">{order.buyer.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={18} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground mb-0.5">Delivery Address</p>
                  <p className="font-medium text-foreground">{order.buyer.address}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Payment Information */}
          <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-0">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={20} className="text-primary" />
              <h3 className="font-bold text-foreground">Payment Information</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CreditCard size={18} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground mb-0.5">Payment Method</p>
                  <p className="font-semibold text-foreground">{order.paymentMethod}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar size={18} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground mb-0.5">Payment Date</p>
                  <p className="font-medium text-foreground">
                    {new Date(order.paymentDate).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className={`${getPaymentStatusColor(order.paymentStatus)} px-3 py-1.5 text-sm font-semibold border-0`}>
                  {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </Card>

      {/* Order Items */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Order Items</h2>
        
        <div className="space-y-4 mb-6">
          {order.products.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-4 p-6 rounded-2xl border-2 border-gray-100 hover:border-primary/20 transition-all"
            >
              <div className="w-24 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-gray-200">
                <ImageWithFallback
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-foreground text-lg mb-1">{product.name}</h4>
                <Badge className="bg-gray-100 text-gray-700 text-xs px-2 py-1 border-0 mb-2">
                  {product.category}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Unit Price: <strong className="text-foreground">{product.unitPrice.toFixed(2)} TND</strong>
                </p>
              </div>
              <div className="text-center px-4">
                <p className="text-sm text-muted-foreground mb-1">Quantity</p>
                <p className="text-2xl font-bold text-foreground">{product.quantity}</p>
              </div>
              <div className="text-right min-w-[120px]">
                <p className="text-sm text-muted-foreground mb-1">Total</p>
                <p className="text-2xl font-bold text-primary">{product.total.toFixed(2)} TND</p>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="flex justify-end">
          <div className="w-full md:w-1/2 lg:w-1/3 space-y-4">
            <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gray-50">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-semibold text-foreground">{order.subtotal.toFixed(2)} TND</span>
            </div>
            <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gray-50">
              <span className="text-muted-foreground">Shipping:</span>
              <span className="font-semibold text-foreground">{order.shipping.toFixed(2)} TND</span>
            </div>
            <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gray-50">
              <span className="text-muted-foreground">Tax (19%):</span>
              <span className="font-semibold text-foreground">{order.tax.toFixed(2)} TND</span>
            </div>
            <div className="flex justify-between items-center py-4 px-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/20 border-2 border-primary/20">
              <span className="text-lg font-bold text-foreground">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">{order.total.toFixed(2)} TND</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Order Notes */}
      {order.notes && (
        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
          <h3 className="text-xl font-bold text-foreground mb-4">Order Notes</h3>
          <p className="text-muted-foreground leading-relaxed">{order.notes}</p>
        </Card>
      )}
    </div>
  );
}
