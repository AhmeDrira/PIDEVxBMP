import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ExternalLink, FileText, Package, ShoppingCart } from 'lucide-react';
import axios from 'axios';

import { ImageMagnifier } from '../common/ImageMagnifier';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useLanguage } from '../../context/LanguageContext';

interface ProductDetailProps {
  productId?: string;
  onBack?: () => void;
  onAddToCart?: (product: any) => void;
}

const SERVER_URL = 'http://localhost:5000';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getImageUrl(path?: string) {
  if (!path) return '';

  const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
  return cleanPath.startsWith('http') ? cleanPath : `${SERVER_URL}/${cleanPath}`;
}

export default function ProductDetail({ productId, onBack, onAddToCart }: ProductDetailProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);

  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQuantity(1);
  }, [productId]);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setLoading(false);
      return;
    }

    const token =
      localStorage.getItem('token') ||
      (() => {
        try {
          return JSON.parse(localStorage.getItem('user') || '{}').token;
        } catch {
          return '';
        }
      })();

    setLoading(true);

    axios
      .get(`${API_URL}/products/${productId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((response) => setProduct(response.data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [productId]);

  const manufacturerName = useMemo(() => {
    if (!product) return '';

    if (product.manufacturer) {
      const fullName = `${product.manufacturer.firstName || ''} ${product.manufacturer.lastName || ''}`.trim();
      return fullName || product.manufacturer.companyName || tr('Manufacturer', 'Fabricant', 'Manufacturer');
    }

    return product.manufacturerName || tr('Manufacturer', 'Fabricant', 'Manufacturer');
  }, [product, tr]);

  const imageUrl = getImageUrl(product?.documentUrl || product?.image);
  const pdfUrl = product?.techSheetUrl ? getImageUrl(product.techSheetUrl) : null;
  const totalPrice = ((Number(product?.price) || 0) * quantity).toFixed(3);

  const handleAddToCart = () => {
    if (!product || !onAddToCart) return;
    onAddToCart({ ...product, quantity });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="rounded-2xl border border-border bg-card px-6 py-4 text-sm font-medium text-muted-foreground shadow-sm">
          {tr('Loading product details...', 'Chargement des details du produit...', 'Loading product details...')}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" />
            {tr('Back', 'Retour', 'Back')}
          </Button>
        )}

        <Card className="rounded-[28px] border border-border bg-card p-12 text-center shadow-lg">
          <Package size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-2xl font-bold text-foreground">{tr('Product not found', 'Produit introuvable', 'Product not found')}</h2>
          <p className="mt-2 text-muted-foreground">
            {tr(
              'This product may have been removed or is no longer available.',
              'Ce produit a peut-etre ete supprime ou n est plus disponible.',
              'This product may have been removed or is no longer available.',
            )}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {onBack && (
        <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" />
          {tr('Back to Products', 'Retour aux produits', 'Back to Products')}
        </Button>
      )}

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {imageUrl ? (
            <Card className="overflow-hidden rounded-[28px] border border-border bg-card p-4 shadow-xl">
              <ImageMagnifier
                src={imageUrl}
                alt={product.name}
                zoomLevel={2.5}
                className="items-stretch"
                viewerClassName="min-h-[340px] rounded-[24px] border border-border/70 bg-slate-50 md:min-h-[430px]"
                imageFit="contain"
                showPreviewPane
                hint={tr(
                  'Hover to inspect the finishes and texture',
                  'Survolez pour inspecter les finitions et la texture',
                  'Hover to inspect the finishes and texture',
                )}
              />
            </Card>
          ) : (
            <Card className="flex min-h-[340px] items-center justify-center rounded-[28px] border border-border bg-card shadow-xl md:min-h-[430px]">
              <div className="text-center">
                <Package size={56} className="mx-auto mb-4 text-muted-foreground/50" />
                <p className="font-medium text-muted-foreground">
                  {tr('No product image available', 'Aucune image disponible', 'No product image available')}
                </p>
              </div>
            </Card>
          )}

          <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {tr(
              'Interactive zoom helps experts inspect textures, finish quality and visible material details before ordering.',
              'Le zoom interactif aide les experts a verifier la texture, la finition et les details visibles avant la commande.',
              'Interactive zoom helps experts inspect textures, finish quality and visible material details before ordering.',
            )}
          </div>

          {pdfUrl && (
            <Card className="rounded-[24px] border border-blue-100 bg-blue-50 p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <FileText size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-blue-950">
                    {tr('Technical sheet available', 'Fiche technique disponible', 'Technical sheet available')}
                  </p>
                  <p className="text-sm text-blue-700">
                    {tr('Open the manufacturer PDF for installation notes and specs.', 'Ouvrez le PDF du fabricant pour les specifications et consignes de pose.', 'Open the manufacturer PDF for installation notes and specs.')}
                  </p>
                </div>
                <Button
                  className="h-11 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
                  onClick={() => window.open(pdfUrl, '_blank')}
                >
                  <ExternalLink size={16} className="mr-2" />
                  {tr('Open PDF', 'Ouvrir le PDF', 'Open PDF')}
                </Button>
              </div>
            </Card>
          )}
        </div>

        <Card className="rounded-[28px] border border-border bg-card p-8 shadow-lg">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Badge className="border-0 bg-primary/10 px-3 py-1 text-sm text-primary">{product.category}</Badge>
            <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-medium text-muted-foreground">
              {manufacturerName}
            </span>
          </div>

          <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {product.description ||
              tr(
                'No description available for this product yet.',
                'Aucune description n est encore disponible pour ce produit.',
                'No description available for this product yet.',
              )}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                {tr('Unit price', 'Prix unitaire', 'Unit price')}
              </p>
              <p className="mt-2 text-4xl font-black text-primary">{Number(product.price).toFixed(3)} TND</p>
            </div>

            <div className="rounded-2xl border border-border bg-muted/35 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {tr('Availability', 'Disponibilite', 'Availability')}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    product.stock > 10
                      ? 'bg-emerald-100 text-emerald-600'
                      : product.stock > 0
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-red-100 text-red-600'
                  }`}
                >
                  <Check size={20} />
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground">{product.stock}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.stock > 0
                      ? tr('units currently available', 'unites actuellement disponibles', 'units currently available')
                      : tr('out of stock', 'rupture de stock', 'out of stock')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-muted/35 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {tr('Quantity', 'Quantite', 'Quantity')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tr('Adjust the requested quantity before adding to cart.', 'Ajustez la quantite demandee avant d ajouter au panier.', 'Adjust the requested quantity before adding to cart.')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 w-11 rounded-xl border-2"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                >
                  -
                </Button>
                <div className="min-w-[72px] rounded-xl border border-border bg-card px-4 py-2 text-center text-lg font-bold text-foreground">
                  {quantity}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 w-11 rounded-xl border-2"
                  onClick={() => setQuantity((current) => Math.min(product.stock || 1, current + 1))}
                  disabled={product.stock === 0}
                >
                  +
                </Button>
              </div>
            </div>
          </div>

          <Button
            className="mt-8 h-14 w-full rounded-2xl bg-secondary text-lg font-semibold text-white shadow-lg hover:bg-secondary/90"
            onClick={handleAddToCart}
            disabled={product.stock === 0 || !onAddToCart}
          >
            <ShoppingCart size={20} className="mr-2" />
            {tr('Add to Cart', 'Ajouter au panier', 'Add to Cart')} - {totalPrice} TND
          </Button>
        </Card>
      </div>
    </div>
  );
}
