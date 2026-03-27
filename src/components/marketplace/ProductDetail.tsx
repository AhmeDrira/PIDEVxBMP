import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, ShoppingCart, Check } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface ProductDetailProps {
  productId?: string;
  onBack?: () => void;
  onAddToCart?: (product: any) => void;
}

export default function ProductDetail({ productId, onBack, onAddToCart }: ProductDetailProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Mock product data - in real app this would come from API/props
  const product = {
    id: productId || '1',
    name: 'Premium Cement - 50kg',
    category: 'Building Materials',
    price: 45,
    manufacturer: 'BuildMaster Ltd',
    stock: 150,
    images: [
      'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1581094271901-8022df4466f9?w=800&h=600&fit=crop',
    ],
    rating: 4.5,
    reviewCount: 128,
    description: 'High-quality premium cement suitable for all types of construction work. Our cement offers excellent binding properties and durability, meeting international quality standards. Perfect for residential and commercial projects.',
    specifications: {
      'Weight': '50kg per bag',
      'Composition': 'Portland Cement',
      'Strength': '42.5 MPa',
      'Setting Time': '30-600 minutes',
      'Storage Life': '3 months',
      'Origin': 'Tunisia'
    },
    features: [
      'High compressive strength',
      'Excellent workability',
      'Quick setting time',
      'Weather resistant',
      'Cost-effective solution'
    ]
  };

  const relatedProducts = [
    {
      id: 2,
      name: 'Steel Rebar 12mm',
      price: 120,
      image: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=400&h=300&fit=crop',
      rating: 4.8
    },
    {
      id: 3,
      name: 'Ceramic Floor Tiles',
      price: 35,
      image: 'https://images.unsplash.com/photo-1615875474908-f403087c0052?w=400&h=300&fit=crop',
      rating: 4.6
    },
    {
      id: 4,
      name: 'Paint - White 20L',
      price: 85,
      image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&h=300&fit=crop',
      rating: 4.7
    },
    {
      id: 5,
      name: 'Electrical Wire 2.5mm',
      price: 95,
      image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=300&fit=crop',
      rating: 4.9
    },
  ];

  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart({ ...product, quantity });
    }
  };

  return (
    <div className="space-y-8">
      {/* Back Button */}
      {onBack && (
        <Button 
          variant="outline" 
          onClick={onBack} 
          className="rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Products
        </Button>
      )}

      {/* Main Product Section */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          <Card className="p-0 bg-white rounded-2xl border-0 shadow-lg overflow-hidden">
            <div className="aspect-video bg-gray-100">
              <ImageWithFallback
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          </Card>
          
          {/* Thumbnail Gallery */}
          <div className="grid grid-cols-4 gap-3">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(idx)}
                aria-label={`Select product image ${idx + 1}`}
                className={`aspect-video rounded-xl overflow-hidden border-2 transition-all ${
                  selectedImage === idx ? 'border-primary shadow-md' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <ImageWithFallback
                  src={img}
                  alt={`${product.name} view ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <Badge className="mb-4 bg-primary/10 text-primary border-0 px-3 py-1 text-sm">
              {product.category}
            </Badge>
            
            <h1 className="text-3xl font-bold text-foreground mb-3">{product.name}</h1>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-secondary text-2xl">★</span>
                <span className="text-xl font-semibold text-foreground">{product.rating}</span>
              </div>
              <span className="text-muted-foreground">({product.reviewCount} reviews)</span>
            </div>

            <p className="text-lg text-muted-foreground mb-4">{product.manufacturer}</p>

            <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 mb-6">
              <span className="text-lg font-medium text-muted-foreground">Price:</span>
              <span className="text-4xl font-bold text-primary">{product.price} TND</span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 mb-6">
              <span className="text-base font-medium text-muted-foreground">Stock Availability:</span>
              <div className="flex items-center gap-2">
                {product.stock > 0 ? (
                  <>
                    <Check size={20} className="text-accent" />
                    <span className={`font-semibold ${product.stock > 50 ? 'text-accent' : 'text-secondary'}`}>
                      {product.stock} units available
                    </span>
                  </>
                ) : (
                  <span className="font-semibold text-destructive">Out of Stock</span>
                )}
              </div>
            </div>

            <p className="text-muted-foreground mb-6 leading-relaxed">{product.description}</p>

            {/* Quantity Selector */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-base font-medium text-foreground">Quantity:</span>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-xl border-2"
                >
                  -
                </Button>
                <span className="w-16 text-center font-bold text-xl">{quantity}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="w-10 h-10 rounded-xl border-2"
                >
                  +
                </Button>
              </div>
            </div>

            <Button
              className="w-full h-14 text-lg text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-lg"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              <ShoppingCart size={20} className="mr-2" />
              Add to Cart - {(product.price * quantity).toFixed(2)} TND
            </Button>
          </Card>
        </div>
      </div>

      {/* Technical Specifications */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Technical Specifications</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {Object.entries(product.specifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
              <span className="font-medium text-muted-foreground">{key}:</span>
              <span className="font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Key Features */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Key Features</h2>
        <ul className="grid md:grid-cols-2 gap-4">
          {product.features.map((feature, idx) => (
            <li key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-accent/5">
              <Check size={20} className="text-accent flex-shrink-0" />
              <span className="text-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Related Products */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-6">Related Products</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedProducts.map((relProd) => (
            <Card 
              key={relProd.id}
              className="group bg-white rounded-2xl border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden cursor-pointer"
            >
              <div className="aspect-video relative overflow-hidden bg-gray-100">
                <ImageWithFallback
                  src={relProd.image}
                  alt={relProd.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <div className="p-5 space-y-3">
                <h3 className="font-bold text-foreground line-clamp-2">{relProd.name}</h3>
                <div className="flex items-center gap-1">
                  <span className="text-secondary text-lg">★</span>
                  <span className="text-sm font-semibold text-foreground">{relProd.rating}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-primary">{relProd.price} TND</span>
                  <Button size="sm" variant="outline" className="rounded-lg">
                    View
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
