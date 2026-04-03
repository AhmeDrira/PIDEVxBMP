import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Check, Crown, Calendar, CreditCard, Loader2, AlertTriangle, X, Download, Receipt } from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';

export default function ArtisanSubscription() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const API_URL = '/api';

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  const fetchUserData = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserData(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleDownloadReceipt = async (paymentId: string, receiptNo: string) => {
    try {
      const token = getToken();
      const response = await axios.get(`${API_URL}/payments/subscription/history/${paymentId}/pdf`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${receiptNo}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(tr('Failed to download receipt. Make sure Chrome/Edge is available on the server.', 'Echec du telechargement du recu. Assurez-vous que Chrome/Edge est disponible sur le serveur.', 'فشل التحميل. بعد توفر كروم / Edge على الخادم.'));
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = getToken();
      if (!token) return;
      const response = await axios.get(`${API_URL}/payments/subscription/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPaymentHistory(response.data);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchUserData();
    fetchPaymentHistory();
    
    // Check for success/cancel in URL
    const params = new URLSearchParams(window.location.search);
    const subscriptionStatus = params.get('subscription');
    const sessionId = params.get('session_id');

    if (subscriptionStatus === 'success' && sessionId) {
      verifySubscription(sessionId);
    } else if (subscriptionStatus === 'cancel') {
      toast.error(tr('Payment cancelled', 'Paiement annule', 'تم إلغاء الدفع'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const verifySubscription = async (sessionId: string) => {
    try {
      setIsVerifying(true);
      const token = getToken();
      const response = await axios.get(`${API_URL}/payments/subscription/verify?sessionId=${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.subscription) {
        toast.success(tr('Subscription activated! Welcome to the premium club.', 'Abonnement active ! Bienvenue dans le club premium.', 'تم تفعيل الاشتراك! مرحباب بص به کلب بريميوم.'));
        fetchUserData();
        fetchPaymentHistory();
        // Notify dashboard to re-check subscription status
        window.dispatchEvent(new Event('artisan-subscription-verified'));
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error(tr('Failed to verify subscription', 'Echec de verification de l\'abonnement'));
    } finally {
      setIsVerifying(false);
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleSubscribe = async (plan: any) => {
    if (loadingPlan) return;
    
    try {
      setLoadingPlan(plan.id);
      const token = getToken();
      if (!token) {
        toast.error(tr('Please login to subscribe', 'Veuillez vous connecter pour vous abonner', 'يرجى تسجيل الدخول للاشتراك'));
        return;
      }

      const response = await axios.post(`${API_URL}/payments/subscription`, {
        planId: plan.id,
        price: plan.price,
        name: plan.name,
        duration: plan.duration
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        toast.error(tr('Failed to initiate payment', 'Echec de l\'initialisation du paiement'));
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error(error.response?.data?.message || tr('Error initiating subscription', 'Erreur lors de l\'initialisation de l\'abonnement'));
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setIsCanceling(true);
      const token = getToken();
      const response = await axios.post(`${API_URL}/payments/subscription/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const refund = response.data?.refundAmount || 0;
      const days = response.data?.remainingDays || 0;
      if (refund > 0) {
        toast.success(language === 'fr'
          ? `Abonnement annule. Vous recevrez un remboursement de ${refund.toFixed(2)} TND pour ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}.`
          : `Subscription canceled. You will receive a refund of ${refund.toFixed(2)} TND for ${days} remaining day${days > 1 ? 's' : ''}.`);
      } else {
        toast.success(tr('Subscription canceled successfully.', 'Abonnement annule avec succes.', 'تم إلغاء الاشتراك بنجاح.'));
      }
      setShowCancelDialog(false);
      fetchUserData();
      // Notify dashboard to re-check subscription status
      window.dispatchEvent(new Event('artisan-subscription-verified'));
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      toast.error(error.response?.data?.message || tr('Error canceling subscription', 'Erreur lors de l\'annulation de l\'abonnement'));
    } finally {
      setIsCanceling(false);
    }
  };

  const plans = [
    {
      id: 'monthly',
      name: tr('Monthly', 'Mensuel', 'شهري'),
      price: 150,
      duration: tr('1 month', '1 mois', 'شهر واحد'),
      popular: false,
      features: [
        tr('Unlimited projects', 'Projets illimites', 'مشروعات غير محدودة'),
        tr('Quote & invoice generation', 'Generation de devis et factures', 'عروض وإ نشاء الفواتير'),
        tr('Marketplace access', 'Acces marketplace', 'الوصول إلى سوق البناء'),
        tr('Basic analytics', 'Analyses de base', 'التحليلات الأساسية'),
        tr('Email support', 'Support email', 'دعم البريد')
      ]
    },
    {
      id: '3months',
      name: tr('3 Months', '3 Mois', 'الثلاثة الشهور'),
      price: 390,
      originalPrice: 450,
      duration: tr('3 months', '3 mois', 'ثلاثة اشهر'),
      popular: true,
      discount: tr('13% off', '13% de reduction', 'خصم 13%'),
      features: [
        tr('All Monthly features', 'Toutes les fonctionnalites mensuelles', 'جميع ميزات الاشتراك الشهري'),
        tr('Priority support', 'Support prioritaire', 'دعم مميز'),
        tr('Advanced analytics', 'Analyses avancees', 'التحليلات المتقدمة'),
        tr('Custom branding', 'Branding personnalise', 'علامة مخصصة'),
        tr('Export reports', 'Export des rapports', 'تصدير التقارير')
      ]
    },
    {
      id: 'yearly',
      name: tr('Yearly', 'Annuel', 'سنوي'),
      price: 1350,
      originalPrice: 1800,
      duration: tr('12 months', '12 mois', '12 شهر'),
      popular: false,
      discount: tr('25% off', '25% de reduction', 'خصم 25%'),
      features: [
        tr('All 3 Months features', 'Toutes les fonctionnalites 3 mois', 'جميع ميزات الاشتراك الثلاثي'),
        tr('Dedicated account manager', 'Gestionnaire de compte dedie', 'مدير حساب مختص'),
        tr('API access', 'Acces API', 'الوصول API'),
        tr('Custom integrations', 'Integrations personnalisees', 'مش روعات مخصصة'),
        tr('Training sessions', 'Sessions de formation', 'جلسات التدريب')
      ]
    }
  ];

  const currentPlan = userData?.subscription?.status === 'active' ? {
    type: userData.subscription.planId.charAt(0).toUpperCase() + userData.subscription.planId.slice(1),
    status: tr('Active', 'Actif', 'نشط'),
    startDate: new Date(userData.subscription.startDate).toLocaleDateString(),
    endDate: new Date(userData.subscription.endDate).toLocaleDateString(),
    amount: plans.find(p => p.id === userData.subscription.planId)?.price || 0
  } : {
    type: tr('Free', 'Gratuit', 'مجاني'),
    status: tr('Inactive', 'Inactif', 'غير ؠ٩ن نشط'),
    startDate: '-',
    endDate: '-',
    amount: 0
  };

  const subscriptionStatusClass = currentPlan.status === 'Active'
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-100 dark:text-emerald-700 dark:border-emerald-200'
    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-100 dark:text-slate-700 dark:border-slate-200';

  return (
    <div className="relative">
      <div className={`space-y-8 animate-in fade-in duration-500 transition-all ${showCancelDialog ? 'blur-md pointer-events-none' : ''}`}>
        {/* Current Subscription */}
        <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-3xl font-bold text-foreground">Current Subscription</h2>
                <Badge className={`${subscriptionStatusClass} border-2 px-4 py-1.5 text-sm font-semibold`}>
                  {currentPlan.status}
                </Badge>
              </div>
              <p className="text-lg text-muted-foreground mb-6">
                {tr('You are subscribed to the', 'Vous etes abonne au plan', 'أنت مشترك في')} <strong className="text-foreground">{currentPlan.type}</strong>
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Calendar size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{tr('Start Date', 'Date de debut', 'تاريخ البداية')}</p>
                    <p className="font-bold text-foreground">{currentPlan.startDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Calendar size={24} className="text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{tr('Renewal Date', 'Date de renouvellement', 'تاريخ التجديد')}</p>
                    <p className="font-bold text-foreground">{currentPlan.endDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <CreditCard size={24} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{tr('Amount', 'Montant', 'المبلغ')}</p>
                    <p className="font-bold text-foreground">{currentPlan.amount} TND</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {currentPlan.status === 'Active' && (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isCanceling}
                  className="h-12 px-6 rounded-xl border-2 border-red-500 bg-red-500 !text-white font-semibold flex items-center justify-center gap-2 transition-all hover:bg-red-600 hover:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCanceling ? <Loader2 className="animate-spin" size={20} /> : tr('Cancel Subscription', 'Annuler l\'abonnement', 'إلغاء الاشتراك')}
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Subscription Plans */}
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-6">{tr('Choose Your Plan', 'Choisissez votre plan', 'اختر خطتك')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`p-8 bg-card rounded-2xl border border-border shadow-lg hover:shadow-xl transition-all duration-300 relative ${
                  plan.popular ? 'ring-4 ring-secondary/20 hover:-translate-y-2' : 'hover:-translate-y-1'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 text-white bg-secondary shadow-lg">
                    <Crown size={18} />
                    {tr('Most Popular', 'Le plus populaire', 'الأكثر شيوعاً')}
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-foreground mb-4">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-5xl font-bold text-primary">
                      {plan.price}
                    </span>
                    <span className="text-lg text-muted-foreground ml-2">TND</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{plan.duration}</p>
                  {plan.discount && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm line-through text-muted-foreground">
                        {plan.originalPrice} TND
                      </span>
                      <Badge className="bg-accent/10 text-accent border-0 px-3 py-1 text-xs font-bold">
                        {plan.discount}
                      </Badge>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => handleSubscribe(plan)}
                  disabled={loadingPlan === plan.id || currentPlan.type.toLowerCase() === plan.name.toLowerCase()}
                  className={`w-full h-12 text-white rounded-xl shadow-lg ${
                    plan.popular 
                      ? 'bg-secondary hover:bg-secondary/90' 
                      : 'bg-primary hover:bg-primary/90'
                  }`}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : currentPlan.type.toLowerCase() === plan.name.toLowerCase() 
                    ? tr('Current Plan', 'Plan actuel', 'الخطة الحالية') 
                    : plan.popular ? tr('Upgrade Now', 'Mettre a niveau', 'الارتقاء الآن') : tr('Select Plan', 'Choisir le plan', 'اختر الخطة')
                  }
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Payment History */}
        <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-foreground">{tr('Payment History', 'Historique des paiements', 'سجل الدفعات')}</h3>
              <p className="text-sm text-muted-foreground mt-1">{tr('All your subscription payments', 'Tous vos paiements d\'abonnement', 'جميع دفعاتك الاشتراك')}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Receipt size={20} className="text-primary" />
            </div>
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : paymentHistory.length > 0 ? (
            <div className="space-y-3">
              {/* Header row */}
              <div className="grid grid-cols-4 gap-4 px-4 py-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tr('Date', 'Date', 'التاريخ')}</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tr('Plan', 'Plan', 'الخطة')}</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tr('Amount', 'Montant', 'المبلغ')}</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">{tr('Receipt', 'Recu', 'الإيصال')}</span>
              </div>

              {paymentHistory.map((payment, index) => {
                const receiptNo = `REC-${String(payment._id).slice(-8).toUpperCase()}`;
                const planLabel = payment.planId
                  ? payment.planId.charAt(0).toUpperCase() + payment.planId.slice(1)
                  : tr('Subscription', 'Abonnement', 'الاشتراك');
                return (
                  <div
                    key={index}
                    className="grid grid-cols-4 gap-4 items-center px-4 py-4 rounded-2xl border border-border bg-muted/50 hover:bg-muted/50 hover:border-border transition-all duration-200"
                  >
                    {/* Date */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Calendar size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {new Date(payment.paymentDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">{receiptNo}</p>
                      </div>
                    </div>

                    {/* Plan */}
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                        <Crown size={12} />
                        {planLabel}
                      </span>
                    </div>

                    {/* Amount */}
                    <div>
                      <p className="text-lg font-extrabold text-foreground">
                        {Number(payment.amount).toFixed(2)}
                        <span className="text-sm font-semibold text-muted-foreground ml-1">DT</span>
                      </p>
                    </div>

                    {/* Download */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDownloadReceipt(payment._id, receiptNo)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                      >
                        <Download size={13} />
                        PDF
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard size={32} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-lg font-medium">{tr('No payment history yet.', 'Aucun historique de paiement pour le moment.', 'لا يوجد سجل دفع حتى الآن.')}</p>
              <p className="text-sm text-muted-foreground mt-1">{tr('Your subscription receipts will appear here.', 'Vos recus d\'abonnement apparaitront ici.', 'ستظهر إيصالات اشتراكك هنا.')}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Simple Cancel Confirmation Modal */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowCancelDialog(false)}
          />
          {/* Modal Content - Square Form */}
          <div className="relative bg-card rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.3)] w-[280px] h-[280px] flex flex-col items-center justify-center overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-border">
            <div className="p-6 flex flex-col items-center justify-center h-full w-full">
              <div className="text-center flex-1 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{tr('Cancel Subscription?', 'Annuler l\'abonnement ?', 'إلغاء الاشتراك؟')}</h3>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed px-2">
                  {tr('Are you sure you want to cancel?', 'Voulez-vous vraiment annuler ?', 'هل أنت متأكد من رغبة إلغاء الاشتراك؟')}
                </p>
              </div>
              
              <div className="flex flex-row gap-3 w-full mt-auto">
                <button
                  type="button"
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1 h-11 rounded-xl border-2 border-border bg-muted/50 hover:bg-muted font-bold text-foreground transition-all text-sm"
                  disabled={isCanceling}
                >
                  {tr('Cancel', 'Annuler', 'إلغاء')}
                </button>
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  className="flex-1 h-11 rounded-xl border-2 border-red-500 bg-red-500 hover:bg-red-600 !text-white font-bold transition-all text-sm"
                  disabled={isCanceling}
                >
                  {isCanceling ? (
                    <Loader2 className="animate-spin mx-auto text-white" size={18} />
                  ) : (
                    tr('Confirm', 'Confirmer', 'تأكيد')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


