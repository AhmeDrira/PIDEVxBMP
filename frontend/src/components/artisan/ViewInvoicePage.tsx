import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, Download, Receipt, Calendar, User, Package, CreditCard } from 'lucide-react';

interface ViewInvoicePageProps {
  invoiceId?: string;
  onBack?: () => void;
}

export default function ViewInvoicePage({ invoiceId, onBack }: ViewInvoicePageProps) {
  // Mock invoice data - in real app this would come from API/props
  const invoice = {
    id: invoiceId || 'INV-2024-001',
    title: 'Villa Construction Project - Phase 1',
    projectReference: 'PROJ-2024-056',
    client: {
      name: 'Mohamed Ali',
      email: 'mohamed.ali@email.com',
      phone: '+216 98 765 432',
      address: 'Tunis, Tunisia'
    },
    date: '2024-02-20',
    dueDate: '2024-03-20',
    status: 'paid',
    paymentMethod: 'Bank Transfer',
    paymentDate: '2024-02-25',
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
    notes: 'Thank you for your business. Payment received on time.',
    subtotal: 22000,
    tax: 4180,
    discount: 0,
    total: 26180,
    amountPaid: 26180,
    amountDue: 0
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-accent/10 text-accent';
      case 'pending': return 'bg-secondary/10 text-secondary';
      case 'overdue': return 'bg-destructive/10 text-destructive';
      case 'partially-paid': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending': return 'Pending Payment';
      case 'overdue': return 'Overdue';
      case 'partially-paid': return 'Partially Paid';
      default: return status;
    }
  };

  const handleDownload = () => {
    // In real app, this would trigger PDF download
    alert('Downloading invoice as PDF...');
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
          Back to Invoices
        </Button>
      )}

      {/* Header Card */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Receipt size={32} className="text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Invoice #{invoice.id}</h1>
            </div>
            <Badge className={`${getStatusColor(invoice.status)} text-sm px-3 py-1 border-0`}>
              {getStatusLabel(invoice.status)}
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
              <Receipt size={20} className="text-muted-foreground mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Title</p>
                <p className="font-semibold text-foreground">{invoice.title}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Package size={20} className="text-muted-foreground mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Project Reference</p>
                <p className="font-semibold text-foreground">{invoice.projectReference}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar size={20} className="text-muted-foreground mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Invoice Date</p>
                <p className="font-semibold text-foreground">{new Date(invoice.date).toLocaleDateString('en-GB')}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar size={20} className="text-muted-foreground mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Due Date</p>
                <p className="font-semibold text-foreground">{new Date(invoice.dueDate).toLocaleDateString('en-GB')}</p>
              </div>
            </div>

            {invoice.paymentDate && (
              <div className="flex items-start gap-3">
                <CreditCard size={20} className="text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Payment Date</p>
                  <p className="font-semibold text-foreground">{new Date(invoice.paymentDate).toLocaleDateString('en-GB')}</p>
                </div>
              </div>
            )}
          </div>

          <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <User size={20} className="text-primary" />
              <h3 className="font-bold text-foreground">Client Information</h3>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">{invoice.client.name}</p>
              <p className="text-sm text-muted-foreground">{invoice.client.email}</p>
              <p className="text-sm text-muted-foreground">{invoice.client.phone}</p>
              <p className="text-sm text-muted-foreground">{invoice.client.address}</p>
            </div>
            {invoice.paymentMethod && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                <p className="font-semibold text-foreground">{invoice.paymentMethod}</p>
              </div>
            )}
          </Card>
        </div>
      </Card>

      {/* Items Table */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Invoice Items</h2>
        
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
              {invoice.items.map((item, index) => (
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
              <span className="font-semibold text-foreground">{invoice.subtotal.toFixed(2)} TND</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gray-50">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-semibold text-destructive">-{invoice.discount.toFixed(2)} TND</span>
              </div>
            )}
            <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gray-50">
              <span className="text-muted-foreground">Tax (19%):</span>
              <span className="font-semibold text-foreground">{invoice.tax.toFixed(2)} TND</span>
            </div>
            <div className="flex justify-between items-center py-4 px-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/20 border-2 border-primary/20">
              <span className="text-lg font-bold text-foreground">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">{invoice.total.toFixed(2)} TND</span>
            </div>
            {invoice.amountPaid > 0 && (
              <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-accent/10">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-semibold text-accent">{invoice.amountPaid.toFixed(2)} TND</span>
              </div>
            )}
            {invoice.amountDue > 0 && (
              <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-destructive/10">
                <span className="text-muted-foreground">Amount Due:</span>
                <span className="font-semibold text-destructive">{invoice.amountDue.toFixed(2)} TND</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Notes */}
      {invoice.notes && (
        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
          <h3 className="text-xl font-bold text-foreground mb-4">Notes</h3>
          <p className="text-muted-foreground leading-relaxed">{invoice.notes}</p>
        </Card>
      )}
    </div>
  );
}
