import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowLeft, FileText, Calendar, MapPin, Download, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react';

interface QuoteDetailProps {
  quoteId: string;
  onBack: () => void;
}

export default function QuoteDetail({ quoteId, onBack }: QuoteDetailProps) {
  const quote = {
    id: quoteId,
    project: {
      name: 'Villa Construction - Tunis',
      location: 'La Marsa, Tunis',
      client: 'Mohamed Ali',
      clientEmail: 'mohamed.ali@example.com',
      clientPhone: '+216 XX XXX XXX'
    },
    amount: 45000,
    description: 'Complete materials and labor for foundation work including excavation, concrete pouring, reinforcement, and waterproofing.',
    breakdown: [
      { item: 'Excavation work', quantity: '200 m³', unitPrice: 25, total: 5000 },
      { item: 'Concrete (Grade 30)', quantity: '150 m³', unitPrice: 180, total: 27000 },
      { item: 'Steel reinforcement', quantity: '15 tons', unitPrice: 450, total: 6750 },
      { item: 'Waterproofing membrane', quantity: '500 m²', unitPrice: 8, total: 4000 },
      { item: 'Labor and supervision', quantity: '1', unitPrice: 2250, total: 2250 },
    ],
    subtotal: 45000,
    tax: 8550,
    total: 53550,
    status: 'approved',
    createdDate: '2026-02-01',
    validUntil: '2026-03-01',
    approvedDate: '2026-02-05',
    paymentTerms: '50% upfront upon approval, 25% at project midpoint, 25% upon completion',
    notes: 'All materials are premium quality. Timeline includes weather delays buffer.'
  };

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

  return (
    <div className="space-y-8">
      <Button variant="ghost" onClick={onBack} className="hover:bg-white rounded-xl">
        <ArrowLeft size={20} className="mr-2" />
        Back to Quotes
      </Button>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Quote #{quote.id}</h1>
          <p className="text-lg text-muted-foreground">{quote.project.name}</p>
        </div>
        <div className="flex gap-3">
          <Badge className={`${getStatusColor(quote.status)} px-4 py-2 text-sm font-semibold flex items-center gap-2 border-2`}>
            {getStatusIcon(quote.status)}
            {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
          </Badge>
          <Button variant="outline" className="h-11 px-6 rounded-xl border-2">
            <Download size={18} className="mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Information */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-6">Project Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText size={24} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Project Name</p>
                  <p className="font-bold text-foreground">{quote.project.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <MapPin size={24} className="text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Location</p>
                  <p className="font-bold text-foreground">{quote.project.location}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <CheckCircle size={24} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Client</p>
                  <p className="font-bold text-foreground">{quote.project.client}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Calendar size={24} className="text-purple-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Valid Until</p>
                  <p className="font-bold text-foreground">{quote.validUntil}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Quote Details */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-4">Description</h2>
            <p className="text-muted-foreground leading-relaxed mb-8">{quote.description}</p>

            <h2 className="text-2xl font-bold text-foreground mb-6">Cost Breakdown</h2>
            <div className="space-y-3">
              {quote.breakdown.map((item, index) => (
                <div key={index} className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-foreground">{item.item}</h4>
                    <p className="text-xl font-bold text-primary">{item.total.toLocaleString()} TND</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Quantity: {item.quantity}</span>
                    <span>•</span>
                    <span>Unit Price: {item.unitPrice} TND</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Payment Terms */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-4">Payment Terms</h2>
            <div className="p-6 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20">
              <p className="text-foreground leading-relaxed">{quote.paymentTerms}</p>
            </div>
            {quote.notes && (
              <div className="mt-4 p-6 rounded-xl bg-secondary/5 border-2 border-secondary/20">
                <p className="text-sm text-muted-foreground font-medium mb-2">Additional Notes</p>
                <p className="text-foreground">{quote.notes}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quote Summary */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Quote Summary</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar size={20} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Created</p>
                  <p className="font-bold text-foreground">{quote.createdDate}</p>
                </div>
              </div>
              {quote.approvedDate && (
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Approved</p>
                    <p className="font-bold text-foreground">{quote.approvedDate}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Amount Summary */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Amount Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground">{quote.subtotal.toLocaleString()} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (19%)</span>
                <span className="font-semibold text-foreground">{quote.tax.toLocaleString()} TND</span>
              </div>
              <div className="pt-4 border-t-2 border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-foreground">Total</span>
                  <span className="text-3xl font-bold text-primary">{quote.total.toLocaleString()} TND</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-4">Actions</h3>
            <div className="space-y-3">
              {quote.status === 'approved' && (
                <Button className="w-full h-11 text-white bg-accent hover:bg-accent/90 rounded-xl shadow-md">
                  Convert to Invoice
                </Button>
              )}
              <Button variant="outline" className="w-full h-11 rounded-xl border-2">
                Send to Client
              </Button>
              <Button variant="outline" className="w-full h-11 rounded-xl border-2">
                Edit Quote
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
