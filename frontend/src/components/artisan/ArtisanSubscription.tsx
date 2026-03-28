import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Check, Crown, Calendar, CreditCard, Loader2, AlertTriangle, X, Download, Receipt } from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';
import { toast } from 'sonner';

export default function ArtisanSubscription() {
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
      toast.error('Failed to download receipt. Make sure Chrome/Edge is available on the server.');
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
      toast.error('Payment cancelled');
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
        toast.success('Subscription activated! Welcome to the premium club. 🎉');
        fetchUserData();
        fetchPaymentHistory();
        // Notify dashboard to re-check subscription status
        window.dispatchEvent(new Event('artisan-subscription-verified'));
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to verify subscription');
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
        toast.error('Please login to subscribe');
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
        toast.error('Failed to initiate payment');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error(error.response?.data?.message || 'Error initiating subscription');
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
        toast.success(`Subscription canceled. You will receive a refund of ${refund.toFixed(2)} TND for ${days} remaining day${days > 1 ? 's' : ''}.`);
      } else {
        toast.success('Subscription canceled successfully.');
      }
      setShowCancelDialog(false);
      fetchUserData();
      // Notify dashboard to re-check subscription status
      window.dispatchEvent(new Event('artisan-subscription-verified'));
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      toast.error(error.response?.data?.message || 'Error canceling subscription');
    } finally {
      setIsCanceling(false);
    }
  };

  const plans = [
    {
      id: 'monthly',
      name: 'Monthly',
      price: 150,
      duration: '1 month',
      popular: false,
      features: [
        'Unlimited projects',
        'Quote & invoice generation',
        'Marketplace access',
        'Basic analytics',
        'Email support'
      ]
    },
    {
      id: '3months',
      name: '3 Months',
      price: 390,
      originalPrice: 450,
      duration: '3 months',
      popular: true,
      discount: '13% off',
      features: [
        'All Monthly features',
        'Priority support',
        'Advanced analytics',
        'Custom branding',
        'Export reports'
      ]
    },
    {
      id: 'yearly',
      name: 'Yearly',
      price: 1350,
      originalPrice: 1800,
      duration: '12 months',
      popular: false,
      discount: '25% off',
      features: [
        'All 3 Months features',
        'Dedicated account manager',
        'API access',
        'Custom integrations',
        'Training sessions'
      ]
    }
  ];

  const currentPlan = userData?.subscription?.status === 'active' ? {
    type: userData.subscription.planId.charAt(0).toUpperCase() + userData.subscription.planId.slice(1),
    status: 'Active',
    startDate: new Date(userData.subscription.startDate).toLocaleDateString(),
    endDate: new Date(userData.subscription.endDate).toLocaleDateString(),
    amount: plans.find(p => p.id === userData.subscription.planId)?.price || 0
  } : {
    type: 'Free',
    status: 'Inactive',
    startDate: '-',
    endDate: '-',
    amount: 0
  };

  return (
    <div className="relative">
      <div className={`space-y-8 animate-in fade-in duration-500 transition-all ${showCancelDialog ? 'blur-md pointer-events-none' : ''}`}>
        {/* Current Subscription */}
        <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-3xl font-bold text-foreground">Current Subscription</h2>
                <Badge className="bg-accent/10 text-accent border-accent/20 border-2 px-4 py-1.5 text-sm font-semibold">
                  {currentPlan.status}
                </Badge>
              </div>
              <p className="text-lg text-muted-foreground mb-6">
                You're subscribed to the <strong className="text-foreground">{currentPlan.type}</strong> plan
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Calendar size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Start Date</p>
                    <p className="font-bold text-foreground">{currentPlan.startDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Calendar size={24} className="text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Renewal Date</p>
                    <p className="font-bold text-foreground">{currentPlan.endDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <CreditCard size={24} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Amount</p>
                    <p className="font-bold text-foreground">{currentPlan.amount} TND</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {currentPlan.status === 'Active' && (
                <Button 
                  variant="outline" 
                  className="h-12 px-6 rounded-xl border-2 text-red-500 border-red-100 hover:bg-red-50 hover:border-red-200"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isCanceling}
                >
                  {isCanceling ? <Loader2 className="animate-spin" size={20} /> : 'Cancel Subscription'}
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Subscription Plans */}
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-6">Choose Your Plan</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`p-8 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 relative ${
                  plan.popular ? 'ring-4 ring-secondary/20 hover:-translate-y-2' : 'hover:-translate-y-1'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 text-white bg-secondary shadow-lg">
                    <Crown size={18} />
                    Most Popular
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
                    ? 'Current Plan' 
                    : plan.popular ? 'Upgrade Now' : 'Select Plan'
                  }
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Payment History */}
        <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-foreground">Payment History</h3>
              <p className="text-sm text-muted-foreground mt-1">All your subscription payments</p>
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
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Receipt</span>
              </div>

              {paymentHistory.map((payment, index) => {
                const receiptNo = `REC-${String(payment._id).slice(-8).toUpperCase()}`;
                const planLabel = payment.planId
                  ? payment.planId.charAt(0).toUpperCase() + payment.planId.slice(1)
                  : 'Subscription';
                return (
                  <div
                    key={index}
                    className="grid grid-cols-4 gap-4 items-center px-4 py-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-200 transition-all duration-200"
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
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard size={32} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-lg font-medium">No payment history yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Your subscription receipts will appear here.</p>
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
          <div className="relative bg-white rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.3)] w-[280px] h-[280px] flex flex-col items-center justify-center overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-6 flex flex-col items-center justify-center h-full w-full">
              <div className="text-center flex-1 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Cancel Subscription?</h3>
                <p className="text-sm text-gray-600 font-medium leading-relaxed px-2">
                  Are you sure you want to cancel?
                </p>
              </div>
              
              <div className="flex flex-row gap-3 w-full mt-auto">
                <button
                  type="button"
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1 h-11 rounded-xl border-2 border-gray-200 font-bold text-gray-700 bg-white hover:bg-gray-50 transition-all text-sm"
                  disabled={isCanceling}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  className="flex-1 h-11 rounded-xl border-2 border-gray-200 font-bold text-gray-700 bg-white hover:bg-gray-50 transition-all text-sm"
                  disabled={isCanceling}
                >
                  {isCanceling ? (
                    <Loader2 className="animate-spin mx-auto text-gray-400" size={18} />
                  ) : (
                    "Confirm"
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
