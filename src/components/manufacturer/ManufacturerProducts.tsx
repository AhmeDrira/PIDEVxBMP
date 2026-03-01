import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Search, Package, Edit, Trash2, Upload, ArrowRight, Eye, Tag, Layers, FileText } from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';

export default function ManufacturerProducts() {
  const[view, setView] = useState<'list' | 'add' | 'edit' | 'detail'>('list');
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const[isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  const[formData, setFormData] = useState({
    name: '',
    category: 'Building Materials',
    price: '',
    stock: '',
    description: ''
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  // --- CHARGEMENT DES PRODUITS ---
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      const response = await axios.get(`${API_URL}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data);
    } catch (error) {
      console.error("Erreur chargement produits:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'list') {
      fetchProducts();
    }
  }, [view, API_URL]);

  // --- CRÉATION & MISE À JOUR ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = getToken();
      
      if (view === 'add') {
        await axios.post(`${API_URL}/products`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Product added successfully!');
      } else if (view === 'edit' && selectedProductId) {
        await axios.put(`${API_URL}/products/${selectedProductId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Product updated successfully!');
      }
      
      setView('list');
    } catch (error) {
      console.error("Erreur sauvegarde produit:", error);
      alert('Error saving product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetails = (product: any) => {
    setSelectedProductId(product._id);
    setView('detail');
  };

  // --- SUPPRESSION ---
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    
    try {
      const token = getToken();
      await axios.delete(`${API_URL}/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Met à jour la liste localement sans recharger la page
      setProducts(products.filter(p => p._id !== id));
    } catch (error) {
      console.error("Erreur suppression:", error);
      alert("Failed to delete product.");
    }
  };

  // --- OUVRIR LE FORMULAIRE D'ÉDITION ---
  const handleEditClick = (product: any) => {
    setSelectedProductId(product._id);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      description: product.description || ''
    });
    setView('edit');
  };

  const handleAddNewClick = () => {
    setFormData({ name: '', category: 'Building Materials', price: '', stock: '', description: '' });
    setView('add');
  };

  // --- DESIGN DU STATUT ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-accent/10 text-accent border-accent/20';
      case 'low-stock': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'out-of-stock': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ==========================================
  // VUE 1 : AJOUTER / MODIFIER UN PRODUIT
  // ==========================================
  if (view === 'add' || view === 'edit') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setView('list')} className="mb-6 rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Products
        </Button>
        <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">
            {view === 'add' ? 'Add New Product' : 'Edit Product'}
          </h2>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Product Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Enter product name" className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary" required />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Category</Label>
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none bg-white" required>
                  <option value="Building Materials">Building Materials</option>
                  <option value="Construction Steel">Construction Steel</option>
                  <option value="Finishing Materials">Finishing Materials</option>
                  <option value="Tools & Equipment">Tools & Equipment</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">Price (TND)</Label>
                <Input value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} type="number" step="0.01" placeholder="0.00" className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Stock Quantity</Label>
              <Input value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} type="number" placeholder="0" className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary" required />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Product description..." rows={4} className="rounded-xl border-2 border-gray-200 focus:border-primary" />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Technical Document (Optional)</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-primary transition-colors bg-gray-50 cursor-pointer">
                <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-gray-500 mb-2">Click to upload document</p>
                <Input type="file" accept=".pdf,.doc,.docx" className="hidden" />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting} className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
                {isSubmitting ? 'Saving...' : (view === 'add' ? 'Publish Product' : 'Save Changes')}
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

  // ==========================================
  // VUE 1.5 : DÉTAILS DU PRODUIT
  // ==========================================
  if (view === 'detail') {
    const product = products.find(p => p._id === selectedProductId);
    
    if (!product) {
      return <div className="text-center py-10">Product not found.</div>;
    }

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Products
          </Button>
          <Button onClick={() => handleEditClick(product)} className="rounded-xl bg-primary text-white hover:bg-primary/90">
            <Edit size={18} className="mr-2" /> Edit Product
          </Button>
        </div>

        <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            
            {/* Icône / Image Produit (Placeholder) */}
            <div className="w-full md:w-1/3 aspect-square bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
              <Package size={64} className="mb-4 text-primary/40" />
              <p className="text-sm font-medium">Product Image</p>
            </div>

            {/* Informations Principales */}
            <div className="w-full md:w-2/3 space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={`${getStatusColor(product.status)} px-3 py-1 text-xs font-semibold border-2 uppercase`}>
                    {product.status.replace('-', ' ')}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Layers size={14} /> {product.category}
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-2">{product.name}</h2>
                <p className="text-gray-500 text-sm">Product ID: {product._id}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-sm text-muted-foreground font-medium mb-1 flex items-center gap-2">
                    <Tag size={16} /> Price
                  </p>
                  <p className="text-2xl font-bold text-primary">{product.price} TND</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-sm text-muted-foreground font-medium mb-1 flex items-center gap-2">
                    <Package size={16} /> Stock Available
                  </p>
                  <p className={`text-2xl font-bold ${product.stock <= 10 ? 'text-red-500' : 'text-foreground'}`}>
                    {product.stock} Units
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground font-semibold mb-2 flex items-center gap-2">
                  <FileText size={16} /> Description
                </p>
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 text-foreground leading-relaxed whitespace-pre-wrap min-h-[100px]">
                  {product.description || 'No description provided for this product.'}
                </div>
              </div>

            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ==========================================
  // VUE 2 : LISTE PRINCIPALE
  // ==========================================
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">My Products</h1>
          <p className="text-lg text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button onClick={handleAddNewClick} className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
          <Plus size={20} className="mr-2" /> Add Product
        </Button>
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products..." className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary" />
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading products...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-gray-100">
          <Package className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-xl font-semibold text-gray-500 mb-2">No products found</p>
          <p className="text-gray-400">Click "Add Product" to start building your catalog.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product._id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shadow-md">
                  <Package size={28} className="text-primary" />
                </div>
                <Badge className={`${getStatusColor(product.status)} px-3 py-1 text-xs font-semibold border-2 uppercase`}>
                  {product.status.replace('-', ' ')}
                </Badge>
              </div>
              <h3 className="font-bold text-foreground text-lg mb-2 truncate" title={product.name}>{product.name}</h3>
              <p className="text-sm text-muted-foreground mb-6">{product.category}</p>
              
              <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-gray-50">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Price</p>
                  <p className="text-2xl font-bold text-primary">{product.price} TND</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Stock</p>
                  <p className={`text-2xl font-bold ${product.stock <= 10 ? 'text-red-500' : 'text-foreground'}`}>
                    {product.stock}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={() => handleViewDetails(product)} variant="outline" className="flex-1 h-11 rounded-xl border-2 hover:bg-gray-100">
                  <Eye size={16} className="mr-2" /> View
                </Button>
                <Button onClick={() => handleEditClick(product)} variant="outline" className="h-11 px-4 rounded-xl border-2 hover:bg-primary hover:text-white">
                  <Edit size={16} />
                </Button>
                <Button onClick={() => handleDelete(product._id)} variant="outline" className="h-11 px-4 rounded-xl border-2 hover:bg-red-500 hover:text-white hover:border-red-500">
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}