import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Search, Package, Edit, Trash2, Upload, ArrowRight, Eye, CheckCircle, HardHat, FileText, FileDown, Tag, Layers } from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';

export default function ManufacturerProducts() {
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'detail'>('list');
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  // États pour les deux fichiers
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Image
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);   // Fiche Technique PDF
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Maçonnerie',
    price: '',
    stock: '',
    description: ''
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const SERVER_URL = 'http://localhost:5000'; 

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);

  const getImageUrl = (path: string) => {
    if (!path) return null;
    const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
    return cleanPath.startsWith('http') ? cleanPath : `${SERVER_URL}/${cleanPath}`;
  };

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
    if (view === 'list') fetchProducts();
  }, [view]);

  const confirmDelete = (product: any) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      const token = getToken();
      await axios.delete(`${API_URL}/products/${productToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(products.filter(p => p._id !== productToDelete._id));
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleEditClick = (product: any) => {
    setSelectedProductId(product._id);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      stock: product.stock.toString(),
      description: product.description || ''
    });
    setSelectedFile(null);
    setSelectedPdf(null);
    setView('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = getToken();
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => data.append(key, value));
      
      if (selectedFile) data.append('document', selectedFile); // Image
      if (selectedPdf) data.append('techSheet', selectedPdf);  // PDF TECHNIQUE

      const config = {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      };

      if (view === 'add') {
        await axios.post(`${API_URL}/products`, data, config);
      } else if (view === 'edit' && selectedProductId) {
        await axios.put(`${API_URL}/products/${selectedProductId}`, data, config);
      }
      
      setSelectedFile(null);
      setSelectedPdf(null);
      setView('list');
    } catch (error) {
      alert('Error saving product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // NOUVEAU : Fonction sécurisée pour les couleurs de statut
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'low-stock': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'out-of-stock': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-emerald-100 text-emerald-700 border-emerald-200'; // Par défaut
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const inputBorderClass = "border-slate-300 focus:border-primary focus:ring-primary";

  // --- VUE FORMULAIRE (ADD / EDIT) ---
  if (view === 'add' || view === 'edit') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setView('list')} className="mb-6 rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" /> Back
        </Button>
        <Card className="p-10 bg-white rounded-2xl shadow-lg border">
          <HardHat size={40} className="text-primary mb-5"/>
          <h2 className="text-3xl font-bold mb-8 text-slate-950">{view === 'add' ? 'Add New Material' : 'Edit Material'}</h2>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label className="font-semibold text-slate-800">Product Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className={`h-12 rounded-xl border-2 ${inputBorderClass}`} placeholder="e.g. Ciment Portland CPJ-45" />
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-semibold text-slate-800">Category</Label>
                <select 
                  value={formData.category} 
                  onChange={(e) => setFormData({...formData, category: e.target.value})} 
                  className={`w-full h-12 px-4 border-2 rounded-xl bg-white ${inputBorderClass} outline-none`}
                >
                  <optgroup label="🏗️ Gros Œuvre">
                    <option value="Maçonnerie">Maçonnerie</option>
                    <option value="Béton & Ciment">Béton & Ciment</option>
                    <option value="Ferraillage">Ferraillage</option>
                  </optgroup>
                  <optgroup label="🏠 Second Œuvre">
                    <option value="Électricité">Électricité</option>
                    <option value="Plomberie">Plomberie</option>
                    <option value="Menuiserie">Menuiserie</option>
                  </optgroup>
                  <optgroup label="🛠️ Autre">
                    <option value="Outillage">Outillage</option>
                    <option value="EPI">EPI (Sécurité)</option>
                  </optgroup>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-slate-800">Price (TND)</Label>
                <Input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required className={`h-12 rounded-xl border-2 ${inputBorderClass}`} placeholder="0.000"/>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-800">Stock (Units)</Label>
              <Input type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} required className={`h-12 rounded-xl border-2 ${inputBorderClass}`} placeholder="e.g. 500"/>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="font-semibold text-slate-800">Image (JPG, PNG)</Label>
                    <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-6 h-32 flex flex-col items-center justify-center cursor-pointer transition-colors ${selectedFile ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-primary hover:bg-slate-50'}`}>
                        {selectedFile ? <><CheckCircle size={32} className="text-green-500 mb-2" /><p className="text-xs text-green-700 font-medium truncate max-w-full">{selectedFile.name}</p></> : <><Upload size={32} className="text-slate-400 mb-2" /><p className="text-sm text-slate-600">Click to upload photo</p></>}
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="font-semibold text-slate-800">Technical Sheet (PDF)</Label>
                    <div onClick={() => pdfInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-6 h-32 flex flex-col items-center justify-center cursor-pointer transition-colors ${selectedPdf ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
                        {selectedPdf ? <><FileText size={32} className="text-blue-500 mb-2" /><p className="text-xs text-blue-700 font-medium truncate max-w-full">{selectedPdf.name}</p></> : <><FileDown size={32} className="text-slate-400 mb-2" /><p className="text-sm text-slate-600">Click to attach PDF</p></>}
                        <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files && setSelectedPdf(e.target.files[0])} />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-800">Description / Technical Details</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={4} className={`rounded-xl border-2 ${inputBorderClass}`} placeholder="Enter product specifications, dimensions, usage instructions..."/>
            </div>

            <div className="flex gap-4 pt-6 border-t border-slate-100">
              <Button type="submit" disabled={isSubmitting} className="h-12 px-10 bg-primary text-white rounded-xl shadow-md hover:bg-primary/90 transition-all text-base font-semibold">
                {isSubmitting ? 'Publishing...' : 'Publish Material'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setView('list')} className="h-12 px-10 rounded-xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 text-base font-semibold">Cancel</Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // --- VUE DÉTAILS ---
  if (view === 'detail') {
    const product = products.find(p => p._id === selectedProductId);
    if (!product) return null;
    const imgUrl = getImageUrl(product.documentUrl);
    const pdfUrl = product.techSheetUrl ? `${SERVER_URL}/${product.techSheetUrl.replace(/\\/g, '/')}` : null;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2 border-slate-200"><ArrowRight size={20} className="mr-2 rotate-180 text-slate-500" /> Back to Inventory</Button>
        <Card className="p-8 bg-white rounded-2xl shadow-lg border border-slate-100">
          <div className="flex flex-col md:flex-row gap-10">
            <div className="w-full md:w-2/5 aspect-square bg-slate-50 rounded-3xl flex items-center justify-center overflow-hidden border-2 border-slate-100 shadow-inner">
              {imgUrl ? <img src={imgUrl} className="w-full h-full object-cover" alt={product.name} /> : <Package size={80} className="text-slate-200" />}
            </div>
            <div className="flex-1 space-y-6">
              <div className='flex justify-between items-center'>
                {/* NOUVEAU BADGE DÉTAILS COHÉRENT */}
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(product.status)}`}>
                  <span className="w-2 h-2 rounded-full bg-current"></span>
                  {product.status || 'active'}
                </span>
                <p className="text-sm text-slate-400 font-mono">Ref: {product._id.slice(-6).toUpperCase()}</p>
              </div>
              <h2 className="text-4xl font-extrabold text-slate-950 tracking-tight">{product.name}</h2>
              <p className="inline-flex items-center text-primary font-semibold px-4 py-1.5 bg-primary/5 rounded-full text-sm border border-primary/10">
                <Tag size={16} className="mr-2" /> {product.category}
              </p>
              
              <div className="grid grid-cols-2 gap-5 pt-4">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Unit Price</p>
                  <p className="text-3xl font-black text-primary">{Number(product.price).toFixed(3)} TND</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Current Stock</p>
                  <p className="text-3xl font-black text-slate-950">{product.stock} <span className='text-xl font-bold text-slate-600'>Units</span></p>
                </div>
              </div>
              
              {pdfUrl && (
                <Button 
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow font-semibold"
                    onClick={() => window.open(pdfUrl, '_blank')}
                >
                    <FileText size={20} className="mr-2.5" /> View Technical Specifications (PDF)
                </Button>
              )}

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 mt-6 shadow-inner">
                <p className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider flex items-center"><Layers size={16} className='mr-2 text-primary'/> Technical Details & Description</p>
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">{product.description || 'No detailed description provided for this material.'}</p>
              </div>
              
              <div className="flex gap-3 pt-6 border-t border-slate-100">
                <Button onClick={() => handleEditClick(product)} className="flex-1 h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-semibold"><Edit size={18} className="mr-2" /> Edit Material</Button>
                <Button onClick={() => confirmDelete(product)} variant="outline" className="h-12 px-5 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"><Trash2 size={18} /></Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // --- VUE LISTE (NOUVEAU DESIGN) ---
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-950 tracking-tight">Material Inventory</h1>
          <p className="text-lg text-slate-600 mt-1">Manage and track your construction materials stock</p>
        </div>
        <Button onClick={() => { setFormData({name:'', category:'Maçonnerie', price:'', stock:'', description:''}); setView('add'); setSelectedFile(null); setSelectedPdf(null); }} className="bg-primary text-white rounded-xl h-12 px-6 shadow-lg hover:bg-primary/90 transition-all font-semibold whitespace-nowrap">
          <Plus size={20} className="mr-2" /> Add New Material
        </Button>
      </div>
      
      <Card className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search materials by name, category or reference..." className="pl-12 h-12 rounded-xl border-slate-200 focus:border-primary focus:ring-primary text-base" />
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-20 text-slate-500 flex flex-col items-center gap-3">
            <Package size={40} className='animate-pulse text-slate-300'/>
            Loading inventory...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 flex flex-col items-center gap-4">
            <Package size={50} className='text-slate-300'/>
            <div>
                <h3 className='text-xl font-bold text-slate-800'>No materials found</h3>
                <p className='text-slate-600 mt-1'>{searchQuery ? 'Try adjusting your search query.' : 'Start by adding your first material to the inventory.'}</p>
            </div>
            {!searchQuery && <Button onClick={() => setView('add')} className="bg-primary text-white rounded-lg mt-2"><Plus size={18} className='mr-1.5'/> Add First Material</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product._id} className="p-5 bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 group flex flex-col h-full relative">
              
              {/* HEADER : Image + Badge Statut */}
              <div className="flex justify-between items-start mb-4">
                <div className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100 shadow-inner flex-shrink-0">
                  {product.documentUrl ? (
                    <img src={getImageUrl(product.documentUrl)!} className="w-full h-full object-cover" alt={product.name} />
                  ) : (
                    <Package size={28} className="text-slate-300" />
                  )}
                </div>
                
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(product.status)}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  {product.status || 'active'}
                </span>
              </div>

              {/* TITRE ET CATÉGORIE (Alignés à gauche) */}
              <div className="mb-5 flex-1">
                <h3 className="font-bold text-lg text-slate-900 leading-tight mb-1 line-clamp-2 group-hover:text-primary transition-colors" title={product.name}>
                  {product.name}
                </h3>
                <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                  <Tag size={14} className="text-primary" />
                  {product.category}
                </p>
              </div>
              
              {/* PRIX ET STOCK (Design unifié) */}
              <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Price</span>
                  <span className="font-black text-lg text-primary leading-none">
                    {Number(product.price).toFixed(3)} <span className="text-xs font-semibold">TND</span>
                  </span>
                </div>
                <div className="flex flex-col border-l border-slate-200 pl-3">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Stock</span>
                  <span className={`font-black text-lg leading-none ${product.stock > 10 ? 'text-slate-800' : product.stock > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {product.stock} <span className="text-xs font-semibold text-slate-500">units</span>
                  </span>
                </div>
              </div>
              
              {/* BOUTONS D'ACTION */}
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <Button 
                  onClick={() => { setSelectedProductId(product._id); setView('detail'); }} 
                  className="flex-1 rounded-lg h-10 !bg-emerald-600 hover:!bg-emerald-700 text-white font-medium text-sm transition-colors"
                >
                  View Details
                </Button>
                <Button 
                  onClick={() => handleEditClick(product)} 
                  variant="outline" 
                  className="rounded-lg h-10 w-10 p-0 border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <Edit size={16} />
                </Button>
                <Button 
                  onClick={() => confirmDelete(product)} 
                  variant="outline" 
                  className="rounded-lg h-10 w-10 p-0 border-slate-200 text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            style={{ backgroundColor: '#fff', borderRadius: 20, padding: 32, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={28} style={{ color: '#ef4444' }} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', textAlign: 'center', margin: '0 0 8px' }}>Delete Product</h3>
            <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: '#1f2937' }}>{productToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '2px solid #e5e7eb', backgroundColor: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', backgroundColor: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}