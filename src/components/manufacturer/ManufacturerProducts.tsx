import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Search, Package, Edit, Trash2, Upload, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/badge';

export default function ManufacturerProducts() {
  const [view, setView] = useState<'list' | 'add'>('list');

  const products = [
    { id: 1, name: 'Premium Cement - 50kg', category: 'Building Materials', price: 45, stock: 150, status: 'active' },
    { id: 2, name: 'Steel Rebar 12mm', category: 'Construction Steel', price: 120, stock: 80, status: 'active' },
    { id: 3, name: 'Ceramic Floor Tiles', category: 'Finishing Materials', price: 35, stock: 200, status: 'active' },
    { id: 4, name: 'Paint - White 20L', category: 'Finishing Materials', price: 85, stock: 8, status: 'low-stock' },
  ];

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-destructive/10 text-destructive border-destructive/20';
  };

  if (view === 'add') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="outline" 
          onClick={() => setView('list')} 
          className="mb-6 rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Products
        </Button>
        <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">Add New Product</h2>
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setView('list'); }}>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Product Name</Label>
              <Input placeholder="Enter product name" className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary" required />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Category</Label>
                <select className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none">
                  <option>Building Materials</option>
                  <option>Construction Steel</option>
                  <option>Finishing Materials</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">Price (TND)</Label>
                <Input type="number" placeholder="0.00" className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Stock Quantity</Label>
              <Input type="number" placeholder="0" className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary" required />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Description</Label>
              <Textarea placeholder="Product description..." rows={4} className="rounded-xl border-2 border-gray-200 focus:border-primary" />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Technical Document</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-primary transition-colors bg-gray-50">
                <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
                <Input type="file" accept=".pdf,.doc,.docx" />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
                Publish Product
              </Button>
              <Button type="button" variant="outline" onClick={() => setView('list')} className="h-12 px-8 rounded-xl border-2">
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">My Products</h1>
          <p className="text-lg text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button onClick={() => setView('add')} className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
          <Plus size={20} className="mr-2" />
          Add Product
        </Button>
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input placeholder="Search products..." className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary" />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shadow-md">
                <Package size={28} className="text-primary" />
              </div>
              <Badge className={`${getStatusColor(product.status)} px-3 py-1 text-xs font-semibold border-2`}>
                {product.status}
              </Badge>
            </div>
            <h3 className="font-bold text-foreground text-lg mb-2">{product.name}</h3>
            <p className="text-sm text-muted-foreground mb-6">{product.category}</p>
            <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-gray-50">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Price</p>
                <p className="text-2xl font-bold text-primary">{product.price} TND</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Stock</p>
                <p className="text-2xl font-bold text-foreground">{product.stock}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11 rounded-xl border-2">
                <Edit size={16} className="mr-2" />
                Edit
              </Button>
              <Button variant="outline" className="h-11 px-4 rounded-xl border-2">
                <Trash2 size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
