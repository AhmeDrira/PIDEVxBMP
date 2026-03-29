import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Package, Clock, CheckCircle, Truck, Search, Filter, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import axios from 'axios';
import OrderDetail from './OrderDetail';

export default function ManufacturerOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;
      const response = await axios.get(`${API_URL}/products/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
    } catch (error) {
      console.error("Erreur chargement commandes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'shipped': return 'bg-primary/10 text-primary border-primary/20';
      case 'delivered': return 'bg-accent/10 text-accent border-accent/20';
      case 'paid': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <Package size={20} />;
      case 'shipped': return <Truck size={20} />;
      case 'delivered': return <CheckCircle size={20} />;
      case 'paid': return <CheckCircle size={20} />;
      default: return null;
    }
  };

  const filteredOrders = orders.filter(order =>
    (order.id && order.id.toString().toLowerCase().includes(searchTerm.toLowerCase())) ||
    (order.customer && order.customer.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (order.products && order.products.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (view === 'detail' && selectedOrder) {
    return (
      <OrderDetail 
        order={selectedOrder} 
        onBack={() => { setView('list'); setSelectedOrder(null); }} 
      />
    );
  }

  return (
    <div className="space-y-8">
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

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            <StatsCard
              label="Processing"
              value={orders.filter(o => o.status === 'processing' || o.status === 'paid').length}
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
            {filteredOrders.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-muted-foreground">
                <Package size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-xl font-medium">No orders found</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <Card key={order.id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-xl font-bold text-foreground truncate max-w-[250px]">{order.orderNumber || `Order #${order.id.slice(-6)}`}</h3>
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
                        <p className="text-3xl font-bold text-primary">{order.amount.toFixed(2)} TND</p>
                      </div>
                      <Button 
                        onClick={() => { setSelectedOrder(order); setView('detail'); }}
                        variant="outline" 
                        className="h-11 px-6 rounded-xl border-2 !border-emerald-500 !text-emerald-600 hover:!bg-emerald-50 transition-all font-semibold"
                      >
                        Manage Order
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}