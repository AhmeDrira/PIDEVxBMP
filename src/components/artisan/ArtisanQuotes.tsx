import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, FileText, Download, Eye, Clock, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';

export default function ArtisanQuotes() {
  const [view, setView] = useState<'list' | 'create'>('list');

  const quotes = [
    {
      id: 'Q-2024-045',
      project: 'Villa Construction - Tunis',
      amount: 45000,
      description: 'Materials and labor for foundation work',
      status: 'approved',
      createdDate: '2026-02-01',
      validUntil: '2026-03-01'
    },
    {
      id: 'Q-2024-046',
      project: 'Office Renovation',
      amount: 23000,
      description: 'Complete interior renovation quote',
      status: 'pending',
      createdDate: '2026-02-05',
      validUntil: '2026-03-05'
    },
    {
      id: 'Q-2024-047',
      project: 'Apartment Restoration',
      amount: 31000,
      description: 'Restoration and modernization work',
      status: 'pending',
      createdDate: '2026-02-07',
      validUntil: '2026-03-07'
    },
    {
      id: 'Q-2024-044',
      project: 'Shopping Mall Extension',
      amount: 89000,
      description: 'Extension structural work',
      status: 'rejected',
      createdDate: '2026-01-20',
      validUntil: '2026-02-20'
    },
  ];

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

  if (view === 'create') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="outline" 
          onClick={() => setView('list')} 
          className="mb-6 rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Quotes
        </Button>
        <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">Generate New Quote</h2>
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
              <Label htmlFor="amount" className="text-base font-semibold">Estimated Amount (TND)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the work, materials, and services included..."
                rows={6}
                className="rounded-xl border-2 border-gray-200 focus:border-primary"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="validUntil" className="text-base font-semibold">Valid Until</Label>
                <Input 
                  id="validUntil" 
                  type="date" 
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentTerms" className="text-base font-semibold">Payment Terms</Label>
                <Textarea
                  id="paymentTerms"
                  placeholder="e.g., 50% upfront upon approval, 50% upon completion"
                  rows={3}
                  className="rounded-xl border-2 border-gray-200 focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
              >
                Generate Quote
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Quotes</h1>
          <p className="text-lg text-muted-foreground">Manage project quotes and estimates</p>
        </div>
        <Button
          onClick={() => setView('create')}
          className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
        >
          <Plus size={20} className="mr-2" />
          Generate Quote
        </Button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <StatsCard
          label="Total Quotes"
          value={quotes.length}
          icon={<FileText size={28} />}
          color="#1E40AF"
          subtitle="All time"
        />
        <StatsCard
          label="Approved"
          value={quotes.filter(q => q.status === 'approved').length}
          icon={<CheckCircle size={28} />}
          color="#10B981"
          trend="+2 this month"
          trendUp={true}
        />
        <StatsCard
          label="Pending"
          value={quotes.filter(q => q.status === 'pending').length}
          icon={<Clock size={28} />}
          color="#F59E0B"
          subtitle="Awaiting response"
        />
      </div>

      {/* Quotes List */}
      <div className="space-y-4">
        {quotes.map((quote) => (
          <Card key={quote.id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-foreground">Quote #{quote.id}</h3>
                  <Badge className={`${getStatusColor(quote.status)} px-4 py-1.5 text-sm font-semibold flex items-center gap-2 border-2`}>
                    {getStatusIcon(quote.status)}
                    {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                  </Badge>
                </div>
                <p className="mb-3 text-muted-foreground">
                  <strong className="text-foreground">Project:</strong> {quote.project}
                </p>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  {quote.description}
                </p>
                <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                  <span>Created: <strong className="text-foreground">{quote.createdDate}</strong></span>
                  <span>Valid until: <strong className="text-foreground">{quote.validUntil}</strong></span>
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