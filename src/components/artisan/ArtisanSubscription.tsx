import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Check, Crown, Calendar, CreditCard } from 'lucide-react';
import { Badge } from '../ui/badge';

export default function ArtisanSubscription() {
  const currentPlan = {
    type: 'Monthly',
    status: 'Active',
    startDate: '2026-02-01',
    endDate: '2026-03-01',
    amount: 49.99
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
                  <p className="font-bold text-foreground">{currentPlan.amount} TND</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="h-12 px-6 rounded-xl border-2">
              Cancel Subscription
            </Button>
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
                className={`w-full h-12 text-white rounded-xl shadow-lg ${
                  plan.popular 
                    ? 'bg-secondary hover:bg-secondary/90' 
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {currentPlan.type.toLowerCase() === plan.name.toLowerCase() 
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
              {[
                { date: '2026-02-01', plan: 'Monthly', amount: 49.99, status: 'Paid' },
                { date: '2026-01-01', plan: 'Monthly', amount: 49.99, status: 'Paid' },
                { date: '2025-12-01', plan: 'Monthly', amount: 49.99, status: 'Paid' },
              ].map((payment, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-4 font-medium text-foreground">{payment.date}</td>
                  <td className="py-4 text-foreground">{payment.plan}</td>
                  <td className="py-4 font-bold text-primary">{payment.amount} TND</td>
                  <td className="py-4">
                    <Badge className="bg-accent/10 text-accent border-0 px-3 py-1 text-xs font-semibold">
                      {payment.status}
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
        </div>
      </Card>
    </div>
  );
}
