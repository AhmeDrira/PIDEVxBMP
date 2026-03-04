import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Receipt, Download, Eye, Check, Clock, AlertCircle, ArrowRight, Printer } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import axios from 'axios';

export default function ArtisanInvoices() {
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // --- MARQUER COMME PAYÉ ---
  const handleMarkAsPaid = async (id: string) => {
    try {
      const token = getToken();
      await axios.put(`${API_URL}/invoices/${id}/status`, { status: 'paid' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Invoice marked as Paid!');
      setView('list');
    } catch (error) {
      console.error("Error updating status:", error);
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
  // VUE 2 : DÉTAILS DE LA FACTURE
  // ==========================================
  if (view === 'details' && selectedInvoice) {

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center print:hidden">
          <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Invoices
          </Button>
          <div className="flex gap-3">
            {selectedInvoice.status !== 'paid' && (
              <Button
                onClick={() => handleMarkAsPaid(selectedInvoice._id)}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-6 py-3 text-lg font-semibold"
              >
                <Check size={20} className="mr-2" /> Mark as Paid
              </Button>
            )}
            <Button onClick={() => window.print()} variant="outline" className="rounded-xl border-2">
              <Printer size={18} className="mr-2" /> Print / PDF
            </Button>
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
        <Button onClick={() => setView('create')} className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
          <Plus size={20} className="mr-2" /> Generate Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <StatsCard label="Total Revenue" value={`${totalRevenue.toLocaleString()} TND`} icon={<Check size={28} />} color="#10B981" trend="Paid" trendUp={true} />
        <StatsCard label="Pending" value={`${pendingAmount.toLocaleString()} TND`} icon={<Clock size={28} />} color="#F59E0B" subtitle="Awaiting payment" />
        <StatsCard label="Overdue" value={`${overdueAmount.toLocaleString()} TND`} icon={<AlertCircle size={28} />} color="#EF4444" subtitle="Needs attention" />
      </div>

      {/* Liste des factures */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-10">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-lg border border-gray-100">
            <Receipt className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-xl font-semibold text-gray-500">No invoices generated yet.</p>
          </div>
        ) : (
          invoices.map((invoice) => (
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
                      onClick={() => { setSelectedInvoice(invoice); setView('details'); }}
                    >
                      <Eye size={16} className="mr-2" /> View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-2 h-10 hover:bg-accent hover:text-white"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setView('details');
                        setTimeout(() => window.print(), 500);
                      }}
                    >
                      <Download size={16} className="mr-2" /> Print
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}