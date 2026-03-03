import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Search, ShoppingCart, Package, Check, ArrowRight, X, SlidersHorizontal, Eye } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

export default function ArtisanMarketplace() {
  const [view, setView] = useState<'products' | 'cart' | 'confirmation' | 'detail'>('products');
  const [cart, setCart] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [selectedManufacturer, setSelectedManufacturer] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(false);

  const products = [
    {
      id: 1,
      name: 'Premium Cement - 50kg',
      category: 'Building Materials',
      price: 45,
      manufacturer: 'BuildMaster Ltd',
      stock: 150,
      image: 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=400&h=300&fit=crop',
      rating: 4.5,
      description: 'High-quality cement suitable for all construction needs. Premium grade with excellent binding properties.'
    },
    {
      id: 2,
      name: 'Steel Rebar 12mm',
      category: 'Construction Steel',
      price: 120,
      manufacturer: 'MetalWorks Inc',
      stock: 80,
      image: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=400&h=300&fit=crop',
      rating: 4.8,
      description: 'Durable steel rebar for reinforced concrete construction. Meets all international quality standards.'
    },
    {
      id: 3,
      name: 'Ceramic Floor Tiles',
      category: 'Finishing Materials',
      price: 35,
      manufacturer: 'TilePro',
      stock: 200,
      image: 'https://images.unsplash.com/photo-1615875474908-f403087c0052?w=400&h=300&fit=crop',
      rating: 4.6,
      description: 'Beautiful ceramic tiles perfect for residential and commercial flooring applications.'
    },
    {
      id: 4,
      name: 'Paint - White 20L',
      category: 'Finishing Materials',
      price: 85,
      manufacturer: 'ColorMaster',
      stock: 60,
      image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&h=300&fit=crop',
      rating: 4.7,
      description: 'Premium quality white paint with excellent coverage and durability. Easy to apply.'
    },
    {
      id: 5,
      name: 'Electrical Wire 2.5mm',
      category: 'Electrical',
      price: 95,
      manufacturer: 'ElectroSupply',
      stock: 120,
      image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=300&fit=crop',
      rating: 4.9,
      description: 'High-grade electrical wire suitable for residential and commercial installations.'
    },
    {
      id: 6,
      name: 'Plumbing Pipes Set',
      category: 'Plumbing',
      price: 180,
      manufacturer: 'PipePro',
      stock: 45,
      image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=400&h=300&fit=crop',
      rating: 4.4,
      description: 'Complete plumbing pipes set with all necessary fittings and connectors.'
    },
    {
      id: 7,
      name: 'Wooden Door Frame',
      category: 'Carpentry',
      price: 250,
      manufacturer: 'WoodCraft',
      stock: 30,
      image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=400&h=300&fit=crop',
      rating: 4.8,
      description: 'Premium wooden door frame made from high-quality hardwood. Pre-treated and ready to install.'
    },
    {
      id: 8,
      name: 'Insulation Material',
      category: 'Insulation',
      price: 65,
      manufacturer: 'ThermoGuard',
      stock: 90,
      image: 'https://images.unsplash.com/photo-1581094271901-8022df4466f9?w=400&h=300&fit=crop',
      rating: 4.3,
      description: 'Energy-efficient insulation material for walls, roofs, and floors. Fire-resistant.'
    },
  ];

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
  const manufacturers = ['all', ...Array.from(new Set(products.map(p => p.manufacturer)))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    const matchesManufacturer = selectedManufacturer === 'all' || product.manufacturer === selectedManufacturer;
    const matchesAvailability = !availableOnly || product.stock > 0;
    
    return matchesSearch && matchesCategory && matchesPrice && matchesManufacturer && matchesAvailability;
  });

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const viewProductDetail = (product: any) => {
    setSelectedProduct(product);
    setView('detail');
  };

  // Product Detail View
  if (view === 'detail' && selectedProduct) {
    return (
      <div className="space-y-6">
        <Button 
          variant="outline" 
          onClick={() => setView('products')} 
          className="rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Products
        </Button>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <div className="aspect-video rounded-xl overflow-hidden mb-4">
              <ImageWithFallback
                src={selectedProduct.image}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
              />
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
              <Badge className="mb-4 bg-primary/10 text-primary border-0 px-3 py-1">
                {selectedProduct.category}
              </Badge>
              <h1 className="text-3xl font-bold text-foreground mb-3">{selectedProduct.name}</h1>
              <p className="text-lg text-muted-foreground mb-4">{selectedProduct.manufacturer}</p>
              
              <div className="flex items-center gap-2 mb-6">
                <span className="text-secondary text-2xl">★</span>
                <span className="text-xl font-semibold text-foreground">{selectedProduct.rating}</span>
                <span className="text-muted-foreground">(128 reviews)</span>
              </div>

              <p className="text-muted-foreground mb-6 leading-relaxed">{selectedProduct.description}</p>

              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 mb-6">
                <span className="text-lg font-medium text-muted-foreground">Price:</span>
                <span className="text-3xl font-bold text-primary">{selectedProduct.price} TND</span>
              </div>

              <div className="flex items-center justify-between mb-6">
                <span className="text-muted-foreground">Stock Availability:</span>
                <span className={`font-semibold ${selectedProduct.stock > 50 ? 'text-accent' : 'text-secondary'}`}>
                  {selectedProduct.stock} units available
                </span>
              </div>

              <Button
                className="w-full h-14 text-lg text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-lg"
                onClick={() => {
                  addToCart(selectedProduct);
                  setView('products');
                }}
              >
                <ShoppingCart size={20} className="mr-2" />
                Add to Cart
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'confirmation') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-12 text-center bg-white rounded-2xl border-0 shadow-lg">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-accent/10 mb-6">
            <Check size={48} className="text-accent" />
          </div>
          <h2 className="text-4xl font-bold text-foreground mb-4">Order Placed Successfully!</h2>
          <p className="text-xl text-muted-foreground mb-3">
            Your order has been confirmed and will be processed soon.
          </p>
          <p className="text-lg text-muted-foreground mb-8">
            Order ID: <strong className="text-foreground">#{Math.floor(Math.random() * 10000)}</strong>
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => {
                setView('products');
                setCart([]);
              }}
              className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
            >
              Continue Shopping
            </Button>
            <Button variant="outline" className="h-12 px-8 rounded-xl border-2">
              Track Order
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (view === 'cart') {
    return (
      <div className="space-y-6">
        <Button 
          variant="outline" 
          onClick={() => setView('products')} 
          className="rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Continue Shopping
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
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-6 rounded-2xl border-2 border-gray-100 hover:border-primary/20 transition-all"
                    >
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <ImageWithFallback
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-foreground text-lg">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">{item.manufacturer}</p>
                        <p className="text-sm font-semibold text-primary">{item.price} TND / unit</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-10 h-10 rounded-xl border-2"
                        >
                          -
                        </Button>
                        <span className="w-12 text-center font-bold text-lg">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-10 h-10 rounded-xl border-2"
                        >
                          +
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-foreground">{(item.price * item.quantity).toFixed(2)} TND</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromCart(item.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          Remove
                        </Button>
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
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">{getTotalPrice().toFixed(2)} TND</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="font-semibold text-foreground">15.00 TND</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (19%)</span>
                  <span className="font-semibold text-foreground">{(getTotalPrice() * 0.19).toFixed(2)} TND</span>
                </div>
                <div className="pt-4 border-t-2 border-gray-100">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary">
                      {(getTotalPrice() + 15 + (getTotalPrice() * 0.19)).toFixed(2)} TND
                    </span>
                  </div>
                </div>
              </div>
              <Button
                className="w-full h-12 text-white bg-accent hover:bg-accent/90 rounded-xl shadow-lg"
                onClick={() => setView('confirmation')}
                disabled={cart.length === 0}
              >
                Proceed to Checkout
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Marketplace</h1>
          <p className="text-lg text-muted-foreground">Browse and order construction materials</p>
        </div>
        <Button
          onClick={() => setView('cart')}
          variant="outline"
          className="h-12 px-6 rounded-xl border-2 relative"
        >
          <ShoppingCart size={20} className="mr-2" />
          Cart {cart.length > 0 && `(${cart.length})`}
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-destructive flex items-center justify-center text-xs text-white font-bold shadow-lg">
              {cart.length}
            </span>
          )}
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
            />
          </div>
          <Button 
            variant="outline" 
            className="h-12 px-6 rounded-xl border-2"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={20} className="mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filter Sidebar */}
        {showFilters && (
          <div className="lg:w-80 flex-shrink-0">
            <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-foreground">Filters</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCategory('all');
                    setPriceRange([0, 500]);
                    setSelectedManufacturer('all');
                    setAvailableOnly(false);
                  }}
                  className="text-primary hover:text-primary/80"
                >
                  Reset
                </Button>
              </div>

              <div className="space-y-6">
                {/* Category Filter */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-foreground">Category</Label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat === 'all' ? 'All Categories' : cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price Range Filter */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-foreground">
                    Price Range: {priceRange[0]} - {priceRange[1]} TND
                  </Label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="500"
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                      className="w-full"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={priceRange[0]}
                        onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                        className="h-10 rounded-lg"
                        placeholder="Min"
                      />
                      <Input
                        type="number"
                        value={priceRange[1]}
                        onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 500])}
                        className="h-10 rounded-lg"
                        placeholder="Max"
                      />
                    </div>
                  </div>
                </div>

                {/* Manufacturer Filter */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-foreground">Manufacturer</Label>
                  <select
                    value={selectedManufacturer}
                    onChange={(e) => setSelectedManufacturer(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none"
                  >
                    {manufacturers.map(mfr => (
                      <option key={mfr} value={mfr}>
                        {mfr === 'all' ? 'All Manufacturers' : mfr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Availability Toggle */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50">
                  <input
                    type="checkbox"
                    id="availability"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <Label htmlFor="availability" className="text-sm font-medium text-foreground cursor-pointer">
                    In Stock Only
                  </Label>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t-2 border-gray-100">
                <p className="text-sm text-muted-foreground">
                  Showing <strong className="text-foreground">{filteredProducts.length}</strong> of <strong className="text-foreground">{products.length}</strong> products
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Products Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card 
                key={product.id} 
                className="group bg-white rounded-2xl border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden"
              >
                {/* Product Image - 16:9 Ratio */}
                <div className="aspect-video relative overflow-hidden bg-gray-100">
                  <ImageWithFallback
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <Badge className="absolute top-3 right-3 bg-primary/90 text-white border-0 px-3 py-1 backdrop-blur-sm">
                    {product.category}
                  </Badge>
                </div>

                {/* Product Info */}
                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="font-bold text-foreground text-lg mb-1 line-clamp-2">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.manufacturer}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-secondary text-lg">★</span>
                    <span className="text-sm font-semibold text-foreground">{product.rating}</span>
                    <span className="text-xs text-muted-foreground ml-1">(128)</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <span className="text-sm font-medium text-muted-foreground">Price:</span>
                    <span className="text-xl font-bold text-primary">{product.price} TND</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Stock:</span>
                    <span className={`font-semibold ${product.stock > 50 ? 'text-accent' : 'text-secondary'}`}>
                      {product.stock} units
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl border-2 hover:bg-gray-50"
                      onClick={() => viewProductDetail(product)}
                    >
                      <Eye size={16} className="mr-1" />
                      View
                    </Button>
                    <Button
                      className="h-11 text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-md"
                      onClick={() => addToCart(product)}
                    >
                      <ShoppingCart size={16} className="mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <Card className="p-16 text-center bg-white rounded-2xl border-0 shadow-lg">
              <Package size={64} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-bold text-foreground mb-2">No Products Found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or search query</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
