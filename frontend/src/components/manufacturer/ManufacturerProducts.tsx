import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Search, Package, Edit, Trash2, Upload, ArrowRight, CheckCircle, HardHat, FileText, FileDown, Tag, Layers, ExternalLink, BarChart2, Hash, Info, SlidersHorizontal, X, Mic, MicOff, Sparkles, LoaderCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import { ImageMagnifier } from '../common/ImageMagnifier';

type MaterialSpeechField = 'name' | 'price' | 'stock' | 'description';

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

export default function ManufacturerProducts() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const { t } = useLanguage();
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'detail'>('list');
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
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
  const [activeSpeechField, setActiveSpeechField] = useState<MaterialSpeechField | null>(null);
  const [isSpeechListening, setIsSpeechListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechBaseRef = useRef('');
  const speechFinalRef = useRef('');
  const isSpeechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const SERVER_URL = 'http://localhost:5000'; 

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  const getSpeechLanguage = () => {
    if (language === 'fr') return 'fr-FR';
    if (language === 'ar') return 'ar-TN';
    return 'en-US';
  };

  const stopSpeechToText = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsSpeechListening(false);
    setActiveSpeechField(null);
  };

  const parseSpokenNumber = (raw: string) => {
    const normalized = raw.toLowerCase().replace(',', '.');
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const value = Number(match[0]);
    return Number.isFinite(value) ? String(value) : null;
  };

  const updateSpeechFieldValue = (field: MaterialSpeechField, value: string) => {
    if (field === 'name' || field === 'price' || field === 'stock' || field === 'description') {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const startSpeechToText = (field: MaterialSpeechField) => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      return;
    }

    if (activeSpeechField === field) {
      stopSpeechToText();
      return;
    }

    recognitionRef.current?.stop();

    const recognition = new SpeechRecognitionClass();
    recognition.lang = getSpeechLanguage();
    recognition.continuous = true;
    recognition.interimResults = true;

    const isNumericField = field === 'price' || field === 'stock';
    speechBaseRef.current = isNumericField ? '' : String(formData[field] || '').trim();
    speechFinalRef.current = '';

    recognition.onstart = () => {
      setIsSpeechListening(true);
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript?.trim();
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          speechFinalRef.current = `${speechFinalRef.current} ${transcript}`.trim();
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }

      const combined = [speechBaseRef.current, speechFinalRef.current, interim]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (isNumericField) {
        const parsed = parseSpokenNumber(combined);
        if (parsed !== null) {
          updateSpeechFieldValue(field, parsed);
        }
        return;
      }

      updateSpeechFieldValue(field, combined);
    };

    recognition.onerror = () => {
      setIsSpeechListening(false);
      setActiveSpeechField(null);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsSpeechListening(false);
      setActiveSpeechField(null);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setActiveSpeechField(field);
    setIsSpeechListening(false);
    recognition.start();
  };

  const renderSpeechButton = (field: MaterialSpeechField) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => startSpeechToText(field)}
      disabled={!isSpeechSupported}
      aria-pressed={activeSpeechField === field}
      aria-label={
        activeSpeechField === field
          ? tr('Stop voice input', 'Arreter la dictee vocale', 'Stop voice input')
          : tr('Start voice input', 'Demarrer la dictee vocale', 'Start voice input')
      }
      className={`h-9 rounded-lg border ${activeSpeechField === field ? 'border-red-500 text-red-600' : 'border-border text-muted-foreground'}`}
    >
      {activeSpeechField === field ? <MicOff size={16} className="mr-2" /> : <Mic size={16} className="mr-2" />}
      {activeSpeechField === field && isSpeechListening
        ? tr('Listening...', 'Ecoute...', 'Listening...')
        : activeSpeechField === field
          ? tr('Stop', 'Arreter', 'Stop')
          : tr('Dictee', 'Dictee', 'Dictee')}
    </Button>
  );

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

  useEffect(() => {
    if (view !== 'add' && view !== 'edit') {
      stopSpeechToText();
    }
  }, [view]);

  useEffect(() => {
    return () => {
      stopSpeechToText();
    };
  }, []);

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
      alert(t('manufacturer.products.errorSaving'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateDescription = async () => {
    const token = getToken();
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      alert(tr('Please enter a product name before generating a description.', 'Veuillez saisir un nom de produit avant de generer une description.', 'يرجى إدخال اسم المنتج قبل توليد الوصف.'));
      return;
    }

    if (!token) {
      alert(tr('Please login again to generate a description.', 'Veuillez vous reconnecter pour generer une description.', 'يرجى تسجيل الدخول مرة أخرى لتوليد الوصف.'));
      return;
    }

    try {
      setIsGeneratingDescription(true);
      const response = await axios.post(
        `${API_URL}/products/generate-description`,
        {
          name: trimmedName,
          category: formData.category,
          language,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const generatedDescription = String(response.data?.description || '').trim();
      if (!generatedDescription) {
        throw new Error(tr('Generation returned an empty description. Please retry.', 'La generation a retourne une description vide. Veuillez reessayer.', 'أرجع التوليد وصفًا فارغًا. يرجى المحاولة مرة أخرى.'));
      }

      setFormData((previous) => ({ ...previous, description: generatedDescription }));
    } catch (error: unknown) {
      const serverMessage = axios.isAxiosError(error)
        ? String(error.response?.data?.message || error.response?.data?.error?.message || error.message || '')
        : '';

      alert(serverMessage || tr('Failed to generate description. Please try again.', 'Echec de la generation de la description. Veuillez reessayer.', 'فشل توليد الوصف. يرجى المحاولة مرة أخرى.'));
    } finally {
      setIsGeneratingDescription(false);
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

  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [maxPrice, setMaxPrice] = useState(10000);

  useEffect(() => {
    if (products.length > 0) {
      const highest = Math.max(...products.map(p => Number(p.price) || 0));
      const cap = Math.ceil(highest / 100) * 100 || 10000;
      setMaxPrice(cap);
      setPriceRange([0, cap]);
    }
  }, [products]);

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || (p.status || 'active') === selectedStatus;
    const matchesStock = !inStockOnly || p.stock > 0;
    const price = Number(p.price) || 0;
    const matchesPrice = price >= priceRange[0] && price <= priceRange[1];
    return matchesSearch && matchesCategory && matchesStatus && matchesStock && matchesPrice;
  });

  const activeFilterCount = [
    selectedCategory !== 'all',
    selectedStatus !== 'all',
    inStockOnly,
    priceRange[1] < maxPrice,
  ].filter(Boolean).length;

  const inputBorderClass = "border-border focus:border-primary focus:ring-primary";

  // --- VUE FORMULAIRE (ADD / EDIT) ---
  if (view === 'add' || view === 'edit') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setView('list')} className="mb-6 rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" /> {t('common.back')}
        </Button>
        <Card className="p-10 bg-card rounded-2xl border border-border shadow-lg border">
          <HardHat size={40} className="text-primary mb-5"/>
          <h2 className="text-3xl font-bold mb-8 text-foreground">{view === 'add' ? t('manufacturer.products.addNewMaterial') : t('manufacturer.products.editMaterial')}</h2>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-semibold text-foreground">{t('manufacturer.products.productName')}</Label>
                {renderSpeechButton('name')}
              </div>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required className={`h-12 rounded-xl border-2 ${inputBorderClass}`} placeholder={t('manufacturer.products.productNamePlaceholder')} />
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-semibold text-foreground">{t('common.category')}</Label>
                <select 
                  value={formData.category} 
                  onChange={(e) => setFormData({...formData, category: e.target.value})} 
                  className={`w-full h-12 px-4 border-2 rounded-xl bg-card ${inputBorderClass} outline-none`}
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
                <div className="flex items-center justify-between gap-3">
                  <Label className="font-semibold text-foreground">{t('common.price')} (TND)</Label>
                  {renderSpeechButton('price')}
                </div>
                <Input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required className={`h-12 rounded-xl border-2 ${inputBorderClass}`} placeholder="0.000"/>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-semibold text-foreground">{t('manufacturer.products.stock')} (Units)</Label>
                {renderSpeechButton('stock')}
              </div>
              <Input type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} required className={`h-12 rounded-xl border-2 ${inputBorderClass}`} placeholder="e.g. 500"/>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="font-semibold text-foreground">Image (JPG, PNG)</Label>
                    <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-6 h-32 flex flex-col items-center justify-center cursor-pointer transition-colors ${selectedFile ? 'border-green-500 bg-green-50' : 'border-border hover:border-primary hover:bg-muted/50'}`}>
                        {selectedFile ? <><CheckCircle size={32} className="text-green-500 mb-2" /><p className="text-xs text-green-700 font-medium truncate max-w-full">{selectedFile.name}</p></> : <><Upload size={32} className="text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Click to upload photo</p></>}
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="font-semibold text-foreground">Technical Sheet (PDF)</Label>
                    <div onClick={() => pdfInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-6 h-32 flex flex-col items-center justify-center cursor-pointer transition-colors ${selectedPdf ? 'border-blue-500 bg-blue-50' : 'border-border hover:border-blue-400 hover:bg-muted/50'}`}>
                        {selectedPdf ? <><FileText size={32} className="text-blue-500 mb-2" /><p className="text-xs text-blue-700 font-medium truncate max-w-full">{selectedPdf.name}</p></> : <><FileDown size={32} className="text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Click to attach PDF</p></>}
                        <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files && setSelectedPdf(e.target.files[0])} />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-semibold text-foreground">{t('common.description')} / Technical Details</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isGeneratingDescription || isSubmitting}
                    onClick={handleGenerateDescription}
                    className="h-9 rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                  >
                    {isGeneratingDescription
                      ? <><LoaderCircle size={16} className="mr-2 animate-spin" />{tr('Generating...', 'Generation...', 'جارٍ التوليد...')}</>
                      : <><Sparkles size={16} className="mr-2" />{tr('Generate', 'Generer', 'توليد')}</>}
                  </Button>
                  {renderSpeechButton('description')}
                </div>
              </div>
              <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={4} className={`rounded-xl border-2 ${inputBorderClass}`} placeholder="Enter product specifications, dimensions, usage instructions..."/>
            </div>

            <div className="flex gap-4 pt-6 border-t border-border">
              <Button type="submit" disabled={isSubmitting} style={{ paddingLeft: 40, paddingRight: 40 }} className="h-12 bg-primary dark:bg-primary text-white dark:text-white rounded-xl shadow-md hover:bg-primary/90 transition-all text-base font-semibold">
                {isSubmitting ? 'Publishing...' : t('common.save')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setView('list')} style={{ paddingLeft: 40, paddingRight: 40 }} className="h-12 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted/50 dark:hover:bg-gray-800 text-base font-semibold">{t('common.cancel')}</Button>
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
    const rawPdf = String(product.techSheetUrl || '');
    const pdfUrl = rawPdf
      ? (rawPdf.startsWith('http') ? rawPdf : `${SERVER_URL}${rawPdf.startsWith('/') ? '' : '/'}${rawPdf.replace(/\\/g, '/')}`)
      : null;

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back */}
        <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2 border-border h-10 px-5 font-semibold text-muted-foreground hover:bg-muted/50">
          <ArrowRight size={18} className="mr-2 rotate-180 text-muted-foreground" /> Back to Inventory
        </Button>

        {/* Hero Banner */}
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl">
          <div className="flex flex-col md:flex-row">
            {/* Image */}
            <div className="w-full md:w-[320px] bg-black/20 relative overflow-hidden flex-shrink-0">
              {imgUrl
                ? (
                  <ImageMagnifier
                    src={imgUrl}
                    alt={product.name}
                    zoomLevel={2.35}
                    className="h-full"
                    viewerClassName="h-full min-h-[240px] rounded-none bg-slate-200 md:min-h-[320px]"
                    hint={tr('Hover to inspect the surface', 'Survolez pour inspecter la surface', 'Hover to inspect the surface')}
                  />
                )
                : <div className="w-full h-full flex items-center justify-center" style={{ minHeight: 240 }}><Package size={56} className="text-muted-foreground" /></div>
              }
              {/* Status overlay */}
              <div className="absolute top-4 left-4">
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border backdrop-blur-sm ${getStatusColor(product.status)}`}>
                  <span className="w-2 h-2 rounded-full bg-current"></span>
                  {product.status || 'active'}
                </span>
              </div>
            </div>

            {/* Header info */}
            <div className="flex-1 p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold border border-primary/30">
                    <Tag size={12} /> {product.category}
                  </span>
                  <span className="text-muted-foreground text-xs font-mono flex items-center gap-1">
                    <Hash size={11} className="text-muted-foreground" />{product._id.slice(-8).toUpperCase()}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">{product.name}</h1>
                {product.description && (
                  <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">{product.description}</p>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <Button onClick={() => handleEditClick(product)} className="h-11 px-6 rounded-xl bg-primary dark:bg-primary text-white dark:text-white hover:bg-primary/90 font-semibold shadow-md">
                  <Edit size={16} className="mr-2" /> Edit Material
                </Button>
                <Button onClick={() => confirmDelete(product)} className="h-11 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:border-red-800/30 font-semibold">
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-6 bg-card rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BarChart2 size={20} className="text-primary" />
              </div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Unit Price</p>
            </div>
            <p className="text-3xl font-black text-primary">{Number(product.price).toFixed(3)}</p>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">Tunisian Dinar</p>
          </Card>

          <Card className="p-6 bg-card rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${product.stock > 10 ? 'bg-emerald-50' : product.stock > 0 ? 'bg-amber-50' : 'bg-red-50'}`}>
                <Package size={20} className={product.stock > 10 ? 'text-emerald-500' : product.stock > 0 ? 'text-amber-500' : 'text-red-500'} />
              </div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Stock</p>
            </div>
            <p className={`text-3xl font-black ${product.stock > 10 ? 'text-foreground' : product.stock > 0 ? 'text-amber-600' : 'text-red-600'}`}>{product.stock}</p>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">Units available</p>
          </Card>

          <Card className="col-span-2 md:col-span-1 p-6 bg-card rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Layers size={20} className="text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Category</p>
            </div>
            <p className="text-xl font-black text-foreground">{product.category}</p>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">Material type</p>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Description */}
          <Card className="p-6 bg-card rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Info size={16} className="text-muted-foreground" />
              </div>
              <h3 className="font-bold text-foreground text-base">Technical Description</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed text-sm whitespace-pre-line">
              {product.description || 'No detailed description provided for this material.'}
            </p>
          </Card>

          {/* PDF / Technical Sheet */}
          <Card className="p-6 bg-card rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pdfUrl ? 'bg-blue-100' : 'bg-muted'}`}>
                <FileText size={16} className={pdfUrl ? 'text-blue-600' : 'text-muted-foreground'} />
              </div>
              <h3 className="font-bold text-foreground text-base">Technical Sheet</h3>
            </div>
            {pdfUrl ? (
              <div className="space-y-3">
                <p className="text-sm text-blue-700">A technical PDF is attached to this product.</p>
                <Button
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow"
                  onClick={() => window.open(pdfUrl, '_blank')}
                >
                  <ExternalLink size={16} className="mr-2" /> Open Technical Sheet
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No technical sheet uploaded for this product.</p>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // --- VUE LISTE (NOUVEAU DESIGN) ---
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center gap-4">
        <div>
          <p className="text-lg text-muted-foreground mt-1">Manage and track your construction materials stock</p>
        </div>
        <Button onClick={() => { setFormData({name:'', category:'Maçonnerie', price:'', stock:'', description:''}); setView('add'); setSelectedFile(null); setSelectedPdf(null); }} className="bg-primary dark:bg-blue-600 text-white rounded-xl h-12 px-6 shadow-lg hover:bg-primary/90 transition-all font-semibold whitespace-nowrap">
          <Plus size={20} className="mr-2" /> {t('manufacturer.products.addNewMaterial')}
        </Button>
      </div>
      
      <Card className="p-3 bg-card rounded-2xl border border-border shadow-sm">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('manufacturer.products.searchProducts')} className="pl-12 h-12 rounded-xl border-border focus:border-primary focus:ring-primary text-base" />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            className={`h-12 px-5 rounded-xl border-2 transition-all whitespace-nowrap relative ${showFilters ? 'bg-primary dark:bg-blue-600 text-white shadow-md' : 'hover:bg-muted/50'}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal size={18} className="mr-2" /> Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filter Sidebar */}
        {showFilters && (
          <div className="lg:w-72 flex-shrink-0">
            <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg sticky top-8 border-t-4 border-t-primary">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-primary" /> Filters
                </h3>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory('all'); setSelectedStatus('all'); setInStockOnly(false); setPriceRange([0, maxPrice]); }} className="text-muted-foreground hover:text-primary text-xs">
                  Clear All
                </Button>
              </div>

              <div className="space-y-6">
                {/* Category */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Category</Label>
                  <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full h-11 px-4 rounded-xl border-2 border-border bg-muted/50 focus:border-primary focus:bg-card outline-none cursor-pointer text-sm">
                    {categories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? t('manufacturer.products.allCategories') : cat}</option>)}
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</Label>
                  <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="w-full h-11 px-4 rounded-xl border-2 border-border bg-muted/50 focus:border-primary focus:bg-card outline-none cursor-pointer text-sm">
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="low-stock">Low Stock</option>
                    <option value="out-of-stock">Out of Stock</option>
                  </select>
                </div>

                {/* Price Range */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                    <span>Max Price</span>
                    <span className="text-primary font-bold">{priceRange[1]} TND</span>
                  </Label>
                  <input type="range" min={0} max={maxPrice} value={priceRange[1]} onChange={e => setPriceRange([0, Number(e.target.value)])} className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span><span>{maxPrice} TND</span>
                  </div>
                </div>

                {/* In Stock Only */}
                <div className="pt-4 border-t border-border">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${inStockOnly ? 'bg-primary border-primary' : 'border-border group-hover:border-primary'}`}>
                      {inStockOnly && <CheckCircle size={14} className="text-white" />}
                    </div>
                    <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} className="hidden" />
                    <span className="text-sm font-semibold text-muted-foreground select-none">{t('manufacturer.products.inStockOnly')}</span>
                  </label>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Product Grid */}
        <div className="flex-1">
      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground flex flex-col items-center gap-3">
            <Package size={40} className='animate-pulse text-muted-foreground'/>
            Loading inventory...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border-2 border-dashed border-border text-muted-foreground flex flex-col items-center gap-4">
            <Package size={50} className='text-muted-foreground'/>
            <div>
                <h3 className='text-xl font-bold text-foreground'>No materials found</h3>
                <p className='text-muted-foreground mt-1'>{searchQuery || activeFilterCount > 0 ? 'Try adjusting your search or filters.' : 'Start by adding your first material to the inventory.'}</p>
            </div>
            {!searchQuery && activeFilterCount === 0 && <Button onClick={() => setView('add')} className="bg-primary dark:bg-blue-600 text-white rounded-lg mt-2"><Plus size={18} className='mr-1.5'/> {t('manufacturer.products.addFirstMaterial')}</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product._id} className="p-5 bg-card rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-border group flex flex-col h-full relative">
              
              {/* HEADER : Image + Badge Statut */}
              <div className="flex justify-between items-start mb-4">
                <div className="w-20 h-20 rounded-2xl bg-muted/50 overflow-hidden flex items-center justify-center border border-border shadow-inner flex-shrink-0">
                  {product.documentUrl ? (
                    <ImageMagnifier
                      src={getImageUrl(product.documentUrl)!}
                      alt={product.name}
                      zoomLevel={2.1}
                      className="h-full w-full"
                      viewerClassName="h-full w-full rounded-[15px]"
                      showHint={false}
                    />
                  ) : (
                    <Package size={28} className="text-muted-foreground" />
                  )}
                </div>
                
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(product.status)}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  {product.status || 'active'}
                </span>
              </div>

              {/* TITRE ET CATÉGORIE (Alignés à gauche) */}
              <div className="mb-5 flex-1">
                <h3 className="font-bold text-lg text-foreground leading-tight mb-1 line-clamp-2 group-hover:text-primary transition-colors" title={product.name}>
                  {product.name}
                </h3>
                <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                  <Tag size={14} className="text-primary" />
                  {product.category}
                </p>
              </div>
              
              {/* PRIX ET STOCK (Design unifié) */}
              <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-muted/50 rounded-xl border border-border">
                <div className="flex flex-col">
                  <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Price</span>
                  <span className="font-black text-lg text-primary leading-none">
                    {Number(product.price).toFixed(3)} <span className="text-xs font-semibold">TND</span>
                  </span>
                </div>
                <div className="flex flex-col border-l border-border pl-3">
                  <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Stock</span>
                  <span className={`font-black text-lg leading-none ${product.stock > 10 ? 'text-foreground' : product.stock > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {product.stock} <span className="text-xs font-semibold text-muted-foreground">units</span>
                  </span>
                </div>
              </div>
              
              {/* BOUTONS D'ACTION */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button 
                  onClick={() => { setSelectedProductId(product._id); setView('detail'); }} 
                  className="flex-1 rounded-lg h-10 !bg-emerald-600 hover:!bg-emerald-700 text-white font-medium text-sm transition-colors"
                >
                  View Details
                </Button>
                <Button 
                  onClick={() => handleEditClick(product)} 
                  variant="outline" 
                  className="rounded-lg h-10 w-10 p-0 border-border text-muted-foreground hover:text-primary hover:bg-muted/50 hover:border-border transition-colors"
                >
                  <Edit size={16} />
                </Button>
                <Button 
                  onClick={() => confirmDelete(product)} 
                  variant="outline" 
                  className="rounded-lg h-10 w-10 p-0 border-border text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              
            </Card>
          ))}
        </div>
      )}
        </div> {/* end flex-1 */}
      </div> {/* end flex row */}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            style={{ backgroundColor: 'var(--card)', borderRadius: 20, padding: 32, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={28} style={{ color: '#ef4444' }} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', textAlign: 'center', margin: '0 0 8px' }}>Delete Product</h3>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--foreground)' }}>{productToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '2px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
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
