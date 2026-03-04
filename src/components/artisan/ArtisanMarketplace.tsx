import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Search, ShoppingCart, Package, Check, ArrowRight, X, SlidersHorizontal, Eye, Star } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import axios from 'axios';

export default function ArtisanMarketplace() {
  const [view, setView] = useState<'products' | 'cart' | 'confirmation' | 'detail'>('products');
  const [cart, setCart] = useState<any[]>([]);
  const[products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // States des Filtres
  const [selectedCategory, setSelectedCategory] = useState('all');
  const[priceRange, setPriceRange] = useState([0, 1000]);
  const[maxPrice, setMaxPrice] = useState(1000);
  const [selectedManufacturer, setSelectedManufacturer] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(false);

  // States pour les Notifications & Avis
  const [toastMessage, setToastMessage] = useState('');
  const [ratingHover, setRatingHover] = useState(0);
  const [userRating, setUserRating] = useState(0);

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

      const response = await axios.get(`${API_URL}/products/marketplace`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data;
      setProducts(data);

      // Calcul du prix maximum pour ajuster le slider dynamiquement
      if (data.length > 0) {
        const highestPrice = Math.max(...data.map((p: any) => p.price));
        setMaxPrice(Math.ceil(highestPrice));
        setPriceRange([0, Math.ceil(highestPrice)]);
      }
    } catch (error) {
      console.error("Erreur de chargement de la marketplace:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'products') fetchProducts();
  }, [view, API_URL]);

  // --- NOTIFICATION SYSTÈME ---
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // --- SOUMETTRE UN AVIS (ÉTOILES) ---
  const submitRating = async (ratingValue: number) => {
    try {
      const token = getToken();
      await axios.post(`${API_URL}/products/${selectedProduct._id}/reviews`, 
        { rating: ratingValue }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast('Merci pour votre vote ! ⭐');
      setUserRating(ratingValue);
      // Mettre à jour localement pour l'affichage
      setSelectedProduct({
        ...selectedProduct, 
        rating: ((selectedProduct.rating * selectedProduct.numReviews) + ratingValue) / (selectedProduct.numReviews + 1),
        numReviews: selectedProduct.numReviews + 1
      });
    } catch (error: any) {
      if (error.response?.status === 400) {
        showToast('Vous avez déjà noté ce produit !');
      } else {
        showToast('Erreur lors du vote.');
      }
    }
  };

  // --- LOGIQUE PANIER ---
  const addToCart = (product: any) => {
    const existing = cart.find(item => item._id === product._id);
    if (existing) {
      setCart(cart.map(item => item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    showToast(`${product.name} ajouté au panier ! 🛒`);
  };

  const removeFromCart = (productId: string) => setCart(cart.filter(item => item._id !== productId));
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) removeFromCart(productId);
    else setCart(cart.map(item => item._id === productId ? { ...item, quantity } : item));
  };
  const getTotalPrice = () => cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  // --- FILTRES DYNAMIQUES ---
  const getManufacturerName = (p: any) => p.manufacturer?.companyName || p.manufacturer?.firstName || 'Unknown';
  const categories =['all', ...Array.from(new Set(products.map(p => p.category)))];
  const manufacturers =['all', ...Array.from(new Set(products.map(p => getManufacturerName(p))))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || product.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    const matchesManufacturer = selectedManufacturer === 'all' || getManufacturerName(product) === selectedManufacturer;
    const matchesAvailability = !availableOnly || product.stock > 0;
    return matchesSearch && matchesCategory && matchesPrice && matchesManufacturer && matchesAvailability;
  });


  // ==========================================
  // VUE : DÉTAIL DU PRODUIT & ÉTOILES
  // ==========================================
  if (view === 'detail' && selectedProduct) {
    return (
      <div className="space-y-6 relative">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-24 right-8 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-in slide-in-from-top-5">
            <Check size={20} className="text-green-400"/> {toastMessage}
          </div>
        )}

        <Button variant="outline" onClick={() => setView('products')} className="rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Products
        </Button>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <div className="aspect-video rounded-xl overflow-hidden mb-4 bg-gray-100">
              <ImageWithFallback src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
              <Badge className="mb-4 bg-primary/10 text-primary border-0 px-3 py-1 uppercase tracking-wider text-xs">
                {selectedProduct.category}
              </Badge>
              <h1 className="text-3xl font-bold text-foreground mb-3">{selectedProduct.name}</h1>
              <p className="text-lg text-muted-foreground mb-4 flex items-center gap-2">
                <Package size={18}/> {getManufacturerName(selectedProduct)}
              </p>
              
              {/* Dynamic Rating Display & Input */}
              <div className="flex flex-col gap-2 mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-foreground">{selectedProduct.rating.toFixed(1)}</span>
                  <div className="flex text-secondary">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={20} fill={star <= selectedProduct.rating ? "currentColor" : "none"} className="text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-muted-foreground">({selectedProduct.numReviews} reviews)</span>
                </div>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200">
                  <span className="text-sm text-muted-foreground mr-2">Rate this product:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} size={24} 
                      className={`cursor-pointer transition-colors ${star <= (ratingHover || userRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                      onMouseEnter={() => setRatingHover(star)}
                      onMouseLeave={() => setRatingHover(0)}
                      onClick={() => submitRating(star)}
                    />
                  ))}
                </div>
              </div>

              <p className="text-muted-foreground mb-6 leading-relaxed">{selectedProduct.description || 'No description available for this product.'}</p>

              <div className="flex items-center justify-between p-4 rounded-xl border-2 border-primary/10 mb-6">
                <span className="text-lg font-medium text-muted-foreground">Price:</span>
                <span className="text-3xl font-bold text-primary">{selectedProduct.price.toLocaleString()} TND</span>
              </div>

              <div className="flex items-center justify-between mb-6">
                <span className="text-muted-foreground">Stock Availability:</span>
                <span className={`font-semibold px-3 py-1 rounded-full ${selectedProduct.stock > 10 ? 'bg-green-100 text-green-700' : selectedProduct.stock > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  {selectedProduct.stock > 0 ? `${selectedProduct.stock} units available` : 'Out of stock'}
                </span>
              </div>

              <Button
                disabled={selectedProduct.stock === 0}
                className="w-full h-14 text-lg text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-lg disabled:opacity-50"
                onClick={() => addToCart(selectedProduct)}
              >
                <ShoppingCart size={20} className="mr-2" /> Add to Cart
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VUE : PANIER & CONFIRMATION (Maintenues identiques avec IDs corrigés)
  // ==========================================
  if (view === 'confirmation') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-12 text-center bg-white rounded-2xl border-0 shadow-lg">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-accent/10 mb-6">
            <Check size={48} className="text-accent" />
          </div>
          <h2 className="text-4xl font-bold text-foreground mb-4">Order Placed Successfully!</h2>
          <p className="text-xl text-muted-foreground mb-3">Your order has been confirmed and will be processed soon.</p>
          <p className="text-lg text-muted-foreground mb-8">Order ID: <strong className="text-foreground">#{Math.floor(Math.random() * 10000)}</strong></p>
          <Button onClick={() => { setView('products'); setCart([]); }} className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
            Continue Shopping
          </Button>
        </Card>
      </div>
    );
  }

  if (view === 'cart') {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setView('products')} className="rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" /> Continue Shopping
        </Button>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
              <h2 className="text-3xl font-bold text-foreground mb-6">Shopping Cart ({cart.length})</h2>
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart size={64} className="mx-auto mb-4 text-muted-foreground" />
                  <p className="text-xl text-muted-foreground">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item._id} className="flex items-center gap-4 p-6 rounded-2xl border-2 border-gray-100 hover:border-primary/20 transition-all">
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-foreground text-lg">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">{getManufacturerName(item)}</p>
                        <p className="text-sm font-semibold text-primary">{item.price} TND / unit</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button size="sm" variant="outline" onClick={() => updateQuantity(item._id, item.quantity - 1)} className="w-10 h-10 rounded-xl border-2">-</Button>
                        <span className="w-12 text-center font-bold text-lg">{item.quantity}</span>
                        <Button size="sm" variant="outline" onClick={() => updateQuantity(item._id, item.quantity + 1)} className="w-10 h-10 rounded-xl border-2">+</Button>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-foreground">{(item.price * item.quantity).toFixed(2)} TND</p>
                        <Button size="sm" variant="ghost" onClick={() => removeFromCart(item._id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 mt-2">Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <div>
            <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg sticky top-8">
              <h3 className="text-xl font-bold text-foreground mb-6">Order Summary</h3>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-semibold text-foreground">{getTotalPrice().toFixed(2)} TND</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span className="font-semibold text-foreground">15.00 TND</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tax (19%)</span><span className="font-semibold text-foreground">{(getTotalPrice() * 0.19).toFixed(2)} TND</span></div>
                <div className="pt-4 border-t-2 border-gray-100">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary">{(getTotalPrice() + 15 + (getTotalPrice() * 0.19)).toFixed(2)} TND</span>
                  </div>
                </div>
              </div>
              <Button className="w-full h-12 text-white bg-accent hover:bg-accent/90 rounded-xl shadow-lg" onClick={() => setView('confirmation')} disabled={cart.length === 0}>
                Proceed to Checkout
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VUE : MARKETPLACE PRINCIPALE
  // ==========================================
  return (
    <div className="space-y-8 relative">
      {toastMessage && (
        <div className="fixed top-24 right-8 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-in slide-in-from-top-5">
          <Check size={20} className="text-green-400"/> {toastMessage}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Marketplace</h1>
          <p className="text-lg text-muted-foreground">Browse and order construction materials</p>
        </div>
        <Button onClick={() => setView('cart')} variant="outline" className="h-12 px-6 rounded-xl border-2 relative hover:border-primary hover:text-primary transition-colors bg-white shadow-sm">
          <ShoppingCart size={20} className="mr-2" /> Cart {cart.length > 0 && `(${cart.length})`}
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-destructive flex items-center justify-center text-xs text-white font-bold shadow-lg animate-bounce">
              {cart.length}
            </span>
          )}
        </Button>
      </div>

      <Card className="p-4 md:p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input placeholder="Search materials or tools..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary bg-gray-50/50" />
          </div>
          <Button variant={showFilters ? "default" : "outline"} className={`h-12 px-6 rounded-xl border-2 transition-all ${showFilters ? 'bg-primary text-white shadow-md' : 'hover:bg-gray-50'}`} onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={20} className="mr-2" /> Filters
          </Button>
        </div>
      </Card>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Filtres Améliorée */}
        {showFilters && (
          <div className="lg:w-80 flex-shrink-0 animate-in slide-in-from-left-4 fade-in">
            <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg sticky top-8 border-t-4 border-t-primary">
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <SlidersHorizontal size={20} className="text-primary"/> Filters
                </h3>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory('all'); setPriceRange([0, maxPrice]); setSelectedManufacturer('all'); setAvailableOnly(false); }} className="text-muted-foreground hover:text-primary">
                  Clear All
                </Button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Category</Label>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full h-11 px-4 rounded-xl border-2 border-gray-100 bg-gray-50 focus:border-primary focus:bg-white transition-colors outline-none cursor-pointer">
                    {categories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>)}
                  </select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold text-gray-700 uppercase tracking-wider flex justify-between">
                    <span>Price Range</span>
                    <span className="text-primary">{priceRange[0]} - {priceRange[1]} TND</span>
                  </Label>
                  <input type="range" min="0" max={maxPrice} value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])} className="w-full accent-primary" />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Manufacturer</Label>
                  <select value={selectedManufacturer} onChange={(e) => setSelectedManufacturer(e.target.value)} className="w-full h-11 px-4 rounded-xl border-2 border-gray-100 bg-gray-50 focus:border-primary focus:bg-white transition-colors outline-none cursor-pointer">
                    {manufacturers.map(mfr => <option key={mfr} value={mfr}>{mfr === 'all' ? 'All Manufacturers' : mfr}</option>)}
                  </select>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${availableOnly ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-primary'}`}>
                      {availableOnly && <Check size={14} className="text-white" />}
                    </div>
                    <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} className="hidden" />
                    <span className="text-sm font-semibold text-gray-700 select-none">In Stock Only</span>
                  </label>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Grille Produits */}
        <div className="flex-1">
          {isLoading ? (
            <div className="text-center py-20 text-muted-foreground">Loading marketplace...</div>
          ) : filteredProducts.length === 0 ? (
            <Card className="p-16 text-center bg-white rounded-2xl border-0 shadow-lg">
              <Package size={64} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-bold text-foreground mb-2">No Products Found</h3>
              <p className="text-muted-foreground">Try adjusting your filters to find what you need.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <Card key={product._id} className="group bg-white rounded-2xl border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col">
                  <div className="aspect-video relative overflow-hidden bg-gray-100">
                    <ImageWithFallback src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <Badge className="absolute top-3 right-3 bg-white/90 text-primary border-0 px-3 py-1 backdrop-blur-sm font-bold shadow-sm">
                      {product.category}
                    </Badge>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="mb-auto">
                      <h3 className="font-bold text-foreground text-lg mb-1 line-clamp-2" title={product.name}>{product.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><Package size={14}/> {getManufacturerName(product)}</p>
                    </div>

                    <div className="flex items-center gap-1 mt-4 mb-4">
                      <Star size={16} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-bold text-foreground">{product.rating.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground ml-1">({product.numReviews})</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 mb-4">
                      <span className="text-2xl font-bold text-primary">{product.price.toLocaleString()} <span className="text-sm">TND</span></span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${product.stock > 10 ? 'bg-green-100 text-green-700' : product.stock > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <Button variant="outline" className="h-11 rounded-xl border-2 hover:bg-gray-50 hover:text-primary transition-colors" onClick={() => { setSelectedProduct(product); setView('detail'); }}>
                        <Eye size={16} className="mr-1" /> View
                      </Button>
                      <Button disabled={product.stock === 0} className="h-11 text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-md transition-colors" onClick={() => addToCart(product)}>
                        <ShoppingCart size={16} className="mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}