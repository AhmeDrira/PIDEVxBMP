import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Search, ShoppingCart, Package, Check, ArrowRight, X, SlidersHorizontal, Eye, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import axios from 'axios';
import { toast } from 'sonner';

export default function ArtisanMarketplace() {
  const [view, setView] = useState<'products' | 'cart' | 'confirmation' | 'detail'>('products');
  const [cart, setCart] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const CART_STORAGE_KEY = 'artisan-marketplace-cart';
  const CART_CONTEXT_KEY = 'artisan-marketplace-cart-context';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProjectId(params.get('projectId'));

    const shouldOpenCart = params.get('openCart') === '1';
    if (shouldOpenCart) {
      setView('cart');
      params.delete('openCart');
      const cleaned = params.toString();
      window.history.replaceState({}, '', cleaned ? `/?${cleaned}` : '/');
    }

    try {
      const stored = sessionStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch (error) {
      console.warn('Unable to restore marketplace cart:', error);
    }
  }, []);

  useEffect(() => {
    const openCartHandler = () => setView('cart');
    window.addEventListener('artisan-open-cart', openCartHandler as EventListener);
    return () => {
      window.removeEventListener('artisan-open-cart', openCartHandler as EventListener);
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      window.dispatchEvent(new Event('artisan-cart-updated'));
    } catch (error) {
      console.warn('Unable to persist marketplace cart:', error);
    }
  }, [cart]);
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // States pour les Notifications & Avis
  const [ratingHover, setRatingHover] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratedProductKeys, setRatedProductKeys] = useState<Set<string>>(new Set());
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [projectMaterialSignatures, setProjectMaterialSignatures] = useState<Set<string>>(new Set());
  const [isConfirmingStripePayment, setIsConfirmingStripePayment] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const isMongoObjectId = (value: unknown) =>
    typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  const getMaterialSignature = (item: any) =>
    `${String(item?.name || '').trim().toLowerCase()}::${String(item?.category || '').trim().toLowerCase()}`;

  const getProductRatingKey = (item: any) => {
    const rawId = String(item?._id || '').trim();
    if (rawId) return `id:${rawId}`;
    return `sig:${getMaterialSignature(item)}`;
  };

  const markProductAsRated = (item: any) => {
    const key = getProductRatingKey(item);
    setRatedProductKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const isCurrentProductAlreadyRated = selectedProduct
    ? ratedProductKeys.has(getProductRatingKey(selectedProduct))
    : false;

  // --- CHARGEMENT DES PRODUITS ---
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      const response = await axios.get(`${API_URL}/products/marketplace`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const dbProducts = Array.isArray(response.data) ? response.data : [];
      const data = dbProducts;
      setProducts(data);

      const initialRatedKeys = new Set<string>();
      data.forEach((p: any) => {
        if (p?.currentUserHasReviewed) {
          initialRatedKeys.add(getProductRatingKey(p));
        }
      });
      setRatedProductKeys(initialRatedKeys);

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

  useEffect(() => {
    setRatingHover(0);
    setUserRating(0);
  }, [selectedProduct?._id]);

  useEffect(() => {
    const fetchProjectMaterialSignatures = async () => {
      if (!projectId) {
        setProjectMaterialSignatures(new Set());
        return;
      }

      try {
        const token = getToken();
        if (!token) return;

        const res = await axios.get(`${API_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const projects = Array.isArray(res.data) ? res.data : [];
        const currentProject = projects.find((p: any) => String(p?._id || '') === String(projectId));
        const materials = Array.isArray(currentProject?.materials) ? currentProject.materials : [];

        const signatures = new Set<string>();
        materials.forEach((mat: any) => {
          const signature = getMaterialSignature(mat);
          if (signature !== '::') signatures.add(signature);
        });

        setProjectMaterialSignatures(signatures);
      } catch (error) {
        console.error('Unable to load project materials for duplicate checks:', error);
      }
    };

    fetchProjectMaterialSignatures();
  }, [projectId, API_URL]);

  // --- NOTIFICATION SYSTÈME ---
  const showToast = (msg: string, type: 'success' | 'warning' | 'error' = 'success') => {
    if (type === 'error') {
      toast.error(msg, { duration: 3200 });
      return;
    }
    if (type === 'warning') {
      toast.warning(msg, { duration: 3200 });
      return;
    }
    toast.success(msg, { duration: 3200 });
  };

  // --- SOUMETTRE UN AVIS (ÉTOILES) ---
  const submitRating = async (ratingValue: number) => {
    if (!selectedProduct) return;
    if (isSubmittingRating) return;
    if (isCurrentProductAlreadyRated) {
      return;
    }

    try {
      setIsSubmittingRating(true);
      const token = getToken();
      if (!token) {
        showToast('Session expired. Please sign in again.', 'error');
        return;
      }

      let ratingTargetId = selectedProduct._id;
      if (!isMongoObjectId(ratingTargetId)) {
        const ensured = await axios.post(
          `${API_URL}/products/ensure-static`,
          {
            name: selectedProduct.name,
            category: selectedProduct.category,
            price: selectedProduct.price,
            stock: selectedProduct.stock,
            description: selectedProduct.description,
            image: selectedProduct.image,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        ratingTargetId = ensured?.data?._id;
      }

      if (!isMongoObjectId(ratingTargetId)) {
        showToast('Unable to submit rating for this material.', 'error');
        return;
      }

      await axios.post(`${API_URL}/products/${ratingTargetId}/reviews`, 
        { rating: ratingValue }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast('Thank you for your rating! ⭐');
      setUserRating(ratingValue);
      // Mettre à jour localement pour l'affichage
      const updatedProduct = {
        ...selectedProduct, 
        _id: ratingTargetId,
        currentUserHasReviewed: true,
        rating: ((selectedProduct.rating * selectedProduct.numReviews) + ratingValue) / (selectedProduct.numReviews + 1),
        numReviews: selectedProduct.numReviews + 1
      };
      setSelectedProduct(updatedProduct);
      markProductAsRated(updatedProduct);
    } catch (error: any) {
      if (error.response?.status === 400) {
        const backendMessage = error?.response?.data?.message;
        const locallyLockedProduct = {
          ...selectedProduct,
          currentUserHasReviewed: true,
        };
        setSelectedProduct(locallyLockedProduct);
        markProductAsRated(locallyLockedProduct);
        showToast(backendMessage || 'You already rated this material.', 'error');
      } else {
        showToast('Failed to submit rating.', 'error');
      }
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const [showProjectConfirm, setShowProjectConfirm] = useState(false);
  const [productToAdd, setProductToAdd] = useState<any>(null);
  const [confirmMessage, setConfirmMessage] = useState<string>('');
  const [isAddingToProject, setIsAddingToProject] = useState(false);

  // --- LOGIQUE PANIER ---
  const addToCart = async (product: any) => {
    if (projectId) {
      const signature = getMaterialSignature(product);
      const alreadyInProject = signature !== '::' && projectMaterialSignatures.has(signature);
      if (alreadyInProject) {
        showToast('This material already exists in project materials.', 'error');
        return;
      }
      setProductToAdd(product);
      setConfirmMessage('');
      setShowProjectConfirm(true);
      return;
    }

    const normalizedProductId = String(product?._id || '');
    const targetSignature = getMaterialSignature(product);
    const existing = cart.find((item) => {
      const sameId = String(item?._id || '') === normalizedProductId;
      const sameSignature = targetSignature !== '::' && getMaterialSignature(item) === targetSignature;
      return sameId || sameSignature;
    });
    if (existing) {
      showToast('This material already exists in cart.', 'error');
      return;
    }

    const nextContext = { source: 'marketplace', updatedAt: Date.now() };
    sessionStorage.setItem(CART_CONTEXT_KEY, JSON.stringify(nextContext));

    setCart((prev) => {
      return [...prev, { ...product, quantity: 1 }];
    });

    showToast('Material added to cart successfully.', 'success');
  };

  const confirmAddToProject = async () => {
    if (!productToAdd || !projectId) return;

    let productIdToAttach = productToAdd._id;

    try {
      setIsAddingToProject(true);
      const token = getToken();

      if (!isMongoObjectId(productIdToAttach)) {
        const ensured = await axios.post(
          `${API_URL}/products/ensure-static`,
          {
            name: productToAdd.name,
            category: productToAdd.category,
            price: productToAdd.price,
            stock: productToAdd.stock,
            description: productToAdd.description,
            image: productToAdd.image,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        productIdToAttach = ensured?.data?._id;
      }

      if (!isMongoObjectId(productIdToAttach)) {
        throw new Error('Invalid product id after static ensure');
      }

      const projRes = await axios.get(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } });
      const currentProject = projRes.data.find((p: any) => p._id === projectId);
      if (!currentProject) throw new Error('Project not found');

      let existingIds: string[] = [];
      const existingSignatures = new Set<string>();
      if (Array.isArray(currentProject.materials)) {
        existingIds = currentProject.materials
          .flatMap((m: any) => (Array.isArray(m) ? m : [m]))
          .map((m: any) => (typeof m === 'object' && m !== null ? m._id : m))
          .filter((id: unknown) => isMongoObjectId(id)) as string[];

        currentProject.materials.forEach((material: any) => {
          const signature = getMaterialSignature(material);
          if (signature !== '::') existingSignatures.add(signature);
        });
      }

      const incomingSignature = getMaterialSignature(productToAdd);
      const duplicateById = existingIds.some((id) => String(id) === String(productIdToAttach));
      const duplicateBySignature = incomingSignature !== '::' && (
        existingSignatures.has(incomingSignature) || projectMaterialSignatures.has(incomingSignature)
      );

      if (duplicateById || duplicateBySignature) {
        setShowProjectConfirm(false);
        setProductToAdd(null);
        setConfirmMessage('');
        showToast('This material already exists in project materials.', 'error');
        return;
      }

      await axios.put(
        `${API_URL}/projects/${projectId}`,
        { materials: [...existingIds, productIdToAttach] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const nextSignatures = new Set(projectMaterialSignatures);
      nextSignatures.add(getMaterialSignature(productToAdd));
      setProjectMaterialSignatures(nextSignatures);

      setConfirmMessage(`${productToAdd.name} added to project successfully!`);
      showToast('Material added to project materials successfully.', 'success');

      setTimeout(() => {
        setShowProjectConfirm(false);
        setProductToAdd(null);
        setConfirmMessage('');
        window.location.href = '/?artisanView=projects';
      }, 900);
    } catch (err) {
      console.error('Error', err);
      setConfirmMessage('Error adding to project.');
      setTimeout(() => {
        setShowProjectConfirm(false);
        setProductToAdd(null);
        setConfirmMessage('');
      }, 1200);
    } finally {
      setIsAddingToProject(false);
    }
  };

  const cancelAddToProject = () => {
    setConfirmMessage(`${productToAdd?.name} was not added.`);
    setTimeout(() => {
      setShowProjectConfirm(false);
      setProductToAdd(null);
      setConfirmMessage('');
    }, 1000);
  };

  const renderGlobalOverlay = () => {
    if (typeof document === 'undefined') return null;
    if (!showProjectConfirm) return null;

    return createPortal(
      <>
        {showProjectConfirm && productToAdd && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] pointer-events-auto">
            <div className="mx-4 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                {confirmMessage ? (
                  <div className="text-center py-8">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                      confirmMessage.includes('successfully') ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {confirmMessage.includes('successfully') ? (
                        <Check size={32} className="text-green-600" />
                      ) : (
                        <X size={32} className="text-red-600" />
                      )}
                    </div>
                    <p className={`text-lg font-semibold ${
                      confirmMessage.includes('successfully') ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {confirmMessage}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package size={32} className="text-gray-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Add this material to the project?</h3>
                      <p className="text-gray-600 font-medium">{productToAdd.name}</p>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                        onClick={cancelAddToProject}
                        disabled={isAddingToProject}
                      >
                        Non
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                        onClick={confirmAddToProject}
                        disabled={isAddingToProject}
                      >
                        {isAddingToProject ? 'Oui...' : 'Oui'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </>,
      document.body
    );
  };

  const getTotalPrice = () => cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev.find((item) => String(item._id) === String(productId));
      if (!current) return prev;

      const currentQty = Number(current.quantity || 0);
      const maxStock = Number(current.stock || 0);

      if (delta > 0 && maxStock > 0 && currentQty >= maxStock) {
        showToast('You reached the maximum stock quantity for this material.', 'warning');
        return prev;
      }

      return prev
        .map((item) =>
          item._id === productId
            ? { ...item, quantity: Math.max(0, Number(item.quantity || 0) + delta) }
            : item
        )
        .filter((item) => item.quantity > 0);
    });
  };

  const handleCheckout = async () => {
    if (!cart.length || isCheckoutLoading) return;
    try {
      setIsCheckoutLoading(true);
      const token = getToken();
      if (!token) {
        showToast('Session expired. Please sign in again.', 'error');
        return;
      }

      const response = await axios.post(
        `${API_URL}/products/checkout/create-session`,
        {
          items: cart.map((item) => ({
            productId: item._id,
            quantity: item.quantity,
            name: item.name,
            category: item.category,
            price: item.price,
            stock: item.stock,
            description: item.description,
            image: item.image,
          })),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const sessionId = String(response?.data?.sessionId || '').trim();
      const checkoutUrl = response?.data?.url;
      if (!checkoutUrl) {
        showToast('Unable to initialize Stripe checkout.', 'error');
        return;
      }

      if (sessionId) {
        const pendingItems = cart.map((item) => ({
          productId: item._id,
          quantity: item.quantity,
          name: item.name,
          category: item.category,
          price: item.price,
          stock: item.stock,
          description: item.description,
          image: item.image,
        }));

        localStorage.setItem(
          `artisan-stripe-checkout:${sessionId}`,
          JSON.stringify({ items: pendingItems, createdAt: Date.now() }),
        );
      }

      window.location.href = checkoutUrl;
    } catch (error: any) {
      console.error('Stripe create-session failed:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      const message = error?.response?.data?.message || 'Checkout failed. Please try again.';
      showToast(message, 'error');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentState = params.get('payment');
    const stripeSessionId = params.get('session_id');

    if (!paymentState) return;

    const clearPaymentParams = () => {
      const next = new URLSearchParams(window.location.search);
      next.delete('payment');
      next.delete('session_id');
      const cleaned = next.toString();
      window.history.replaceState({}, '', cleaned ? `/?${cleaned}` : '/');
    };

    if (paymentState === 'cancel') {
      showToast('Payment cancelled. Your cart is still available.', 'warning');
      clearPaymentParams();
      return;
    }

    if (paymentState !== 'success' || !stripeSessionId || isConfirmingStripePayment) {
      return;
    }

    const processedSessionKey = `stripe-session-processed:${stripeSessionId}`;
    if (sessionStorage.getItem(processedSessionKey) === '1') {
      setView('confirmation');
      clearPaymentParams();
      return;
    }

    const confirmStripePayment = async () => {
      try {
        setIsConfirmingStripePayment(true);
        const token = getToken();
        if (!token) {
          showToast('Session expired. Please sign in again.', 'error');
          return;
        }

        let checkoutItems = cart.map((item) => ({
          productId: item._id,
          quantity: item.quantity,
          name: item.name,
          category: item.category,
          price: item.price,
          stock: item.stock,
          description: item.description,
          image: item.image,
        }));

        if (!checkoutItems.length) {
          try {
            const persistedRaw = localStorage.getItem(`artisan-stripe-checkout:${stripeSessionId}`);
            const persisted = persistedRaw ? JSON.parse(persistedRaw) : null;
            if (Array.isArray(persisted?.items)) {
              checkoutItems = persisted.items;
            }
          } catch (storageError) {
            console.warn('Unable to restore persisted stripe checkout items:', storageError);
          }
        }

        if (!checkoutItems.length) {
          showToast('Cart details missing for payment confirmation.', 'error');
          return;
        }

        await axios.post(
          `${API_URL}/products/checkout/confirm-session`,
          {
            sessionId: stripeSessionId,
            items: checkoutItems,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        sessionStorage.setItem(processedSessionKey, '1');
        setCart([]);
        sessionStorage.removeItem(CART_STORAGE_KEY);
        sessionStorage.removeItem(CART_CONTEXT_KEY);
        window.dispatchEvent(new Event('artisan-cart-updated'));
        window.dispatchEvent(new Event('artisan-marketplace-payment-success'));
        localStorage.removeItem(`artisan-stripe-checkout:${stripeSessionId}`);
        showToast('Payment successful. Stock updated.', 'success');
        setView('confirmation');
      } catch (error: any) {
        console.error('Stripe confirm-session failed:', {
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message,
        });
        const message = error?.response?.data?.message || 'Failed to confirm Stripe payment.';
        showToast(message, 'error');
      } finally {
        setIsConfirmingStripePayment(false);
        clearPaymentParams();
      }
    };

    confirmStripePayment();
  }, [API_URL, cart, isConfirmingStripePayment]);

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

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedManufacturer, availableOnly, priceRange[0], priceRange[1]]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);


  // ==========================================
  // VUE : DÉTAIL DU PRODUIT & ÉTOILES
  // ==========================================
  if (view === 'detail' && selectedProduct) {
    const maxStars = 5;
    const currentAverage = Number(selectedProduct?.rating || 0);
    const currentReviews = Number(selectedProduct?.numReviews || 0);
    const pendingRating = ratingHover || userRating;
    const canPreviewAverage = pendingRating > 0;
    const previewAverage = canPreviewAverage
      ? ((currentAverage * currentReviews) + pendingRating) / (currentReviews + 1)
      : currentAverage;
    const displayedAverage = Number.isFinite(previewAverage) ? previewAverage : 0;
    const displayedReviews = canPreviewAverage ? currentReviews + 1 : currentReviews;

    return (
      <div className="space-y-6 relative">
        {renderGlobalOverlay()}

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
                  <span className="text-2xl font-bold text-foreground">{displayedAverage.toFixed(1)}</span>
                  <div className="flex text-secondary">
                    {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
                      <Star key={star} size={20} fill={star <= displayedAverage ? "currentColor" : "none"} className="text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-muted-foreground">({displayedReviews} reviews)</span>
                </div>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200">
                  <span className="text-sm text-muted-foreground mr-2">Rate this product:</span>
                  {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
                    <Star
                      key={star}
                      size={24}
                      fill={star <= (ratingHover || userRating) ? 'currentColor' : 'none'}
                      className={`transition-colors ${isSubmittingRating ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${star <= (ratingHover || userRating) ? 'text-yellow-400' : 'text-gray-300'}`}
                      onMouseEnter={() => !isSubmittingRating && setRatingHover(star)}
                      onMouseLeave={() => !isSubmittingRating && setRatingHover(0)}
                      onClick={() => {
                        if (isSubmittingRating) return;
                        setUserRating(star);
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg"
                    disabled={isSubmittingRating || userRating === 0 || isCurrentProductAlreadyRated}
                    onClick={() => submitRating(userRating)}
                  >
                    {isCurrentProductAlreadyRated
                      ? 'Already rated'
                      : isSubmittingRating
                        ? 'Sending...'
                        : 'Submit rating'}
                  </Button>
                  {canPreviewAverage && (
                    <p className="text-xs text-muted-foreground">Preview average based on your selected stars.</p>
                  )}
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
                <ShoppingCart size={20} className="mr-2" /> {projectId ? 'Add to Project' : 'Add to Cart'}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VUE : PANIER & CONFIRMATION
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
    const itemsSubtotalAmount = getTotalPrice();
    const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const shipping = 15;
    const taxAmount = 0;
    const grandTotal = itemsSubtotalAmount + shipping + taxAmount;

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
                      <div className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 min-w-[84px] text-center">
                        <p className="text-xs text-muted-foreground font-medium">Quantity</p>
                        <div className="mt-1 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="w-7 h-7 rounded-md border border-gray-300 bg-white text-sm font-bold leading-none hover:bg-gray-100"
                            onClick={() => updateCartQuantity(String(item._id), -1)}
                          >
                            -
                          </button>
                          <p className="font-bold text-lg text-foreground min-w-[20px]">{item.quantity}</p>
                          <button
                            type="button"
                            className="w-7 h-7 rounded-md border border-gray-300 bg-white text-sm font-bold leading-none hover:bg-gray-100"
                            onClick={() => updateCartQuantity(String(item._id), 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-foreground">{(item.price * item.quantity).toFixed(2)} TND</p>
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
                <div className="flex justify-between text-muted-foreground"><span>Subtotal (items)</span><span className="font-semibold text-foreground">{totalItems}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span className="font-semibold text-foreground">{shipping.toFixed(2)} TND</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tax (19%)</span><span className="font-semibold text-foreground">{taxAmount.toFixed(2)} TND</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Materials amount</span><span className="font-semibold text-foreground">{itemsSubtotalAmount.toFixed(2)} TND</span></div>
                <div className="pt-4 border-t-2 border-gray-100">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary">{grandTotal.toFixed(2)} TND</span>
                  </div>
                </div>
              </div>
              <Button className="w-full h-12 text-white bg-accent hover:bg-accent/90 rounded-xl shadow-lg" onClick={handleCheckout} disabled={cart.length === 0 || isCheckoutLoading}>
                {isCheckoutLoading ? 'Processing...' : 'Proceed to Checkout'}
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
      {renderGlobalOverlay()}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{projectId ? 'Select Materials for Project' : 'Marketplace'}</h1>
          <p className="text-lg text-muted-foreground">{projectId ? 'Add construction materials directly to your project.' : 'Browse and order construction materials'}</p>
        </div>
        {projectId && (
          <Button onClick={() => window.location.href = '/?artisanView=projects'} variant="outline" className="h-12 px-6 rounded-xl border-2 relative hover:border-primary hover:text-primary transition-colors bg-white shadow-sm">
            <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Projects
          </Button>
        )}
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
              {paginatedProducts.map((product) => (
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
                        <ShoppingCart size={16} className="mr-1" /> {projectId ? 'Add to Project' : 'Add'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredProducts.length > 0 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 rounded-2xl border-2 border-gray-200 bg-white p-0 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={safeCurrentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={18} />
              </Button>

              <div className="text-xl font-semibold text-foreground">
                <span className="text-muted-foreground">Page </span>
                <span>{safeCurrentPage}</span>
                <span className="text-muted-foreground"> of </span>
                <span>{totalPages}</span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 rounded-2xl border-2 border-gray-200 bg-white p-0 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage === totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}