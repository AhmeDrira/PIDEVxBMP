import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, Download, FileText, Calendar, User, Package } from 'lucide-react';

interface ViewQuotePageProps {
  quoteId?: string;
  onBack?: () => void;
}

export default function ViewQuotePage({ quoteId, onBack }: ViewQuotePageProps) {
  // Mock quote data - in real app this would come from API/props
  const quote = {
    id: quoteId || 'QT-2024-001',
    title: 'Villa Construction Project - Phase 1',
    projectReference: 'PROJ-2024-056',
    client: {
      name: 'Mohamed Ali',
      email: 'mohamed.ali@email.com',
      phone: '+216 98 765 432',
      address: 'Tunis, Tunisia'
    },
    date: '2024-02-15',
    validUntil: '2024-03-15',
    status: 'pending',
    items: [
      {
        id: 1,
        description: 'Premium Cement - 50kg',
        quantity: 100,
        unit: 'bags',
        unitPrice: 45,
        total: 4500
      },
      {
        id: 2,
        description: 'Steel Rebar 12mm',
        quantity: 50,
        unit: 'pieces',
        unitPrice: 120,
        total: 6000
      },
      {
        id: 3,
        description: 'Ceramic Floor Tiles',
        quantity: 200,
        unit: 'boxes',
        unitPrice: 35,
        total: 7000
      },
      {
        id: 4,
        description: 'Labor Cost - Construction Work',
        quantity: 30,
        unit: 'days',
        unitPrice: 150,
        total: 4500
      }
    ],
    notes: 'This quote includes all materials and labor for Phase 1 of the villa construction. Prices are valid for 30 days from the issue date.',
    paymentTerms: '50% deposit upon acceptance, 30% at mid-completion, 20% upon final completion',
    subtotal: 22000,
    tax: 4180,
    discount: 0,
    total: 26180
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-accent/10 text-accent';
      case 'pending': return 'bg-secondary/10 text-secondary';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleDownload = () => {
    // In real app, this would trigger PDF download
    alert('Downloading quote as PDF...');
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {onBack && (
        <Button 
          variant="outline" 
          onClick={onBack} 
          className="rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Quotes
        </Button>
      )}

      {/* Header Card */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileText size={32} className="text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Quote #{quote.id}</h1>
            </div>
            <Badge className={`${getStatusColor(quote.status)} text-sm px-3 py-1 border-0`}>
              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
            </Badge>
          </div>
          <Button
            onClick={handleDownload}
            className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
          >
            <Download size={20} className="mr-2" />
            Download PDF
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <FileText size={20} className="text-muted-foreground mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Title</p>
                <p className="font-semibold text-foreground">{quote.title}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Package size={20} className="text-muted-foreground mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Project Reference</p>
                <p className="font-semibold text-foreground">{quote.projectReference}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar size={20} className="text-muted-foreground mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Issue Date</p>
                <p className="font-semibold text-foreground">{new Date(quote.date).toLocaleDateString('en-GB')}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar size={20} className="text-muted-foreground mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Valid Until</p>
                <p className="font-semibold text-foreground">{new Date(quote.validUntil).toLocaleDateString('en-GB')}</p>
              </div>
            </div>
          </div>

          <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <User size={20} className="text-primary" />
              <h3 className="font-bold text-foreground">Client Information</h3>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">{quote.client.name}</p>
              <p className="text-sm text-muted-foreground">{quote.client.email}</p>
              <p className="text-sm text-muted-foreground">{quote.client.phone}</p>
              <p className="text-sm text-muted-foreground">{quote.client.address}</p>
            </div>
          </Card>
        </div>
      </Card>

      {/* Items Table */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Quote Items</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-4 px-4 font-semibold text-foreground">#</th>
                <th className="text-left py-4 px-4 font-semibold text-foreground">Description</th>
                <th className="text-center py-4 px-4 font-semibold text-foreground">Quantity</th>
                <th className="text-right py-4 px-4 font-semibold text-foreground">Unit Price</th>
                <th className="text-right py-4 px-4 font-semibold text-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, index) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4 text-muted-foreground">{index + 1}</td>
                  <td className="py-4 px-4">
                    <p className="font-medium text-foreground">{item.description}</p>
                  </td>
                  <td className="py-4 px-4 text-center text-foreground">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-4 px-4 text-right text-foreground">
                    {item.unitPrice.toFixed(2)} TND
                  </td>
                  <td className="py-4 px-4 text-right font-semibold text-foreground">
                    {item.total.toFixed(2)} TND
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-end">
          <div className="w-full md:w-1/2 lg:w-1/3 space-y-4">
            <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gray-50">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-semibold text-foreground">{quote.subtotal.toFixed(2)} TND</span>
            </div>
            {quote.discount > 0 && (
              <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gray-50">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-semibold text-destructive">-{quote.discount.toFixed(2)} TND</span>
              </div>
            )}
            <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gray-50">
              <span className="text-muted-foreground">Tax (19%):</span>
              <span className="font-semibold text-foreground">{quote.tax.toFixed(2)} TND</span>
            </div>
            <div className="flex justify-between items-center py-4 px-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/20 border-2 border-primary/20">
              <span className="text-lg font-bold text-foreground">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">{quote.total.toFixed(2)} TND</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment Terms & Notes */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
          <h3 className="text-xl font-bold text-foreground mb-4">Payment Terms</h3>
          <p className="text-muted-foreground leading-relaxed">{quote.paymentTerms}</p>
        </Card>

        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
          <h3 className="text-xl font-bold text-foreground mb-4">Notes</h3>
          <p className="text-muted-foreground leading-relaxed">{quote.notes}</p>
        </Card>
      </div>
    </div>
  );
}
