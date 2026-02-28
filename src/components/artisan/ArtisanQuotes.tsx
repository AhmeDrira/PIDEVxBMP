import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, FileText, Download, Eye, Clock, CheckCircle, XCircle, ArrowRight, Printer } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import axios from 'axios';

export default function ArtisanQuotes() {
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [selectedQuote, setSelectedQuote] = useState<any>(null);

  const [quotes, setQuotes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    project: '',
    amount: '',
    description: '',
    validUntil: '',
    paymentTerms: ''
  });

  // États pour la validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
        }
      } catch (error) {
        console.error("Erreur de chargement:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [view, API_URL]);

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
      case 'project':
        return !value ? 'Project is required' : '';
      case 'amount':
        if (!value) return 'Amount is required';
        if (isNaN(Number(value)) || Number(value) <= 0) return 'Amount must be a positive number';
        return '';
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
      case 'paymentTerms':
        // Champ optionnel, mais s'il est rempli, on peut exiger un minimum de caractères ?
        if (value && value.length < 5) return 'Payment terms must be at least 5 characters if provided';
        return '';
      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const fields = ['project', 'amount', 'description', 'validUntil'];
    for (const field of fields) {
      if (validateField(field, formData[field as keyof typeof formData])) return false;
    }
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
      await axios.post(`${API_URL}/quotes`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Quote generated successfully!');
      setFormData({ project: '', amount: '', description: '', validUntil: '', paymentTerms: '' });
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
      await axios.put(`${API_URL}/quotes/${id}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Quote marked as ${newStatus}!`);
      setView('list'); // Recharge la liste
    } catch (error) {
      console.error("Error updating status:", error);
    }
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
                {projects.map((proj) => (
                  <option key={proj._id} value={proj._id}>{proj.title}</option>
                ))}
              </select>
              {touched.project && errors.project && (
                <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.project}</p>
              )}
            </div>

            {/* Montant */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-base font-semibold">
                Estimated Amount (TND) <span style={{ color: 'red' }}>*</span>
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
                className={`h-12 rounded-xl border-2 focus:border-primary ${
                  touched.amount && errors.amount ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {touched.amount && errors.amount && (
                <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.amount}</p>
              )}
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

              {/* Payment Terms (optionnel) */}
              <div className="space-y-2">
                <Label htmlFor="paymentTerms" className="text-base font-semibold">
                  Payment Terms
                </Label>
                <Textarea
                  id="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={(e) => {
                    setFormData({ ...formData, paymentTerms: e.target.value });
                    if (touched.paymentTerms) setErrors(prev => ({ ...prev, paymentTerms: validateField('paymentTerms', e.target.value) }));
                  }}
                  onBlur={() => handleBlur('paymentTerms')}
                  placeholder="e.g., 50% upfront, 50% upon completion"
                  rows={3}
                  className={`rounded-xl border-2 focus:border-primary ${
                    touched.paymentTerms && errors.paymentTerms ? 'border-red-500' : 'border-gray-200'
                  }`}
                />
                {touched.paymentTerms && errors.paymentTerms && (
                  <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.paymentTerms}</p>
                )}
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
                <Button onClick={() => handleStatusChange(selectedQuote._id, 'approved')} className="bg-green-600 hover:bg-green-700 text-white rounded-xl">
                  <CheckCircle size={18} className="mr-2" /> Mark Approved
                </Button>
                <Button onClick={() => handleStatusChange(selectedQuote._id, 'rejected')} variant="destructive" className="rounded-xl">
                  <XCircle size={18} className="mr-2" /> Mark Rejected
                </Button>
              </>
            )}
            <Button onClick={() => window.print()} variant="outline" className="rounded-xl border-2">
              <Printer size={18} className="mr-2" /> Print / PDF
            </Button>
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
            <div className="text-right">
              <p className="text-muted-foreground font-medium mb-1">Estimated Amount</p>
              <p className="text-4xl font-bold text-primary">{selectedQuote.amount.toLocaleString()} TND</p>
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Quotes</h1>
          <p className="text-lg text-muted-foreground">Manage project quotes and estimates</p>
        </div>
        <Button onClick={() => setView('create')} className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
          <Plus size={20} className="mr-2" /> Generate Quote
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <StatsCard label="Total Quotes" value={quotes.length.toString()} icon={<FileText size={28} />} color="#1E40AF" subtitle="All time" />
        <StatsCard label="Approved" value={quotes.filter(q => q.status === 'approved').length.toString()} icon={<CheckCircle size={28} />} color="#10B981" />
        <StatsCard label="Pending" value={quotes.filter(q => q.status === 'pending').length.toString()} icon={<Clock size={28} />} color="#F59E0B" subtitle="Awaiting response" />
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-10">Loading quotes...</div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-lg border border-gray-100">
            <FileText className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-xl font-semibold text-gray-500">No quotes generated yet.</p>
          </div>
        ) : (
          quotes.map((quote) => (
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
                    <p className="text-sm text-muted-foreground font-medium mb-2">Amount</p>
                    <p className="text-3xl font-bold text-primary">
                      {quote.amount.toLocaleString()} TND
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
                      onClick={() => {
                        setSelectedQuote(quote);
                        setView('details');
                        setTimeout(() => window.print(), 500);
                      }}
                    >
                      <Download size={16} className="mr-2" /> PDF
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