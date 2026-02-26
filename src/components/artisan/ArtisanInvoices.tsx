import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Receipt, Download, Eye, Check, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';

export default function ArtisanInvoices() {
  const [view, setView] = useState<'list' | 'create'>('list');

  const invoices = [
    {
      id: 'INV-2024-101',
      project: 'Villa Construction - Tunis',
      amount: 45000,
      status: 'paid',
      dueDate: '2026-02-15',
      paidDate: '2026-02-10',
      client: 'Mohamed Ali'
    },
    {
      id: 'INV-2024-102',
      project: 'Office Renovation',
      amount: 23000,
      status: 'pending',
      dueDate: '2026-03-01',
      paidDate: null,
      client: 'Tech Solutions SA'
    },
    {
      id: 'INV-2024-103',
      project: 'Apartment Restoration',
      amount: 31000,
      status: 'pending',
      dueDate: '2026-02-25',
      paidDate: null,
      client: 'Sara Ben Ahmed'
    },
    {
      id: 'INV-2024-100',
      project: 'Shopping Mall Extension',
      amount: 89000,
      status: 'overdue',
      dueDate: '2026-01-30',
      paidDate: null,
      client: 'Mall Management Co'
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-accent/10 text-accent border-accent/20';
      case 'pending': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'overdue': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <Check size={20} />;
      case 'pending': return <Clock size={20} />;
      case 'overdue': return <AlertCircle size={20} />;
      default: return null;
    }
  };

  const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
  const pendingAmount = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0);
  const overdueAmount = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0);

  if (view === 'create') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="outline" 
          onClick={() => setView('list')} 
          className="mb-6 rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Invoices
        </Button>
        <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">Generate New Invoice</h2>
          <form className="space-y-6" onSubmit={(e) => {
            e.preventDefault();
            setView('list');
          }}>
            <div className="space-y-2">
              <Label htmlFor="project" className="text-base font-semibold">Select Project</Label>
              <select
                id="project"
                className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                required
              >
                <option value="">Choose a project...</option>
                <option value="1">Villa Construction - Tunis</option>
                <option value="2">Office Renovation</option>
                <option value="3">Apartment Restoration</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client" className="text-base font-semibold">Client Name</Label>
              <Input
                id="client"
                type="text"
                placeholder="Client name"
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-base font-semibold">Total Amount (TND)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">Description / Items</Label>
              <Textarea
                id="description"
                placeholder="List items, services, or work completed..."
                rows={6}
                className="rounded-xl border-2 border-gray-200 focus:border-primary"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="issueDate" className="text-base font-semibold">Issue Date</Label>
                <Input 
                  id="issueDate" 
                  type="date" 
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-base font-semibold">Due Date</Label>
                <Input 
                  id="dueDate" 
                  type="date" 
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                  required 
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
              >
                Generate Invoice
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setView('list')}
                className="h-12 px-8 rounded-xl border-2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Invoices</h1>
          <p className="text-lg text-muted-foreground">Manage project invoices and payments</p>
        </div>
        <Button
          onClick={() => setView('create')}
          className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
        >
          <Plus size={20} className="mr-2" />
          Generate Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <StatsCard
          label="Total Revenue"
          value={`${totalRevenue.toLocaleString()} TND`}
          icon={<Check size={28} />}
          color="#10B981"
          trend="+12%"
          trendUp={true}
        />
        <StatsCard
          label="Pending"
          value={`${pendingAmount.toLocaleString()} TND`}
          icon={<Clock size={28} />}
          color="#F59E0B"
          subtitle="Awaiting payment"
        />
        <StatsCard
          label="Overdue"
          value={`${overdueAmount.toLocaleString()} TND`}
          icon={<AlertCircle size={28} />}
          color="#EF4444"
          subtitle="Needs attention"
        />
      </div>

      {/* Invoices List */}
      <div className="space-y-4">
        {invoices.map((invoice) => (
          <Card key={invoice.id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-foreground">Invoice #{invoice.id}</h3>
                  <Badge className={`${getStatusColor(invoice.status)} px-4 py-1.5 text-sm font-semibold flex items-center gap-2 border-2`}>
                    {getStatusIcon(invoice.status)}
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Badge>
                </div>
                <p className="mb-2 text-muted-foreground">
                  <strong className="text-foreground">Project:</strong> {invoice.project}
                </p>
                <p className="text-muted-foreground mb-4">
                  <strong className="text-foreground">Client:</strong> {invoice.client}
                </p>
                <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                  <span>Due: <strong className="text-foreground">{invoice.dueDate}</strong></span>
                  {invoice.paidDate && <span>Paid: <strong className="text-accent">{invoice.paidDate}</strong></span>}
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
                  <Button variant="outline" size="sm" className="rounded-xl border-2 h-10">
                    <Eye size={16} className="mr-2" />
                    View
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl border-2 h-10">
                    <Download size={16} className="mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}