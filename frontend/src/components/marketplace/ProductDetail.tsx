import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, ShoppingCart, Check, FileText, ExternalLink, Package } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import axios from 'axios';

interface ProductDetailProps {
  productId?: string;
  onBack?: () => void;
  onAddToCart?: (product: any) => void;
}

const SERVER_URL = 'http://localhost:5000';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getImageUrl(path: string) {
  if (!path) return '';
  const clean = path.replace(/\\/g, '/').replace(/^\/+/, '');
  return clean.startsWith('http') ? clean : `${SERVER_URL}/${clean}`;
}

export default function ProductDetail({ productId, onBack, onAddToCart }: ProductDetailProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) { setLoading(false); return; }
    const token = localStorage.getItem('token') || (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').token; } catch { return ''; } })();
    axios.get(`${API_URL}/products/${productId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => setProduct(res.data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        {onBack && <Button variant="outline" onClick={onBack} className="rounded-xl border-2"><ArrowRight size={20} className="mr-2 rotate-180" /> Back</Button>}
        <Card className="p-12 text-center rounded-2xl border-0 shadow-lg">
          <Package size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-muted-foreground">Product not found.</p>
        </Card>
      </div>
    );
  }

  const imgUrl = getImageUrl(product.documentUrl);
  const pdfUrl = product.techSheetUrl ? getImageUrl(product.techSheetUrl) : null;
  const images = imgUrl ? [imgUrl] : [];
  const manufacturerName = product.manufacturer
    ? `${product.manufacturer.firstName || ''} ${product.manufacturer.lastName || ''}`.trim()
    : product.manufacturerName || 'Manufacturer';

  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart({ ...product, quantity });
    }
  };

  return (
    <div className="space-y-8">
      {/* Back Button */}
      {onBack && (
        <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Products
        </Button>
      )}

      {/* Main Product Section */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Image */}
        <div className="space-y-4">
          <Card className="p-0 bg-white rounded-2xl border-0 shadow-lg overflow-hidden">
            <div className="aspect-video bg-gray-100 flex items-center justify-center">
              {images.length > 0 ? (
                <ImageWithFallback
                  src={images[selectedImage]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package size={64} className="text-gray-300" />
              )}
            </div>
          </Card>

          {/* PDF Technical Sheet */}
          {pdfUrl && (
            <Card className="p-5 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={24} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-blue-900 text-sm">Technical Sheet Available</p>
                  <p className="text-blue-600 text-xs mt-0.5">PDF document attached by manufacturer</p>
                </div>
                <Button
                  className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex-shrink-0"
                  onClick={() => window.open(pdfUrl, '_blank')}
                >
                  <ExternalLink size={15} className="mr-1.5" /> Open
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <Badge className="mb-4 bg-primary/10 text-primary border-0 px-3 py-1 text-sm">
              {product.category}
            </Badge>

            <h1 className="text-3xl font-bold text-foreground mb-3">{product.name}</h1>

            <p className="text-lg text-muted-foreground mb-4">{manufacturerName}</p>

            <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 mb-6">
              <span className="text-lg font-medium text-muted-foreground">Price:</span>
              <span className="text-4xl font-bold text-primary">{Number(product.price).toFixed(3)} TND</span>
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

            {product.description && (
              <p className="text-muted-foreground mb-6 leading-relaxed">{product.description}</p>
            )}

            {/* Quantity Selector */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-base font-medium text-foreground">Quantity:</span>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-xl border-2">-</Button>
                <span className="w-16 text-center font-bold text-xl">{quantity}</span>
                <Button size="sm" variant="outline" onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="w-10 h-10 rounded-xl border-2">+</Button>
              </div>
            </div>

            <Button
              className="w-full h-14 text-lg text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-lg"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              <ShoppingCart size={20} className="mr-2" />
              Add to Cart — {(Number(product.price) * quantity).toFixed(3)} TND
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
