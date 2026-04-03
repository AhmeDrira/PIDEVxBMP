import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CreditCard, Download, Printer, ArrowRight, Loader2, Package, Calendar, Wallet, Eye } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';

export default function ExpertPayments() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const { t } = useLanguage();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [view, setView] = useState<'list' | 'details'>('list');
  const [downloadingPaymentId, setDownloadingPaymentId] = useState<string | null>(null);

  const API_URL = '/api';

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const token = getToken();
        if (!token) return;

        const res = await axios.get(`${API_URL}/payments/product-payments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPayments(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Error fetching payments:', error);
        toast.error(t('expert.payments.failedLoad'));
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [API_URL]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'failed': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const handleDownloadPdf = async (payment: any) => {
    try {
      const token = getToken();
      if (!token) {
        toast.error(t('expert.payments.sessionExpired'));
        return;
      }

      setDownloadingPaymentId(String(payment?._id || ''));
      const response = await axios.get(`${API_URL}/payments/product-payments/${payment._id}/pdf`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileURL;
      link.download = `payment-${String(payment._id).slice(-8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(fileURL);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      toast.error(backendMessage || t('expert.payments.failedPdf'));
    } finally {
      setDownloadingPaymentId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 size={40} className="animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">{t('expert.payments.loadingHistory')}</p>
      </div>
    );
  }

  if (view === 'details' && selectedPayment) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden; }
            .print-receipt, .print-receipt * { visibility: visible; }
            .print-receipt { 
              position: absolute !important; 
              left: 0 !important; 
              top: 0 !important; 
              width: 100% !important; 
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
            @page {
              size: portrait;
              margin: 10mm;
            }
          }
        `}} />
        <div className="flex justify-between items-center print:hidden">
          <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2 hover:border-primary hover:text-primary transition-colors">
            <ArrowRight size={20} className="mr-2 rotate-180" /> {t('expert.payments.backToHistory')}
          </Button>
          <Button
            onClick={() => handleDownloadPdf(selectedPayment)}
            disabled={downloadingPaymentId === selectedPayment._id}
            className="bg-primary dark:bg-blue-600 text-white rounded-xl shadow-lg hover:bg-primary/90 transition-all px-6 h-11"
          >
            {downloadingPaymentId === selectedPayment._id ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Printer size={18} className="mr-2" />}
            {t('expert.payments.generatePdf')}
          </Button>
        </div>

        <Card className="p-10 bg-card rounded-2xl border-0 shadow-xl print-receipt print:shadow-none print:m-0 print:border">
          <div className="flex justify-between items-start mb-8 border-b-2 pb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wallet className="text-primary" size={32} />
                <h1 className="text-3xl font-black text-foreground tracking-tight">{t('expert.payments.receipt')}</h1>
              </div>
              <p className="text-muted-foreground font-mono bg-muted/50 px-3 py-1 rounded-md inline-block text-xs">ID: #{selectedPayment._id.slice(-8).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <h3 className="font-bold text-xl text-primary">BMP Marketplace</h3>
              <p className="text-xs text-muted-foreground font-medium">{t('expert.payments.digitalPlatform')}</p>
              <Badge className={`mt-2 ${getStatusColor(selectedPayment.status)} px-3 py-1 text-xs font-bold border-2`}>
                {selectedPayment.status.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-6">
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-foreground border-b border-border pb-2 flex items-center gap-2">
                <Package size={16} className="text-primary" /> {t('expert.payments.orderInfo')}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('common.date')}</p>
                  <p className="font-semibold text-sm">{new Date(selectedPayment.paymentDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('common.time')}</p>
                  <p className="font-semibold text-sm">{new Date(selectedPayment.paymentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-foreground border-b border-border pb-2 flex items-center gap-2">
                <CreditCard size={16} className="text-primary" /> {t('expert.payments.payment')}
              </h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{t('expert.payments.totalPaid')}</p>
                  <p className="text-2xl font-black text-primary">
                    {selectedPayment.totalAmount.toFixed(2)} <span className="text-sm font-bold">{selectedPayment.currency}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <p className="text-xs font-bold text-green-600">{t('expert.payments.verifiedByStripe')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8 p-4 bg-muted/50 rounded-xl border border-border">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{t('expert.payments.stripeTransactionId')}</p>
            <p className="font-mono text-[10px] break-all text-muted-foreground tracking-tight leading-relaxed">{selectedPayment.stripeSessionId}</p>
          </div>

          <div className="mb-8">
            <h4 className="font-bold text-sm text-foreground mb-4 flex items-center gap-2">
              <Package size={18} className="text-primary" /> Purchased Items
            </h4>
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-muted-foreground uppercase tracking-wider">Item Name</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-muted-foreground uppercase tracking-wider">Unit</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black text-muted-foreground uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedPayment.items.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-xs">{item.name}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-xs">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-medium text-xs">{item.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-black text-xs">{(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-primary/5 border-t border-primary/10">
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-right font-bold text-sm">Grand Total</td>
                    <td className="px-4 py-4 text-right font-black text-lg text-primary">
                      {selectedPayment.totalAmount.toFixed(2)} {selectedPayment.currency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-dashed border-border text-center">
            <p className="text-sm font-bold text-foreground mb-1">Thank you for your business!</p>
            <p className="text-[10px] text-muted-foreground">This is a computer-generated receipt. No signature required.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Payment History</h1>
          <p className="text-muted-foreground font-medium mt-1">Manage and track your product purchases</p>
        </div>
        <div className="bg-primary/10 px-6 py-3 rounded-2xl border-2 border-primary/20 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-primary dark:bg-blue-600 flex items-center justify-center text-white shadow-md">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-wider">Total Spent</p>
            <p className="text-xl font-black text-foreground">
              {payments.reduce((acc, p) => acc + p.totalAmount, 0).toFixed(2)} <span className="text-sm font-bold">TND</span>
            </p>
          </div>
        </div>
      </div>

      {payments.length === 0 ? (
        <Card className="p-16 text-center bg-card rounded-3xl border-0 shadow-xl border-b-4 border-b-gray-100">
          <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
            <CreditCard size={48} />
          </div>
          <h3 className="text-2xl font-black text-foreground mb-2">No payments found</h3>
          <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
            You haven't made any product purchases yet. Visit the marketplace to explore materials.
          </p>
          <Button 
            className="h-14 px-10 text-lg font-bold text-white bg-primary dark:bg-blue-600 hover:bg-primary/90 rounded-2xl shadow-xl hover:scale-105 transition-all"
            onClick={() => window.location.href = '/'}
          >
            Explore Marketplace
          </Button>
        </Card>
      ) : (
        <Card className="bg-card rounded-3xl border-0 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-8 py-6 text-left text-xs font-black text-muted-foreground uppercase tracking-widest">Order Details</th>
                  <th className="px-8 py-6 text-left text-xs font-black text-muted-foreground uppercase tracking-widest">Date</th>
                  <th className="px-8 py-6 text-left text-xs font-black text-muted-foreground uppercase tracking-widest">Amount</th>
                  <th className="px-8 py-6 text-left text-xs font-black text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="px-8 py-6 text-right text-xs font-black text-muted-foreground uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((payment) => (
                  <tr key={payment._id} className="group hover:bg-primary/[0.02] transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                          <Package size={24} />
                        </div>
                        <div>
                          <p className="font-black text-foreground text-lg">Order #{payment._id.slice(-6).toUpperCase()}</p>
                          <p className="text-sm text-muted-foreground font-medium flex items-center gap-1">
                            <Package size={14} /> {payment.items.length} {payment.items.length === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-foreground font-semibold">
                        <Calendar size={16} className="text-primary" />
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xl font-black text-primary">
                        {payment.totalAmount.toFixed(2)} <span className="text-xs font-bold">{payment.currency}</span>
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <Badge className={`${getStatusColor(payment.status)} px-4 py-1.5 rounded-full font-bold border-2 shadow-sm`}>
                        {payment.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setView('details');
                          }}
                          className="rounded-xl border-2 hover:border-primary hover:text-primary transition-all font-bold h-10 px-4"
                        >
                          <Eye size={16} className="mr-2" /> View Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPdf(payment)}
                          disabled={downloadingPaymentId === payment._id}
                          className="rounded-xl border-2 hover:border-primary hover:text-primary transition-all font-bold h-10 px-4"
                        >
                          {downloadingPaymentId === payment._id ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Download size={16} className="mr-2" />} PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
