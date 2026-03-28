import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, FileText, Download, Eye, Clock, CheckCircle, XCircle, ArrowRight, ShoppingCart, FolderKanban, Trash2, Search, Filter } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import axios from 'axios';
import { toast } from 'sonner';
import { useSubscriptionGuard } from './SubscriptionGuard';

export default function ArtisanQuotes() {
  const { guard, PopupElement } = useSubscriptionGuard();
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [selectedQuote, setSelectedQuote] = useState<any>(null);

  const [quotes, setQuotes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectFromQuery, setProjectFromQuery] = useState<string | null>(null);
  const [showAllMaterials, setShowAllMaterials] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showDeleteQuoteModal, setShowDeleteQuoteModal] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<any>(null);
  const [isDeletingQuote, setIsDeletingQuote] = useState(false);
  const [deleteQuoteError, setDeleteQuoteError] = useState<string | null>(null);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceTargetQuote, setInvoiceTargetQuote] = useState<any>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'withInvoice' | 'withoutInvoice'>('all');

  const todayLocalDate = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();

  const [formData, setFormData] = useState({
    project: '',
    clientName: '',
    laborHand: '',
    description: '',
    validUntil: '',
    paymentType: 'percentage' as 'percentage' | 'fixed',
    upfrontValue: ''
  });

  // États pour la validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const invoiceSectionRef = useRef<HTMLDivElement | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const isProjectEligibleForQuote = (project: any) => {
    const numericProgress = Number(project?.progress ?? 0);
    const isCompletedByStatus = String(project?.status || '').toLowerCase() === 'completed';
    const isCompletedByProgress = Number.isFinite(numericProgress) && numericProgress >= 100;
    return !isCompletedByStatus && !isCompletedByProgress;
  };

  const availableProjects = projects.filter(isProjectEligibleForQuote);

  const selectedProject = projects.find((proj) => proj._id === formData.project);
  const groupedMaterials = Array.isArray(selectedProject?.materials)
    ? Object.values(
        selectedProject.materials.reduce((acc: Record<string, { item: any; quantity: number }>, mat: any) => {
          const matId = String((mat && (mat._id || mat)) || '');
          if (!matId) return acc;
          if (!acc[matId]) {
            acc[matId] = { item: mat, quantity: 0 };
          }
          acc[matId].quantity += 1;
          return acc;
        }, {})
      )
    : [];
  const materialsAmount = Array.isArray(selectedProject?.materials)
    ? selectedProject.materials.reduce((sum: number, item: any) => {
        const price = Number(item?.price);
        return sum + (Number.isFinite(price) ? price : 0);
      }, 0)
    : 0;
  const laborHandAmount = Number(formData.laborHand || 0);
  const totalAmount = (Number.isFinite(laborHandAmount) ? laborHandAmount : 0) + materialsAmount;
  const upfrontRaw = Number(formData.upfrontValue || 0);
  const upfrontAmount = formData.paymentType === 'percentage'
    ? (Number.isFinite(upfrontRaw) ? (totalAmount * upfrontRaw) / 100 : 0)
    : (Number.isFinite(upfrontRaw) ? upfrontRaw : 0);
  const safeUpfrontAmount = Math.min(Math.max(upfrontAmount, 0), totalAmount);
  const uponCompletionAmount = Math.max(totalAmount - safeUpfrontAmount, 0);
  const upfrontPercentage = totalAmount > 0 ? (safeUpfrontAmount / totalAmount) * 100 : 0;
  const uponCompletionPercentage = Math.max(100 - upfrontPercentage, 0);

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  const showOverlayToast = (msg: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const persistRedirectToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    sessionStorage.setItem(
      'artisan:redirect-toast',
      JSON.stringify({ message, type })
    );
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingProjectId = params.get('projectId');
    if (incomingProjectId) {
      setProjectFromQuery(incomingProjectId);
      setView('create');
    }
  }, []);

  // --- CHARGEMENT DES DONNÉES ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const token = getToken();
        if (!token) return;

        if (view === 'list') {
          const resQuotes = await axios.get(`${API_URL}/quotes`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setQuotes(resQuotes.data);
        }

        if (view === 'create') {
          const resProjects = await axios.get(`${API_URL}/projects`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setProjects(resProjects.data);

          if (projectFromQuery) {
            const exists = resProjects.data.some((proj: any) => proj._id === projectFromQuery && isProjectEligibleForQuote(proj));
            if (exists) {
              setFormData((prev) => ({ ...prev, project: prev.project || projectFromQuery }));
            }
          }
        }
      } catch (error) {
        console.error("Erreur de chargement:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [view, API_URL, projectFromQuery]);

  // After the main useEffect for data fetching
  useEffect(() => {
    if (selectedQuote) {
      document.title = `Quote ${selectedQuote.quoteNumber} - BMP Marketplace`;
    }
    return () => {
      document.title = 'BMP Marketplace'; // Reset to default
    };
  }, [selectedQuote]);  

  // --- FONCTIONS DE VALIDATION ---
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'project': {
        if (!value) return 'Project is required';
        if (!availableProjects.some((proj) => proj._id === value)) return 'Selected project is already completed';
        const projForQuote = projects.find((proj) => proj._id === value);
        if (!projForQuote?.materials?.length) return 'The selected project must have at least one material before creating a quote';
        return '';
      }
      case 'clientName':
        return !value ? 'Client name is required' : '';
      case 'laborHand':
        if (value === '' || value === null || value === undefined) return 'Labor hand is required';
        if (isNaN(Number(value)) || Number(value) < 0) return 'Labor hand must be a non-negative number';
        return '';
      case 'paymentType':
        if (!['percentage', 'fixed'].includes(String(value))) return 'Payment mode is required';
        return '';
      case 'upfrontValue': {
        if (value === '' || value === null || value === undefined) return 'Upfront value is required';
        const upfront = Number(value);
        if (!Number.isFinite(upfront) || upfront <= 0) return 'Upfront must be a positive number';
        if (formData.paymentType === 'percentage' && upfront > 100) return 'Upfront percentage cannot exceed 100%';
        if (formData.paymentType === 'fixed' && upfront > totalAmount) return 'Upfront amount cannot exceed total amount';
        return '';
      }
      case 'description':
        if (!value) return 'Description is required';
        if (value.length < 10) return 'Description must be at least 10 characters';
        return '';
      case 'validUntil':
        if (!value) return 'Valid until date is required';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const validDate = new Date(value);
        if (validDate <= today) return 'Valid until must be a future date';
        return '';
      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const fields = ['project', 'clientName', 'laborHand', 'description', 'validUntil', 'paymentType', 'upfrontValue'];
    for (const field of fields) {
      if (validateField(field, formData[field as keyof typeof formData])) return false;
    }
    if (totalAmount <= 0) return false;
    // PaymentTerms est optionnel, on ne le valide pas pour le form valide
    return true;
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof typeof formData]);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  // --- CRÉATION DE DEVIS ---
  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const token = getToken();
      const paymentTermsSummary =
        `Mode: ${formData.paymentType === 'percentage' ? 'Percentage (%)' : 'Fixed Amount'} | ` +
        `Upfront: ${upfrontPercentage.toFixed(2)}% (${safeUpfrontAmount.toFixed(2)} TND) | ` +
        `Upon Completion: ${uponCompletionPercentage.toFixed(2)}% (${uponCompletionAmount.toFixed(2)} TND)`;

      await axios.post(`${API_URL}/quotes`, {
        ...formData,
        laborHand: Number(formData.laborHand || 0),
        materialsAmount,
        paymentTerms: paymentTermsSummary,
        upfrontPercent: upfrontPercentage,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Quote generated successfully!');
      setFormData({
        project: '',
        clientName: '',
        laborHand: '',
        description: '',
        validUntil: '',
        paymentType: 'percentage',
        upfrontValue: ''
      });
      setErrors({});
      setTouched({});
      setView('list');
    } catch (error) {
      console.error("Error creating quote:", error);
      alert('Failed to create quote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- METTRE À JOUR LE STATUT (Approved / Rejected) ---
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const token = getToken();
      const response = await axios.put(`${API_URL}/quotes/${id}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuotes((prev) => prev.map((quote) => (quote._id === id ? { ...quote, status: newStatus } : quote)));
      if (selectedQuote?._id === id) {
        setSelectedQuote({ ...selectedQuote, ...response.data, status: newStatus });
      }
      toast.success(`Quote marked as ${newStatus}!`);

      if (newStatus === 'approved' && selectedQuote?._id === id) {
        setTimeout(() => {
          invoiceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    } catch (error: any) {
      console.error("Error updating status:", error);
      const backendMessage = error?.response?.data?.message;
      toast.error(backendMessage || 'Failed to update quote status');
    }
  };

  const handleDownloadQuotePdf = async (quote: any) => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await axios.get(`${API_URL}/quotes/${quote._id}/pdf`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileURL;
      link.download = `${quote.quoteNumber || 'quote'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(fileURL);
    } catch (error) {
      console.error('Error downloading quote PDF:', error);
      toast.error('Failed to generate quote PDF');
    }
  };

  const handleGenerateInvoiceFromQuote = async () => {
    const targetQuote = invoiceTargetQuote || selectedQuote;
    if (!targetQuote?._id) return;
    if (!invoiceDueDate) {
      showOverlayToast('Please choose a due date', 'warning');
      return;
    }

    setIsGeneratingInvoice(true);
    try {
      const token = getToken();
      await axios.post(
        `${API_URL}/invoices/from-quote/${targetQuote._id}`,
        { dueDate: invoiceDueDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowInvoiceModal(false);
      setInvoiceDueDate('');
      setInvoiceTargetQuote(null);
      showOverlayToast('Invoice generated successfully', 'success');
      persistRedirectToast('Invoice generated successfully', 'success');
      setTimeout(() => {
        window.location.href = '/?artisanView=invoices';
      }, 1200);
    } catch (error: any) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.message;

      // Fallback for environments still running an older backend without from-quote route.
      if (status === 404) {
        try {
          const token = getToken();
          const issueDate = new Date().toISOString().split('T')[0];
          await axios.post(
            `${API_URL}/invoices`,
            {
              project: targetQuote.project?._id || targetQuote.project,
              clientName: targetQuote.clientName || 'Client',
              amount: Number(targetQuote.amount || 0),
              description: `Invoice generated from quote ${targetQuote.quoteNumber}.\n\n${targetQuote.description || ''}`,
              issueDate,
              dueDate: invoiceDueDate,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          setShowInvoiceModal(false);
          setInvoiceDueDate('');
          setInvoiceTargetQuote(null);
          showOverlayToast('Invoice generated successfully', 'success');
          persistRedirectToast('Invoice generated successfully', 'success');
          setTimeout(() => {
            window.location.href = '/?artisanView=invoices';
          }, 1200);
          return;
        } catch (fallbackError: any) {
          const fallbackMessage = fallbackError?.response?.data?.message;
          showOverlayToast(fallbackMessage || 'Failed to generate invoice', 'error');
          return;
        }
      }

      if (status === 409) {
        showOverlayToast('Invoice already exists for this quote', 'warning');
      } else {
        showOverlayToast(backendMessage || 'Failed to generate invoice from quote', 'error');
      }
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const openGenerateInvoiceModal = (quote: any) => {
    setInvoiceTargetQuote(quote);
    setInvoiceDueDate('');
    setShowInvoiceModal(true);
  };

  const openDeleteQuoteModal = (quote: any) => {
    setQuoteToDelete(quote);
    setDeleteQuoteError(null);
    setShowDeleteQuoteModal(true);
  };

  const handleDeleteQuote = async () => {
    if (!quoteToDelete?._id) return;

    setIsDeletingQuote(true);
    try {
      const token = getToken();
      await axios.delete(`${API_URL}/quotes/${quoteToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const deletedNumber = quoteToDelete.quoteNumber;
      setQuotes((prev) => prev.filter((item) => item._id !== quoteToDelete._id));
      if (selectedQuote?._id === quoteToDelete._id) {
        setSelectedQuote(null);
        setView('list');
      }

      setShowDeleteQuoteModal(false);
      setQuoteToDelete(null);
      showOverlayToast(`Quote ${deletedNumber} deleted successfully.`, 'success');
    } catch (error: any) {
      console.error('Error deleting quote:', error);
      const message = error?.response?.data?.message || 'Failed to delete quote';
      setDeleteQuoteError(message);
    } finally {
      setIsDeletingQuote(false);
    }
  };

  const renderToast = () => {
    if (!toastMessage) return null;

    const styleByType = {
      success: 'bg-black text-white border border-zinc-900',
      warning: 'bg-amber-700 text-white border border-amber-800',
      error: 'bg-red-700 text-white border border-red-800',
    } as const;

    return (
      <div className="w-full px-3 md:px-6 flex justify-center pointer-events-none">
        <div className={`w-full max-w-md text-center px-5 py-3 rounded-xl shadow-2xl flex items-center justify-center gap-2 font-semibold ${styleByType[toastType]} transition-transform duration-200`}>
          <CheckCircle size={18} className="shrink-0 text-white" />
          <span>{toastMessage}</span>
        </div>
      </div>
    );
  };

  const renderInvoiceConfirmBar = () => (
    showInvoiceModal ? (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] pointer-events-auto">
        <div className="mx-4 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={32} className="text-gray-600" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Generate Invoice?</h3>
              <p className="text-gray-600 font-medium">{invoiceTargetQuote?.quoteNumber || selectedQuote?.quoteNumber}</p>
            </div>

            <div className="space-y-2 mb-6">
              <Label htmlFor="dueDateOverlay" className="text-base">Due Date</Label>
              <Input
                id="dueDateOverlay"
                type="date"
                min={todayLocalDate}
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                className="h-12 rounded-xl border-2 border-gray-200"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                onClick={() => {
                  setShowInvoiceModal(false);
                  setInvoiceDueDate('');
                  setInvoiceTargetQuote(null);
                }}
                disabled={isGeneratingInvoice}
              >
                Non
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                onClick={handleGenerateInvoiceFromQuote}
                disabled={isGeneratingInvoice}
              >
                {isGeneratingInvoice ? 'Oui...' : 'Oui'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    ) : null
  );

  const renderDeleteQuoteConfirmBar = () => (
    showDeleteQuoteModal ? (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] pointer-events-auto">
        <div className="mx-4 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${deleteQuoteError ? 'bg-amber-50' : 'bg-red-50'}`}>
                <Trash2 size={32} className={deleteQuoteError ? 'text-amber-600' : 'text-red-600'} />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Delete Quote?</h3>
              <p className="text-gray-600 font-medium">{quoteToDelete?.quoteNumber || ''}</p>
              {deleteQuoteError ? (
                <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium text-left">
                  ⚠️ {deleteQuoteError}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-2">Are you sure you want to delete this quote?</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                onClick={() => {
                  setShowDeleteQuoteModal(false);
                  setQuoteToDelete(null);
                  setDeleteQuoteError(null);
                }}
                disabled={isDeletingQuote}
              >
                {deleteQuoteError ? 'Close' : 'Cancel'}
              </Button>
              {!deleteQuoteError && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-2 border-red-200 bg-white text-red-600 font-semibold hover:bg-red-50 hover:border-red-300 transition-all"
                  onClick={handleDeleteQuote}
                  disabled={isDeletingQuote}
                >
                  {isDeletingQuote ? 'Deleting...' : 'Delete'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : null
  );

  const renderGlobalOverlay = () => {
    if (typeof document === 'undefined') return null;
    if (!toastMessage && !showInvoiceModal && !showDeleteQuoteModal) return null;

    return createPortal(
      <>
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none">
            {renderToast()}
          </div>
        )}
        {renderInvoiceConfirmBar()}
        {renderDeleteQuoteConfirmBar()}
      </>,
      document.body
    );
  };

  // --- DESIGN & UTILITAIRES ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-accent/10 text-accent border-accent/20';
      case 'pending': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle size={20} />;
      case 'pending': return <Clock size={20} />;
      case 'rejected': return <XCircle size={20} />;
      default: return null;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatAmount = (value: number) => `${value.toLocaleString()} TND`;

  const filteredQuotes = quotes.filter((quote) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const quoteNumber = String(quote?.quoteNumber || '').toLowerCase();
    const projectTitle = String(quote?.project?.title || '').toLowerCase();
    const clientName = String(quote?.clientName || '').toLowerCase();

    const matchesSearch = !normalizedQuery
      || quoteNumber.includes(normalizedQuery)
      || projectTitle.includes(normalizedQuery)
      || clientName.includes(normalizedQuery);

    const quoteStatus = String(quote?.status || 'pending').toLowerCase();
    const matchesStatus = statusFilter === 'all' || quoteStatus === statusFilter;

    const hasInvoice = Boolean(quote?.hasInvoice);
    const matchesInvoiceFilter =
      invoiceFilter === 'all'
      || (invoiceFilter === 'withInvoice' && hasInvoice)
      || (invoiceFilter === 'withoutInvoice' && !hasInvoice);

    return matchesSearch && matchesStatus && matchesInvoiceFilter;
  });

  // ==========================================
  // VUE 1 : CRÉATION
  // ==========================================
  if (view === 'create') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setView('list')} className="mb-6 rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Quotes
        </Button>
        <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">Generate New Quote</h2>
          <form className="space-y-6" onSubmit={handleCreateQuote}>
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
                className={`w-full h-12 px-4 border-2 rounded-xl focus:border-primary focus:outline-none bg-white ${
                  touched.project && errors.project ? 'border-red-500' : 'border-gray-200'
                }`}
              >
                <option value="">Choose a project...</option>
                {availableProjects.map((proj) => (
                  <option key={proj._id} value={proj._id}>{proj.title}</option>
                ))}
              </select>
              {availableProjects.length === 0 && (
                <p className="text-sm text-muted-foreground">No active projects available for quotes.</p>
              )}
              {touched.project && errors.project && (
                <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.project}</p>
              )}
            </div>

            {/* Client */}
            <div className="space-y-2">
              <Label htmlFor="clientName" className="text-base font-semibold">
                Client Name <span style={{ color: 'red' }}>*</span>
              </Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => {
                  setFormData({ ...formData, clientName: e.target.value });
                  if (touched.clientName) setErrors(prev => ({ ...prev, clientName: validateField('clientName', e.target.value) }));
                }}
                onBlur={() => handleBlur('clientName')}
                placeholder="Client full name"
                className={`h-12 rounded-xl border-2 focus:border-primary ${
                  touched.clientName && errors.clientName ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {touched.clientName && errors.clientName && (
                <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.clientName}</p>
              )}
            </div>

            {/* Amount split */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="laborHand" className="text-base font-semibold">
                  Labor hand (TND) <span style={{ color: 'red' }}>*</span>
                </Label>
                <Input
                  id="laborHand"
                  type="number"
                  min={0}
                  value={formData.laborHand}
                  onChange={(e) => {
                    setFormData({ ...formData, laborHand: e.target.value });
                    if (touched.laborHand) setErrors(prev => ({ ...prev, laborHand: validateField('laborHand', e.target.value) }));
                  }}
                  onBlur={() => handleBlur('laborHand')}
                  placeholder="0.00"
                  className={`h-12 rounded-xl border-2 focus:border-primary ${
                    touched.laborHand && errors.laborHand ? 'border-red-500' : 'border-gray-200'
                  }`}
                />
                {touched.laborHand && errors.laborHand && (
                  <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.laborHand}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">Materials from project (TND)</Label>
                <div className="h-12 rounded-xl border-2 border-gray-200 bg-gray-50 px-3 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg border-2"
                    disabled={!selectedProject}
                    onClick={() => setShowAllMaterials((prev) => !prev)}
                  >
                    <FolderKanban size={14} className="mr-2" />
                    {showAllMaterials ? 'Hide materials' : 'View All materials'}
                  </Button>
                  <span className="text-lg font-bold text-primary">{formatAmount(materialsAmount)}</span>
                </div>
                {showAllMaterials && (
                  <div className="rounded-xl border border-gray-200 bg-white p-3 max-h-48 overflow-auto">
                    {groupedMaterials.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No materials added to this project yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {groupedMaterials.map((entry: any, index: number) => (
                          <div key={String(entry.item?._id || index)} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                            <p className="text-sm font-medium text-foreground truncate pr-2">{entry.item?.name || 'Material'}</p>
                            <p className="text-sm text-muted-foreground whitespace-nowrap">
                              x{entry.quantity} • {formatAmount(Number(entry.item?.price || 0) * entry.quantity)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedProject && materialsAmount <= 0 && (
              <Card className="p-4 border-amber-200 bg-amber-50 rounded-xl">
                <p className="text-sm text-amber-800 mb-3">
                  This project has no materials yet. Use the same project flow to add materials, then come back to generate the quote.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className="bg-secondary hover:bg-secondary/90 text-white rounded-xl"
                    onClick={() => {
                      if (!selectedProject?._id) return;
                      window.location.href = '/?artisanView=marketplace&projectId=' + selectedProject._id;
                    }}
                  >
                    <ShoppingCart size={16} className="mr-2" /> Add Material
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-2"
                    onClick={() => {
                      if (!selectedProject?._id) return;
                      window.location.href = '/?artisanView=projects';
                    }}
                  >
                    <FolderKanban size={16} className="mr-2" /> View Materials
                  </Button>
                </div>
              </Card>
            )}

            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground mb-2">Total amount preview</p>
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-white p-3 border border-gray-100">
                  <p className="text-muted-foreground">Labor hand</p>
                  <p className="font-semibold text-foreground">{formatAmount(Number.isFinite(laborHandAmount) ? laborHandAmount : 0)}</p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-gray-100">
                  <p className="text-muted-foreground">Materials</p>
                  <p className="font-semibold text-foreground">{formatAmount(materialsAmount)}</p>
                </div>
                <div className="rounded-lg bg-primary text-white p-3 border border-primary/30">
                  <p>Total</p>
                  <p className="font-bold text-lg">{formatAmount(totalAmount)}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">
                Description <span style={{ color: 'red' }}>*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (touched.description) setErrors(prev => ({ ...prev, description: validateField('description', e.target.value) }));
                }}
                onBlur={() => handleBlur('description')}
                placeholder="Describe the work, materials, and services included..."
                rows={6}
                className={`rounded-xl border-2 focus:border-primary ${
                  touched.description && errors.description ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {touched.description && errors.description && (
                <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.description}</p>
              )}
            </div>

            {/* Valid Until et Payment Terms */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Valid Until */}
              <div className="space-y-2">
                <Label htmlFor="validUntil" className="text-base font-semibold">
                  Valid Until <span style={{ color: 'red' }}>*</span>
                </Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => {
                    setFormData({ ...formData, validUntil: e.target.value });
                    if (touched.validUntil) setErrors(prev => ({ ...prev, validUntil: validateField('validUntil', e.target.value) }));
                  }}
                  onBlur={() => handleBlur('validUntil')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${
                    touched.validUntil && errors.validUntil ? 'border-red-500' : 'border-gray-200'
                  }`}
                />
                {touched.validUntil && errors.validUntil && (
                  <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.validUntil}</p>
                )}
              </div>

              {/* Payment Terms (calculated) */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Payment Terms <span style={{ color: 'red' }}>*</span></Label>

                <div className="flex flex-wrap gap-3">
                  <label className={`flex items-center gap-2 px-3 h-10 rounded-lg border-2 cursor-pointer ${formData.paymentType === 'percentage' ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'}`}>
                    <input
                      type="radio"
                      name="paymentType"
                      checked={formData.paymentType === 'percentage'}
                      onChange={() => {
                        setFormData({ ...formData, paymentType: 'percentage' });
                        if (touched.paymentType) setErrors(prev => ({ ...prev, paymentType: validateField('paymentType', 'percentage') }));
                        if (touched.upfrontValue) setErrors(prev => ({ ...prev, upfrontValue: validateField('upfrontValue', formData.upfrontValue) }));
                      }}
                      onBlur={() => handleBlur('paymentType')}
                    />
                    Percentage (%)
                  </label>
                  <label className={`flex items-center gap-2 px-3 h-10 rounded-lg border-2 cursor-pointer ${formData.paymentType === 'fixed' ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'}`}>
                    <input
                      type="radio"
                      name="paymentType"
                      checked={formData.paymentType === 'fixed'}
                      onChange={() => {
                        setFormData({ ...formData, paymentType: 'fixed' });
                        if (touched.paymentType) setErrors(prev => ({ ...prev, paymentType: validateField('paymentType', 'fixed') }));
                        if (touched.upfrontValue) setErrors(prev => ({ ...prev, upfrontValue: validateField('upfrontValue', formData.upfrontValue) }));
                      }}
                      onBlur={() => handleBlur('paymentType')}
                    />
                    Fixed Amount
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="upfrontValue" className="text-sm font-medium text-muted-foreground">
                    Upfront ({formData.paymentType === 'percentage' ? '%' : 'TND'})
                  </Label>
                  <Input
                    id="upfrontValue"
                    type="number"
                    min={0}
                    max={formData.paymentType === 'percentage' ? 100 : undefined}
                    value={formData.upfrontValue}
                    onChange={(e) => {
                      setFormData({ ...formData, upfrontValue: e.target.value });
                      if (touched.upfrontValue) setErrors(prev => ({ ...prev, upfrontValue: validateField('upfrontValue', e.target.value) }));
                    }}
                    onBlur={() => handleBlur('upfrontValue')}
                    placeholder={formData.paymentType === 'percentage' ? 'e.g. 30' : 'e.g. 500'}
                    className={`h-10 rounded-xl border-2 focus:border-primary ${
                      touched.upfrontValue && errors.upfrontValue ? 'border-red-500' : 'border-gray-200'
                    }`}
                  />
                  {touched.upfrontValue && errors.upfrontValue && (
                    <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.upfrontValue}</p>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Upfront</span>
                    <span className="font-semibold text-foreground">
                      {upfrontPercentage.toFixed(2)}% ({safeUpfrontAmount.toFixed(2)} TND)
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Upon Completion</span>
                    <span className="font-semibold text-foreground">
                      {uponCompletionPercentage.toFixed(2)}% ({uponCompletionAmount.toFixed(2)} TND)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !validateForm()}
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Generating...' : 'Generate Quote'}
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
  // VUE 2 : DÉTAILS DU DEVIS (PDF)
  // ==========================================
  if (view === 'details' && selectedQuote) {
    // Changer le titre pour le PDF
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center print:hidden">
          <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Quotes
          </Button>
          <div className="flex gap-3">
            {selectedQuote.status === 'pending' && (
              <>
                <Button
                  onClick={() => handleStatusChange(selectedQuote._id, 'approved')}
                  className="!bg-emerald-700 hover:!bg-emerald-800 !text-white rounded-xl border border-emerald-800 shadow-sm"
                >
                  <CheckCircle size={18} className="mr-2" /> Mark Approved
                </Button>
                <Button onClick={() => handleStatusChange(selectedQuote._id, 'rejected')} variant="destructive" className="rounded-xl">
                  <XCircle size={18} className="mr-2" /> Mark Rejected
                </Button>
              </>
            )}
          </div>
        </div>

        <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg print:shadow-none print:m-0 print:border">
          <div className="flex justify-between items-start mb-10 border-b-2 pb-6">
            <div>
              <h1 className="text-4xl font-bold text-primary mb-2">QUOTE</h1>
              <p className="text-muted-foreground font-mono">{selectedQuote.quoteNumber}</p>
            </div>
            <div className="text-right">
              <h3 className="font-bold text-foreground">BMP Marketplace</h3>
              <p className="text-muted-foreground">Digital Construction Platform</p>
              <Badge className={`mt-2 ${getStatusColor(selectedQuote.status)} px-3 py-1`}>
                {selectedQuote.status.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-10 mb-10">
            <div>
              <h4 className="font-bold text-foreground mb-2 border-b pb-2">Project:</h4>
              <p className="font-semibold text-lg">{selectedQuote.project?.title || 'Unknown Project'}</p>
              <h4 className="font-bold text-foreground mb-2 border-b pb-2 mt-6">Client:</h4>
              <p className="font-semibold text-lg">{selectedQuote.clientName || 'N/A'}</p>
            </div>
            <div className="text-right space-y-2">
              <p><span className="text-muted-foreground font-medium mr-2">Created On:</span> <span className="font-semibold">{formatDate(selectedQuote.createdAt)}</span></p>
              <p><span className="text-muted-foreground font-medium mr-2">Valid Until:</span> <span className="font-semibold text-red-600">{formatDate(selectedQuote.validUntil)}</span></p>
            </div>
          </div>

          <div className="mb-6 bg-gray-50 p-6 rounded-xl border">
            <h4 className="font-bold text-foreground mb-4">Description of Work / Items:</h4>
            <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{selectedQuote.description}</p>
          </div>

          {selectedQuote.paymentTerms && (
            <div className="mb-10 bg-gray-50 p-6 rounded-xl border">
              <h4 className="font-bold text-foreground mb-4">Payment Terms:</h4>
              <p className="whitespace-pre-wrap text-muted-foreground">{selectedQuote.paymentTerms}</p>
            </div>
          )}

          <div className="flex justify-end border-t-2 pt-6">
            <div className="w-full max-w-md space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3">
                <p className="text-muted-foreground font-medium">Labor hand</p>
                <p className="font-semibold text-foreground">{formatAmount(Number(selectedQuote.laborHand || selectedQuote.amount || 0))}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3">
                <p className="text-muted-foreground font-medium">Materials</p>
                <p className="font-semibold text-foreground">{formatAmount(Number(selectedQuote.materialsAmount || 0))}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-primary px-4 py-3 text-white">
                <p className="font-medium">Total</p>
                <p className="text-2xl font-bold">{formatAmount(Number(selectedQuote.amount || 0))}</p>
              </div>
            </div>
          </div>
        </Card>

        {selectedQuote.status === 'approved' && !selectedQuote.hasInvoice && (
          <div ref={invoiceSectionRef}>
            <Card className="p-5 bg-white rounded-2xl border border-green-200 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Ready to generate invoice</h4>
                  <p className="text-sm text-muted-foreground">Create an invoice linked to this approved quote. Issue date will be generated automatically.</p>
                </div>
                <Button
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl"
                  onClick={() => openGenerateInvoiceModal(selectedQuote)}
                >
                  Generate Invoice
                </Button>
              </div>
            </Card>
          </div>
        )}

        {renderGlobalOverlay()}
      </div>
    );
  }

  // ==========================================
  // VUE 3 : LISTE PRINCIPALE
  // ==========================================
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Quotes</h1>
          <p className="text-lg text-muted-foreground">Manage project quotes and estimates</p>
        </div>
        <Button onClick={() => guard(() => setView('create'))} className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
          <Plus size={20} className="mr-2" /> Generate Quote
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <StatsCard label="Total Quotes" value={quotes.length.toString()} icon={<FileText size={28} />} color="#1E40AF" subtitle="All time" />
        <StatsCard label="Approved" value={quotes.filter(q => q.status === 'approved').length.toString()} icon={<CheckCircle size={28} />} color="#10B981" />
        <StatsCard label="Pending" value={quotes.filter(q => q.status === 'pending').length.toString()} icon={<Clock size={28} />} color="#F59E0B" subtitle="Awaiting response" />
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
          <div className="flex-1 h-12 rounded-xl border-2 border-gray-200 bg-white px-3 flex items-center gap-2">
            <Search className="text-muted-foreground shrink-0" size={18} />
            <Input
              placeholder="Search quotes..."
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
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'approved' | 'pending' | 'rejected')}
                className="h-full w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0 outline-none cursor-pointer"
                style={{ WebkitAppearance: 'none', appearance: 'none', background: 'transparent' }}
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="h-12 rounded-xl border-2 border-gray-200 bg-white px-3 flex items-center min-w-[170px] overflow-hidden focus-within:border-gray-300 transition-colors">
              <select
                value={invoiceFilter}
                onChange={(e) => setInvoiceFilter(e.target.value as 'all' | 'withInvoice' | 'withoutInvoice')}
                className="h-full w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0 outline-none cursor-pointer"
                style={{ WebkitAppearance: 'none', appearance: 'none', background: 'transparent' }}
              >
                <option value="all">All Invoice</option>
                <option value="withInvoice">With Invoice</option>
                <option value="withoutInvoice">Without Invoice</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-10">Loading quotes...</div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-lg border border-gray-100">
            <FileText className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-xl font-semibold text-gray-500">No quotes found.</p>
          </div>
        ) : (
          filteredQuotes.map((quote) => (
            <Card key={quote._id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xl font-bold text-foreground">Quote {quote.quoteNumber}</h3>
                    <Badge className={`${getStatusColor(quote.status)} px-4 py-1.5 text-sm font-semibold flex items-center gap-2 border-2`}>
                      {getStatusIcon(quote.status)}
                      {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="mb-3 text-muted-foreground">
                    <strong className="text-foreground">Project:</strong> {quote.project?.title || 'Unknown'}
                  </p>
                  <p className="mb-3 text-muted-foreground">
                    <strong className="text-foreground">Client:</strong> {quote.clientName || 'N/A'}
                  </p>
                  <p className="text-muted-foreground mb-4 leading-relaxed line-clamp-2">
                    {quote.description}
                  </p>
                  <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                    <span>Created: <strong className="text-foreground">{formatDate(quote.createdAt)}</strong></span>
                    <span>Valid until: <strong className="text-foreground">{formatDate(quote.validUntil)}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground font-medium mb-2">Total</p>
                    <p className="text-3xl font-bold text-primary">
                      {formatAmount(Number(quote.amount || 0))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Labor {formatAmount(Number(quote.laborHand || quote.amount || 0))} + Materials {formatAmount(Number(quote.materialsAmount || 0))}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-2 h-10 hover:bg-primary hover:text-white"
                      onClick={() => { setSelectedQuote(quote); setView('details'); }}
                    >
                      <Eye size={16} className="mr-2" /> View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-2 h-10 hover:bg-accent hover:text-white"
                      onClick={() => handleDownloadQuotePdf(quote)}
                    >
                      <Download size={16} className="mr-2" /> PDF
                    </Button>
                    {quote.status === 'approved' && !quote.hasInvoice && (
                      <Button
                        size="sm"
                        className="rounded-xl h-10 bg-primary hover:bg-primary/90 text-white"
                        onClick={() => openGenerateInvoiceModal(quote)}
                      >
                        Generate Invoice
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-2 h-10 hover:bg-red-600 hover:text-white"
                      onClick={() => openDeleteQuoteModal(quote)}
                    >
                      <Trash2 size={16} className="mr-2" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}

        {renderGlobalOverlay()}
        {PopupElement}
      </div>
    </div>
  );
}