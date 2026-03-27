import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Check, Crown, Calendar, CreditCard, Loader2, AlertTriangle, X } from 'lucide-react';
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
      await axios.post(`${API_URL}/payments/subscription/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Subscription canceled successfully. We will contact you soon for your refund.');
      setShowCancelDialog(false);
      fetchUserData();
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
          <h3 className="text-2xl font-bold text-foreground mb-6">Payment History</h3>
          <div className="overflow-x-auto">
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : paymentHistory.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-4 text-muted-foreground font-semibold">Date</th>
                    <th className="text-left py-4 text-muted-foreground font-semibold">Plan</th>
                    <th className="text-left py-4 text-muted-foreground font-semibold">Amount</th>
                    <th className="text-left py-4 text-muted-foreground font-semibold">Status</th>
                    <th className="text-left py-4 text-muted-foreground font-semibold">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((payment, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-4 font-medium text-foreground">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-foreground">
                        {payment.planId.charAt(0).toUpperCase() + payment.planId.slice(1)}
                      </td>
                      <td className="py-4 font-bold text-primary">
                        {payment.amount} {payment.currency}
                      </td>
                      <td className="py-4">
                        <Badge className="bg-accent/10 text-accent border-0 px-3 py-1 text-xs font-semibold">
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <Button variant="ghost" size="sm" className="rounded-xl text-primary hover:bg-primary/5">
                          Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard size={32} className="text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-lg">No payment history found.</p>
              </div>
            )}
          </div>
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
