import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Check, Crown, Calendar, CreditCard, Loader2 } from 'lucide-react';
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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
    if (!window.confirm('Are you sure you want to cancel? We will contact you soon for funding.')) {
      return;
    }

    try {
      setIsCanceling(true);
      const token = getToken();
      await axios.post(`${API_URL}/payments/subscription/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Subscription canceled successfully');
      fetchUserData();
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      toast.error(error.response?.data?.message || 'Error canceling subscription');
    } finally {
      setIsCanceling(false);
    }
  };

  const currentPlan = userData?.subscription?.status === 'active' ? {
    type: userData.subscription.planId.charAt(0).toUpperCase() + userData.subscription.planId.slice(1),
    status: 'Active',
    startDate: new Date(userData.subscription.startDate).toLocaleDateString(),
    endDate: new Date(userData.subscription.endDate).toLocaleDateString(),
    amount: userData.subscription.planId === 'monthly' ? 49.99 : userData.subscription.planId === '3months' ? 129.99 : 449.99
  } : {
    type: 'Free',
    status: 'Inactive',
    startDate: '-',
    endDate: '-',
    amount: 0
  };

  const plans = [
    {
      id: 'monthly',
      name: 'Monthly',
      price: 49.99,
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
      price: 129.99,
      originalPrice: 149.97,
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
      price: 449.99,
      originalPrice: 599.88,
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

  return (
    <div className="space-y-8">
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
                  <p className="font-bold text-foreground">{currentPlan.amount} USD</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {currentPlan.status === 'Active' && (
              <Button 
                variant="outline" 
                className="h-12 px-6 rounded-xl border-2 text-red-500 border-red-100 hover:bg-red-50 hover:border-red-200"
                onClick={handleCancelSubscription}
                disabled={isCanceling}
              >
                {isCanceling ? <Loader2 className="animate-spin" size={20} /> : 'Cancel Subscription'}
              </Button>
            )}
            <Button className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
              Manage Billing
            </Button>
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
                  <span className="text-lg text-muted-foreground ml-2">USD</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{plan.duration}</p>
                {plan.discount && (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm line-through text-muted-foreground">
                      {plan.originalPrice} USD
                    </span>
                    <Badge className="bg-accent/10 text-accent border-0 px-3 py-1 text-xs font-bold">
                      {plan.discount}
                    </Badge>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check size={16} className="text-accent" />
                    </div>
                    <span className="text-muted-foreground leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>

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
  );
}
