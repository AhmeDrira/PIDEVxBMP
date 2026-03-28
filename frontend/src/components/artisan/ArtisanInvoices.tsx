import React, { useState, useEffect } from 'react';
import { useSubscriptionGuard } from './SubscriptionGuard';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Receipt, Download, Eye, Check, Clock, AlertCircle, ArrowRight, CreditCard, Trash2, Search, Filter, Package, ShoppingBag } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import CheckoutWizard from './CheckoutWizard';
import axios from 'axios';
import { toast } from 'sonner';

export default function ArtisanInvoices() {
  const [view, setView] = useState<'list' | 'create' | 'details' | 'materials-checkout'>('list');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'upcoming'>('all');
  const [materialsCart, setMaterialsCart] = useState<any[]>([]);
  const [isMaterialsCheckoutLoading, setIsMaterialsCheckoutLoading] = useState(false);

  // Stats calculées dynamiquement
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);

  // États du formulaire
  const [formData, setFormData] = useState({
    project: '',
    clientName: '',
    amount: '',
    description: '',
    issueDate: '',
    dueDate: ''
  });

  // États de validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { guard: subGuard, PopupElement: SubPopup } = useSubscriptionGuard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [isPayMaterialLoading, setIsPayMaterialLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  // --- CHARGEMENT DES DONNÉES ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const token = getToken();
        if (!token) return;

        if (view === 'list') {
          const resInvoices = await axios.get(`${API_URL}/invoices`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = resInvoices.data;
          setInvoices(data);

          // Calcul des statistiques
          let rev = 0, pend = 0, over = 0;
          const today = new Date();

          data.forEach((inv: any) => {
            if (inv.status === 'paid') rev += inv.amount;
            else if (inv.status === 'pending') {
              if (new Date(inv.dueDate) < today) {
                over += inv.amount;
              } else {
                pend += inv.amount;
              }
            } else if (inv.status === 'overdue') over += inv.amount;
          });

          setTotalRevenue(rev);
          setPendingAmount(pend);
          setOverdueAmount(over);
        }

        if (view === 'create') {
          const resProjects = await axios.get(`${API_URL}/projects`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setProjects(resProjects.data);
        }
      } catch (error) {
        console.error("Erreur de chargement:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [view, API_URL]);

  // Après tous les useState et autres useEffect
  useEffect(() => {
    if (selectedInvoice) {
      document.title = `Invoice ${selectedInvoice.invoiceNumber} - BMP Marketplace`;
    }
    return () => {
      document.title = 'BMP Marketplace';
    };
  }, [selectedInvoice]);

  useEffect(() => {
    const raw = sessionStorage.getItem('artisan:redirect-toast');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const message = parsed?.message || 'Success';
      const type = parsed?.type || 'success';

      if (type === 'error') toast.error(message);
      else if (type === 'warning') toast.warning(message);
      else toast.success(message);
    } catch {
      toast.success('Operation completed successfully');
    } finally {
      sessionStorage.removeItem('artisan:redirect-toast');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('invoicePayment');
    const sessionId = params.get('session_id');
    const invoiceId = params.get('invoiceId');

    if (!state) return;

    const clearParams = () => {
      const next = new URLSearchParams(window.location.search);
      next.delete('invoicePayment');
      next.delete('session_id');
      next.delete('invoiceId');
      const cleaned = next.toString();
      const nextUrl = `${window.location.pathname}${cleaned ? `?${cleaned}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, '', nextUrl);
    };

    if (state === 'cancel' || state === 'materialsCancel') {
      toast.warning('Payment cancelled. You can continue later.');
      clearParams();
      return;
    }

    // Handle materials payment return
    if (state === 'materialsSuccess' && sessionId && invoiceId) {
      const confirmMaterials = async () => {
        try {
          setIsPayMaterialLoading(true);
          const token = getToken();
          if (!token) return;

          const stored = localStorage.getItem(`artisan-stripe-checkout:${sessionId}`);
          const items = stored ? JSON.parse(stored).items || [] : [];

          await axios.post(
            `${API_URL}/products/checkout/confirm-session`,
            { sessionId, items },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          localStorage.setItem(`materials-paid:${invoiceId}`, 'true');
          localStorage.removeItem(`artisan-stripe-checkout:${sessionId}`);
          toast.success('Materials payment confirmed!');

          // Re-open the invoice detail view
          const token2 = getToken();
          const resInvoices = await axios.get(`${API_URL}/invoices`, {
            headers: { Authorization: `Bearer ${token2}` }
          });
          const all = resInvoices.data;
          setInvoices(all);
          const found = all.find((inv: any) => inv._id === invoiceId);
          if (found) {
            setSelectedInvoice(found);
            setView('details');
          }
        } catch (error: any) {
          console.error('Materials confirm failed:', error?.response?.data || error?.message);
          toast.error(error?.response?.data?.message || 'Failed to confirm materials payment');
        } finally {
          setIsPayMaterialLoading(false);
          clearParams();
        }
      };
      confirmMaterials();
      return;
    }

    if (state !== 'success' || !sessionId) {
      clearParams();
      return;
    }

    const confirm = async () => {
      try {
        setIsPaymentLoading(true);
        const token = getToken();
        if (!token) return;

        const res = await axios.post(
          `${API_URL}/invoices/confirm-payment-session`,
          { sessionId },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const updatedInvoice = res?.data?.invoice;
        if (updatedInvoice) {
          setSelectedInvoice(updatedInvoice);
          setInvoices((prev) => prev.map((item) => (item._id === updatedInvoice._id ? updatedInvoice : item)));
          setView('details');
        }

        window.dispatchEvent(new Event('artisan-invoice-payment-success'));
        toast.success(res?.data?.message || 'Payment successful');
      } catch (error: any) {
        console.error('Invoice confirm-payment-session failed:', error?.response?.data || error?.message);
        toast.error(error?.response?.data?.message || 'Failed to confirm invoice payment');
      } finally {
        setIsPaymentLoading(false);
        clearParams();
      }
    };

    confirm();
  }, [API_URL]);

  // --- VALIDATION DES CHAMPS ---
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'project':
        return !value ? 'Project is required' : '';
      case 'clientName':
        return !value ? 'Client name is required' : '';
      case 'amount':
        if (!value) return 'Amount is required';
        if (isNaN(Number(value)) || Number(value) <= 0) return 'Amount must be a positive number';
        return '';
      case 'description':
        return !value ? 'Description is required' : '';
      case 'issueDate':
        return !value ? 'Issue date is required' : '';
      case 'dueDate':
        if (!value) return 'Due date is required';
        if (formData.issueDate && new Date(value) <= new Date(formData.issueDate)) {
          return 'Due date must be after issue date';
        }
        return '';
      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const fields = ['project', 'clientName', 'amount', 'description', 'issueDate', 'dueDate'];
    for (const field of fields) {
      if (validateField(field, formData[field as keyof typeof formData])) return false;
    }
    return true;
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof typeof formData]);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  // --- CRÉATION DE FACTURE ---
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const token = getToken();
      await axios.post(`${API_URL}/invoices`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Invoice generated successfully!');
      setFormData({ project: '', clientName: '', amount: '', description: '', issueDate: '', dueDate: '' });
      setErrors({});
      setTouched({});
      setView('list');
    } catch (error) {
      console.error("Error creating invoice:", error);
      alert('Failed to create invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFirstTranchePercent = (invoice: any) => {
    return Math.round(Number(invoice?.paymentPlan?.firstTranchePercent) || 50);
  };

  const getSecondTranchePercent = (invoice: any) => {
    return 100 - getFirstTranchePercent(invoice);
  };

  const getPaymentProgress = (invoice: any) => {
    if (!invoice) return 0;
    const upfrontPaid = Boolean(invoice.paymentPlan?.firstTranchePaid);
    const completionPaid = Boolean(invoice.paymentPlan?.secondTranchePaid);
    const invoiceFullyPaid = String(invoice.status || '').toLowerCase() === 'paid';

    if (invoiceFullyPaid || (upfrontPaid && completionPaid)) return 100;
    if (upfrontPaid) return getFirstTranchePercent(invoice);
    return 0;
  };

  const getUpfrontAmount = (invoice: any) => {
    const planAmount = Number(invoice?.paymentPlan?.firstTrancheAmount || 0);
    if (planAmount > 0) return planAmount;
    const total = Number(invoice?.amount || 0);
    const pct = getFirstTranchePercent(invoice) / 100;
    return Number((total * pct).toFixed(2));
  };

  const getCompletionAmount = (invoice: any) => {
    const planAmount = Number(invoice?.paymentPlan?.secondTrancheAmount || 0);
    if (planAmount > 0) return planAmount;
    const total = Number(invoice?.amount || 0);
    return Number((total - getUpfrontAmount(invoice)).toFixed(2));
  };

  const handleStartInstallmentPayment = async (invoiceId: string, phase: 'upfront' | 'completion') => {
    try {
      setIsPaymentLoading(true);
      const token = getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const res = await axios.post(
        `${API_URL}/invoices/${invoiceId}/create-payment-session`,
        { phase },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const checkoutUrl = res?.data?.url;
      if (!checkoutUrl) {
        toast.error('Unable to start payment session');
        return;
      }

      window.location.href = checkoutUrl;
    } catch (error: any) {
      console.error('create invoice payment session failed:', error?.response?.data || error?.message);
      toast.error(error?.response?.data?.message || 'Failed to initialize payment');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const handlePayUpfrontClick = () => {
    if (!selectedInvoice?._id) return;
    handleStartInstallmentPayment(selectedInvoice._id, 'upfront');
  };

  const handlePayCompletionClick = () => {
    if (!selectedInvoice?._id) return;
    handleStartInstallmentPayment(selectedInvoice._id, 'completion');
  };

  const handlePayMaterialsClick = async () => {
    const projectId = selectedInvoice?.project?._id || selectedInvoice?.project;
    if (!projectId) {
      toast.error('No project linked to this invoice');
      return;
    }

    try {
      setIsPayMaterialLoading(true);
      const token = getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const projectsRes = await axios.get(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const project = projectsRes.data.find(
        (p: any) => String(p._id) === String(projectId)
      );

      if (!project) {
        toast.error('Project not found');
        return;
      }

      const materials: any[] = project.materials || [];
      if (!materials.length) {
        toast.error('No materials linked to this project');
        return;
      }

      const cartItems = materials.map((mat: any) => ({
        _id: mat._id,
        name: mat.name,
        price: mat.price || 0,
        quantity: 1,
        image: mat.image || '',
        stock: mat.stock || 999,
        category: mat.category || 'material',
        manufacturer: mat.manufacturer || {},
      }));

      setMaterialsCart(cartItems);
      setView('materials-checkout');
    } catch (error: any) {
      console.error('Load materials failed:', error?.response?.data || error?.message);
      toast.error(error?.response?.data?.message || 'Failed to load project materials');
    } finally {
      setIsPayMaterialLoading(false);
    }
  };

  const handleMaterialsWizardCheckout = async (checkoutData: any) => {
    if (!materialsCart.length || isMaterialsCheckoutLoading) return;
    try {
      setIsMaterialsCheckoutLoading(true);
      const token = getToken();
      if (!token) {
        toast.error('Session expired. Please sign in again.');
        return;
      }

      const checkoutMeta = {
        shippingAddress: {
          fullName: checkoutData.personalInfo.fullName,
          phone: checkoutData.personalInfo.phone,
          ...checkoutData.shippingAddress,
        },
        contactInfo: {
          email: checkoutData.personalInfo.email,
          phone: checkoutData.personalInfo.phone,
        },
        shippingMethod: {
          name: 'Standard Delivery',
          cost: 15,
          estimatedDays: 5,
        },
      };

      const items = materialsCart.map((item: any) => ({
        productId: item._id,
        quantity: item.quantity,
        name: item.name,
        category: item.category || 'material',
        price: item.price,
        stock: item.stock,
        description: item.description || '',
        image: item.image || '',
      }));

      const response = await axios.post(
        `${API_URL}/products/checkout/create-session`,
        { items, invoiceId: selectedInvoice?._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const sessionId = String(response?.data?.sessionId || '').trim();
      const checkoutUrl = response?.data?.url;
      if (!checkoutUrl) {
        toast.error('Unable to initialize Stripe checkout.');
        return;
      }

      if (sessionId) {
        localStorage.setItem(
          `artisan-stripe-checkout:${sessionId}`,
          JSON.stringify({ items, checkoutMeta, createdAt: Date.now() }),
        );
      }

      window.location.href = checkoutUrl;
    } catch (error: any) {
      console.error('Materials checkout failed:', error?.response?.data || error?.message);
      toast.error(error?.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      setIsMaterialsCheckoutLoading(false);
    }
  };

  const updateMaterialsCartQuantity = (productId: string, delta: number) => {
    setMaterialsCart(prev =>
      prev.map(item =>
        item._id === productId
          ? { ...item, quantity: Math.max(1, Math.min(item.stock || 999, item.quantity + delta)) }
          : item
      )
    );
  };

  const handleDownloadInvoicePdf = async (invoice: any) => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await axios.get(`${API_URL}/invoices/${invoice._id}/pdf`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileURL;
      link.download = `${invoice.invoiceNumber || 'invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(fileURL);
    } catch (error: any) {
      console.error('Error downloading invoice PDF:', error);
      const message = error?.response?.data?.message;
      toast.error(message || 'Failed to generate invoice PDF');
    }
  };

  const openDeleteInvoiceModal = (invoice: any) => {
    setInvoiceToDelete(invoice);
    setShowDeleteModal(true);
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete?._id) return;

    setIsDeletingInvoice(true);
    try {
      const token = getToken();
      await axios.delete(`${API_URL}/invoices/${invoiceToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setInvoices((prev) => prev.filter((item) => item._id !== invoiceToDelete._id));
      if (selectedInvoice?._id === invoiceToDelete._id) {
        setSelectedInvoice(null);
        setView('list');
      }

      const deletedNumber = invoiceToDelete.invoiceNumber;
      setShowDeleteModal(false);
      setInvoiceToDelete(null);
      toast.success(`Invoice ${deletedNumber} deleted successfully.`);
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      const message = error?.response?.data?.message;
      toast.error(message || 'Failed to delete invoice');
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  // --- UTILITAIRES DE DESIGN ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'overdue': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <Check size={14} />;
      case 'pending': return <Clock size={14} />;
      case 'overdue': return <AlertCircle size={14} />;
      default: return null;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const invoiceNumber = String(invoice?.invoiceNumber || '').toLowerCase();
    const projectTitle = String(invoice?.project?.title || '').toLowerCase();
    const clientName = String(invoice?.clientName || '').toLowerCase();

    const matchesSearch = !normalizedQuery
      || invoiceNumber.includes(normalizedQuery)
      || projectTitle.includes(normalizedQuery)
      || clientName.includes(normalizedQuery);

    const currentStatus = String(invoice?.status || 'pending').toLowerCase();
    const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter;

    const dueDate = invoice?.dueDate ? new Date(invoice.dueDate) : null;
    const isOverdueByDate = dueDate ? dueDate.getTime() < Date.now() : false;
    const isOverdue = currentStatus === 'overdue' || (currentStatus === 'pending' && isOverdueByDate);
    const matchesDue = dueFilter === 'all' || (dueFilter === 'overdue' ? isOverdue : !isOverdue);

    return matchesSearch && matchesStatus && matchesDue;
  });

  // ==========================================
  // VUE 1 : CRÉATION
  // ==========================================
  if (view === 'create') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setView('list')} className="mb-6 rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Invoices
        </Button>
        <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">Generate New Invoice</h2>
          <form className="space-y-6" onSubmit={handleCreateInvoice}>
            {/* Projet */}
            <div className="space-y-2">
              <Label htmlFor="project" className="text-base font-semibold">
                Select Project <span style={{ color: 'red' }}>*</span>
              </Label>
              <select
                id="project"
                value={formData.project}
                onChange={(e) => {
                  setFormData({ ...formData, project: e.target.value });
                  if (touched.project) setErrors(prev => ({ ...prev, project: validateField('project', e.target.value) }));
                }}
                onBlur={() => handleBlur('project')}
                className={`w-full h-12 px-4 border-2 rounded-xl focus:border-primary focus:outline-none bg-white ${touched.project && errors.project ? 'border-red-500' : 'border-gray-200'}`}
              >
                <option value="">Choose a project...</option>
                {projects.map((proj) => (
                  <option key={proj._id} value={proj._id}>{proj.title}</option>
                ))}
              </select>
              {touched.project && errors.project && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.project}</p>}
            </div>

            {/* Client */}
            <div className="space-y-2">
              <Label htmlFor="client" className="text-base font-semibold">
                Client Name <span style={{ color: 'red' }}>*</span>
              </Label>
              <Input
                id="client"
                value={formData.clientName}
                onChange={(e) => {
                  setFormData({ ...formData, clientName: e.target.value });
                  if (touched.clientName) setErrors(prev => ({ ...prev, clientName: validateField('clientName', e.target.value) }));
                }}
                onBlur={() => handleBlur('clientName')}
                placeholder="Client name"
                className={`h-12 rounded-xl border-2 focus:border-primary ${touched.clientName && errors.clientName ? 'border-red-500' : 'border-gray-200'}`}
              />
              {touched.clientName && errors.clientName && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.clientName}</p>}
            </div>

            {/* Montant */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-base font-semibold">
                Total Amount (TND) <span style={{ color: 'red' }}>*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => {
                  setFormData({ ...formData, amount: e.target.value });
                  if (touched.amount) setErrors(prev => ({ ...prev, amount: validateField('amount', e.target.value) }));
                }}
                onBlur={() => handleBlur('amount')}
                placeholder="0.00"
                className={`h-12 rounded-xl border-2 focus:border-primary ${touched.amount && errors.amount ? 'border-red-500' : 'border-gray-200'}`}
              />
              {touched.amount && errors.amount && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.amount}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">
                Description / Items <span style={{ color: 'red' }}>*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (touched.description) setErrors(prev => ({ ...prev, description: validateField('description', e.target.value) }));
                }}
                onBlur={() => handleBlur('description')}
                placeholder="List items..."
                rows={4}
                className={`rounded-xl border-2 focus:border-primary ${touched.description && errors.description ? 'border-red-500' : 'border-gray-200'}`}
              />
              {touched.description && errors.description && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.description}</p>}
            </div>

            {/* Dates */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Date d'émission */}
              <div className="space-y-2">
                <Label htmlFor="issueDate" className="text-base font-semibold">
                  Issue Date <span style={{ color: 'red' }}>*</span>
                </Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => {
                    setFormData({ ...formData, issueDate: e.target.value });
                    if (touched.issueDate) setErrors(prev => ({ ...prev, issueDate: validateField('issueDate', e.target.value) }));
                    // Revalider dueDate si elle existe
                    if (formData.dueDate) {
                      const dueError = validateField('dueDate', formData.dueDate);
                      setErrors(prev => ({ ...prev, dueDate: dueError }));
                    }
                  }}
                  onBlur={() => handleBlur('issueDate')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.issueDate && errors.issueDate ? 'border-red-500' : 'border-gray-200'}`}
                />
                {touched.issueDate && errors.issueDate && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.issueDate}</p>}
              </div>

              {/* Date d'échéance */}
              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-base font-semibold">
                  Due Date <span style={{ color: 'red' }}>*</span>
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => {
                    setFormData({ ...formData, dueDate: e.target.value });
                    if (touched.dueDate) setErrors(prev => ({ ...prev, dueDate: validateField('dueDate', e.target.value) }));
                  }}
                  onBlur={() => handleBlur('dueDate')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.dueDate && errors.dueDate ? 'border-red-500' : 'border-gray-200'}`}
                />
                {touched.dueDate && errors.dueDate && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.dueDate}</p>}
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !validateForm()}
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Generating...' : 'Generate Invoice'}
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
  // VUE : MATERIALS CHECKOUT WIZARD
  // ==========================================
  if (view === 'materials-checkout' && materialsCart.length > 0) {
    return (
      <CheckoutWizard
        cart={materialsCart}
        onBack={() => { setView('details'); setMaterialsCart([]); }}
        onCheckout={handleMaterialsWizardCheckout}
        isLoading={isMaterialsCheckoutLoading}
        getManufacturerName={(item: any) => item.manufacturer?.companyName || item.manufacturer?.firstName || 'Supplier'}
        updateCartQuantity={updateMaterialsCartQuantity}
      />
    );
  }

  // ==========================================
  // VUE 2 : DÉTAILS DE LA FACTURE
  // ==========================================
  if (view === 'details' && selectedInvoice) {
    const progress = getPaymentProgress(selectedInvoice);
    const upfrontAmount = getUpfrontAmount(selectedInvoice);
    const completionAmount = getCompletionAmount(selectedInvoice);
    const invoiceMarkedPaid = String(selectedInvoice.status || '').toLowerCase() === 'paid' || progress >= 100;
    const upfrontPaid = Boolean(selectedInvoice.paymentPlan?.firstTranchePaid) || invoiceMarkedPaid;
    const completionPaid = Boolean(selectedInvoice.paymentPlan?.secondTranchePaid) || invoiceMarkedPaid;
    const materialsPaid = localStorage.getItem(`materials-paid:${selectedInvoice._id}`) === 'true';

    const handleMarkTranche = async (phase: 'upfront' | 'completion') => {
      try {
        setIsPaymentLoading(true);
        const token = getToken();
        if (!token) return;
        const res = await axios.patch(
          `${API_URL}/invoices/${selectedInvoice._id}/mark-tranche-paid`,
          { phase },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const updated = res.data?.invoice;
        if (updated) {
          setSelectedInvoice(updated);
          setInvoices(prev => prev.map(inv => inv._id === updated._id ? updated : inv));
        }
        toast.success(res.data?.message || 'Tranche marked as received');
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to update tranche');
      } finally {
        setIsPaymentLoading(false);
      }
    };

    const firstPct = getFirstTranchePercent(selectedInvoice);
    const secondPct = getSecondTranchePercent(selectedInvoice);

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header — Back + Buy Materials */}
        <div className="flex flex-wrap justify-between items-center gap-3 print:hidden">
          <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Invoices
          </Button>
          {materialsPaid ? (
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold cursor-not-allowed shadow-sm"
              style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1.5px solid #a7f3d0' }}
            >
              <Check size={16} />
              Materials Purchased
            </button>
          ) : (
            <button
              onClick={handlePayMaterialsClick}
              disabled={isPayMaterialLoading}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold hover:shadow-md active:scale-[0.97] transition-all duration-150 disabled:opacity-60 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white' }}
            >
              <ShoppingBag size={16} />
              {isPayMaterialLoading ? 'Loading...' : 'Buy Materials'}
            </button>
          )}
        </div>

        {/* ── Payment Progress Card ── */}
        <div className="rounded-2xl overflow-hidden shadow-lg print:hidden" style={{ backgroundColor: '#ffffff' }}>

          {/* ── Header with progress bar ── */}
          <div style={{ padding: '28px 32px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>Payment Progress</h3>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: progress >= 100 ? '#10b981' : '#7c3aed',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {progress}%
              </span>
            </div>

            {/* Single smooth progress bar */}
            <div style={{ height: 10, backgroundColor: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  borderRadius: 999,
                  background: progress >= 100
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                  transition: 'width 0.7s ease-out',
                }}
              />
            </div>

            {/* Marker labels below bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>0%</span>
              <span style={{ fontSize: 12, color: '#6b7280', position: 'relative', left: `${firstPct - 50}%` }}>{firstPct}%</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>100%</span>
            </div>
          </div>

          {/* ── Tranche cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #f3f4f6' }}>

            {/* Tranche 1 */}
            <div style={{
              padding: '28px 32px',
              borderRight: '1px solid #f3f4f6',
              backgroundColor: upfrontPaid ? '#f0fdf4' : '#fff',
            }}>
              {/* Top row: number + badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: upfrontPaid ? '#10b981' : '#7c3aed',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                  }}>
                    {upfrontPaid ? <Check size={18} /> : '1'}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: 0 }}>Upfront</p>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>First payment</p>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                  backgroundColor: upfrontPaid ? '#d1fae5' : '#f5f3ff',
                  color: upfrontPaid ? '#065f46' : '#7c3aed',
                }}>
                  {upfrontPaid ? 'Received' : 'Pending'}
                </span>
              </div>

              {/* Amount */}
              <p style={{ fontSize: 26, fontWeight: 800, color: '#1f2937', margin: '0 0 2px' }}>
                {upfrontAmount.toLocaleString('en', { minimumFractionDigits: 2 })} <span style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af' }}>TND</span>
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
                {firstPct}% of {selectedInvoice.amount?.toLocaleString()} TND
              </p>

              {/* Action / status */}
              {upfrontPaid ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, backgroundColor: '#d1fae5' }}>
                  <Check size={16} style={{ color: '#059669' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#065f46' }}>
                    {selectedInvoice.paymentPlan?.firstTranchePaidAt
                      ? `Received ${formatDate(selectedInvoice.paymentPlan.firstTranchePaidAt)}`
                      : 'Payment received'}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => handleMarkTranche('upfront')}
                  disabled={isPaymentLoading}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: '#7c3aed', color: '#fff', fontSize: 14, fontWeight: 700,
                    opacity: isPaymentLoading ? 0.5 : 1, transition: 'opacity 0.15s',
                  }}
                >
                  {isPaymentLoading
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle" />Saving...</>
                    : <><Check size={15} className="inline mr-1.5 align-middle" />Mark as Received</>
                  }
                </button>
              )}
            </div>

            {/* Tranche 2 */}
            <div style={{
              padding: '28px 32px',
              backgroundColor: completionPaid ? '#f0fdf4' : !upfrontPaid ? '#fafafa' : '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: completionPaid ? '#10b981' : !upfrontPaid ? '#d1d5db' : '#7c3aed',
                    color: !upfrontPaid && !completionPaid ? '#6b7280' : '#fff',
                    fontSize: 14, fontWeight: 700,
                  }}>
                    {completionPaid ? <Check size={18} /> : '2'}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: !upfrontPaid && !completionPaid ? '#9ca3af' : '#1f2937', margin: 0 }}>Completion</p>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Final payment</p>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                  backgroundColor: completionPaid ? '#d1fae5' : !upfrontPaid ? '#f3f4f6' : '#f5f3ff',
                  color: completionPaid ? '#065f46' : !upfrontPaid ? '#9ca3af' : '#7c3aed',
                }}>
                  {completionPaid ? 'Received' : !upfrontPaid ? 'Locked' : 'Ready'}
                </span>
              </div>

              <p style={{ fontSize: 26, fontWeight: 800, color: !upfrontPaid && !completionPaid ? '#9ca3af' : '#1f2937', margin: '0 0 2px' }}>
                {completionAmount.toLocaleString('en', { minimumFractionDigits: 2 })} <span style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af' }}>TND</span>
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
                {secondPct}% of {selectedInvoice.amount?.toLocaleString()} TND
              </p>

              {completionPaid ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, backgroundColor: '#d1fae5' }}>
                  <Check size={16} style={{ color: '#059669' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#065f46' }}>
                    {selectedInvoice.paymentPlan?.secondTranchePaidAt
                      ? `Received ${formatDate(selectedInvoice.paymentPlan.secondTranchePaidAt)}`
                      : 'Payment received'}
                  </span>
                </div>
              ) : !upfrontPaid ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: 16 }}>🔒</span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Pay first tranche to unlock</span>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => handleMarkTranche('completion')}
                    disabled={isPaymentLoading}
                    style={{
                      width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: '#7c3aed', color: '#fff', fontSize: 14, fontWeight: 700,
                      opacity: isPaymentLoading ? 0.5 : 1, transition: 'opacity 0.15s',
                    }}
                  >
                    {isPaymentLoading
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle" />Saving...</>
                      : <><Check size={15} className="inline mr-1.5 align-middle" />Mark as Received</>
                    }
                  </button>
                  {selectedInvoice.paymentPlan?.secondTrancheDueDate && (
                    <p style={{ fontSize: 12, fontWeight: 500, padding: '8px 12px', borderRadius: 8, marginTop: 12, backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
                      Due by {formatDate(selectedInvoice.paymentPlan.secondTrancheDueDate)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Carte de facture améliorée */}
        <Card id="invoice-card" className="p-10 bg-white rounded-2xl border-0 shadow-lg print:shadow-none print:m-0 print:border">
          {/* En-tête */}
          <div className="flex justify-between items-start mb-10">
            <div>
              <h1 className="text-4xl font-bold text-primary mb-2">INVOICE</h1>
              <p className="text-muted-foreground font-mono">{selectedInvoice.invoiceNumber}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground">BMP Marketplace</p>
              <p className="text-muted-foreground">Tunisia</p>
            </div>
          </div>

          {/* Badge de statut */}
          <div className="flex justify-end mb-6">
            <Badge className={`${getStatusColor(selectedInvoice.status)} px-4 py-2 text-sm font-semibold flex items-center gap-2`}>
              {getStatusIcon(selectedInvoice.status)}
              {selectedInvoice.status === 'paid' ? 'Paid' : selectedInvoice.status === 'pending' ? 'Pending' : 'Overdue'}
            </Badge>
          </div>

          {/* Infos client et dates */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-foreground mb-2 border-b pb-1">Billed To:</h4>
              <p className="font-semibold text-lg">{selectedInvoice.clientName}</p>
              <p className="text-muted-foreground">Project: {selectedInvoice.project?.title || 'Unknown Project'}</p>
            </div>
            <div className="space-y-2 text-right">
              <p><span className="font-medium text-muted-foreground">Issue Date:</span> <span className="font-semibold">{formatDate(selectedInvoice.issueDate)}</span></p>
              <p><span className="font-medium text-muted-foreground">Due Date:</span> <span className="font-semibold">{formatDate(selectedInvoice.dueDate)}</span></p>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8 bg-gray-50 p-6 rounded-xl border">
            <h4 className="font-bold text-foreground mb-4">Description of Work / Items:</h4>
            <p className="whitespace-pre-wrap text-muted-foreground">{selectedInvoice.description}</p>
          </div>

          {/* Montant total */}
          <div className="flex justify-end border-t-2 pt-6">
            <div className="text-right">
              <p className="text-muted-foreground font-medium mb-1">Total Amount Due</p>
              <p className="text-4xl font-bold text-primary">{selectedInvoice.amount.toLocaleString()} TND</p>
              <p className="text-sm text-muted-foreground mt-1">Paid: {Number(selectedInvoice.paidAmount || 0).toFixed(2)} TND</p>
              <p className="text-sm text-muted-foreground mt-1">
                {new Intl.NumberFormat('en-TN', { style: 'currency', currency: 'TND' }).format(selectedInvoice.amount)}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  
  // ==========================================
  // VUE 3 : LISTE PRINCIPALE
  // ==========================================
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Invoices</h1>
          <p className="text-lg text-muted-foreground">Manage project invoices and payments</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <StatsCard label="Total Revenue" value={`${totalRevenue.toLocaleString()} TND`} icon={<Check size={28} />} color="#10B981" trend="Paid" trendUp={true} />
        <StatsCard label="Pending" value={`${pendingAmount.toLocaleString()} TND`} icon={<Clock size={28} />} color="#F59E0B" subtitle="Awaiting payment" />
        <StatsCard label="Overdue" value={`${overdueAmount.toLocaleString()} TND`} icon={<AlertCircle size={28} />} color="#EF4444" subtitle="Needs attention" />
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
          <div className="flex-1 h-12 rounded-xl border-2 border-gray-200 bg-white px-3 flex items-center gap-2">
            <Search className="text-muted-foreground shrink-0" size={18} />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-full px-0"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:w-auto">
            <div className="h-12 rounded-xl border-2 border-gray-200 bg-white px-3 flex items-center gap-2 min-w-[170px] overflow-hidden focus-within:border-gray-300 transition-colors">
              <Filter className="text-muted-foreground shrink-0" size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'pending' | 'overdue')}
                className="h-full w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0 outline-none cursor-pointer"
                style={{ WebkitAppearance: 'none', appearance: 'none', background: 'transparent' }}
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div className="h-12 rounded-xl border-2 border-gray-200 bg-white px-3 flex items-center min-w-[170px] overflow-hidden focus-within:border-gray-300 transition-colors">
              <select
                value={dueFilter}
                onChange={(e) => setDueFilter(e.target.value as 'all' | 'overdue' | 'upcoming')}
                className="h-full w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0 outline-none cursor-pointer"
                style={{ WebkitAppearance: 'none', appearance: 'none', background: 'transparent' }}
              >
                <option value="all">All Due</option>
                <option value="overdue">Overdue Due Date</option>
                <option value="upcoming">Upcoming Due Date</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Liste des factures */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-10">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-lg border border-gray-100">
            <Receipt className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-xl font-semibold text-gray-500">No invoices found.</p>
          </div>
        ) : (
          filteredInvoices.map((invoice) => (
            <Card key={invoice._id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xl font-bold text-foreground">{invoice.invoiceNumber}</h3>
                    <Badge className={`${getStatusColor(invoice.status)} px-4 py-1.5 text-sm font-semibold flex items-center gap-2 border-2`}>
                      {getStatusIcon(invoice.status)}
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="mb-2 text-muted-foreground">
                    <strong className="text-foreground">Project:</strong> {invoice.project?.title || 'Unknown Project'}
                  </p>
                  <p className="text-muted-foreground mb-4">
                    <strong className="text-foreground">Client:</strong> {invoice.clientName}
                  </p>
                  <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                    <span>Due: <strong className="text-foreground">{formatDate(invoice.dueDate)}</strong></span>
                    {invoice.status === 'paid' && <span>Paid on: <strong className="text-accent">{formatDate(invoice.updatedAt)}</strong></span>}
                    <span>Paid: <strong className="text-foreground">{getPaymentProgress(invoice)}%</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground font-medium mb-2">Amount</p>
                    <p className="text-3xl font-bold text-primary">
                      {invoice.amount.toLocaleString()} TND
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-2 h-10 hover:bg-primary hover:text-white"
                      onClick={() => subGuard(() => { setSelectedInvoice(invoice); setView('details'); })}
                    >
                      <Eye size={16} className="mr-2" /> View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-2 h-10 hover:bg-accent hover:text-white"
                      onClick={() => handleDownloadInvoicePdf(invoice)}
                    >
                      <Download size={16} className="mr-2" /> PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-2 h-10 hover:bg-red-600 hover:text-white"
                      onClick={() => openDeleteInvoiceModal(invoice)}
                    >
                      <Trash2 size={16} className="mr-2" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] pointer-events-auto">
          <div className="mx-4 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} className="text-red-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2">Delete Invoice?</h3>
                <p className="text-gray-600 font-medium">{invoiceToDelete?.invoiceNumber || ''}</p>
                <p className="text-sm text-gray-500 mt-2">Are you sure you want to delete this invoice?</p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setInvoiceToDelete(null);
                  }}
                  disabled={isDeletingInvoice}
                >
                  Non
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                  onClick={handleDeleteInvoice}
                  disabled={isDeletingInvoice}
                >
                  {isDeletingInvoice ? 'Oui...' : 'Oui'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {SubPopup}
    </div>
  );
}