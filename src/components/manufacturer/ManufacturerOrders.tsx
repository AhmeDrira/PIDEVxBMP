import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Package, Clock, CheckCircle, Truck, Search, Filter } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';

export default function ManufacturerOrders() {
  const orders = [
    { id: 'ORD-1234', customer: 'Ahmed Ben Salah', products: 'Premium Cement (x10)', amount: 450, status: 'processing', date: '2026-02-09' },
    { id: 'ORD-1233', customer: 'Fatma Hamdi', products: 'Steel Rebar (x5)', amount: 600, status: 'shipped', date: '2026-02-08' },
    { id: 'ORD-1232', customer: 'Youssef Trabelsi', products: 'Electrical Wire (x3)', amount: 285, status: 'delivered', date: '2026-02-07' },
    { id: 'ORD-1231', customer: 'Leila Gharbi', products: 'Paint - White (x4)', amount: 340, status: 'processing', date: '2026-02-07' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'shipped': return 'bg-primary/10 text-primary border-primary/20';
      case 'delivered': return 'bg-accent/10 text-accent border-accent/20';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <Package size={20} />;
      case 'shipped': return <Truck size={20} />;
      case 'delivered': return <CheckCircle size={20} />;
      default: return null;
    }
  };

  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = orders.filter(order =>
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.products.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Orders</h1>
        <p className="text-lg text-muted-foreground">Manage customer orders</p>
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            placeholder="Search orders..."
            className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <StatsCard
          label="Processing"
          value={orders.filter(o => o.status === 'processing').length}
          icon={<Package size={28} />}
          color="#F59E0B"
          subtitle="Being prepared"
        />
        <StatsCard
          label="Shipped"
          value={orders.filter(o => o.status === 'shipped').length}
          icon={<Truck size={28} />}
          color="#1E40AF"
          subtitle="In transit"
        />
        <StatsCard
          label="Delivered"
          value={orders.filter(o => o.status === 'delivered').length}
          icon={<CheckCircle size={28} />}
          color="#10B981"
          subtitle="Completed"
        />
      </div>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <Card key={order.id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-foreground">Order #{order.id}</h3>
                  <Badge className={`${getStatusColor(order.status)} px-4 py-1.5 text-sm font-semibold flex items-center gap-2 border-2`}>
                    {getStatusIcon(order.status)}
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  <strong className="text-foreground">Customer:</strong> {order.customer}
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  <strong className="text-foreground">Products:</strong> {order.products}
                </p>
                <p className="text-sm text-muted-foreground">
                  Date: <strong className="text-foreground">{order.date}</strong>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground font-medium mb-2">Amount</p>
                  <p className="text-3xl font-bold text-primary">{order.amount} TND</p>
                </div>
                <Button variant="outline" className="h-11 px-6 rounded-xl border-2">
                  View Details
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}