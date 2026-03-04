import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowLeft, Receipt, Calendar, MapPin, Download, User, Mail, Phone, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface InvoiceDetailProps {
  invoiceId: string;
  onBack: () => void;
}

export default function InvoiceDetail({ invoiceId, onBack }: InvoiceDetailProps) {
  const invoice = {
    id: invoiceId,
    project: {
      name: 'Villa Construction - Tunis',
      location: 'La Marsa, Tunis',
    },
    client: {
      name: 'Mohamed Ali',
      email: 'mohamed.ali@example.com',
      phone: '+216 XX XXX XXX',
      address: 'La Marsa, Tunis, Tunisia'
    },
    items: [
      { description: 'Foundation work - Phase 1', quantity: 1, unitPrice: 15000, total: 15000 },
      { description: 'Concrete materials (Grade 30)', quantity: 150, unitPrice: 180, total: 27000 },
      { description: 'Steel reinforcement', quantity: 15, unitPrice: 450, total: 6750 },
      { description: 'Labor and supervision - Week 1-2', quantity: 1, unitPrice: 3000, total: 3000 },
    ],
    subtotal: 51750,
    tax: 9832.5,
    total: 61582.5,
    status: 'paid',
    issueDate: '2026-02-10',
    dueDate: '2026-02-25',
    paidDate: '2026-02-15',
    paymentMethod: 'Bank Transfer',
    notes: 'Payment received in full. Thank you for your business!'
  };

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
      case 'paid': return <CheckCircle size={20} />;
      case 'pending': return <Clock size={20} />;
      case 'overdue': return <AlertCircle size={20} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8">
      <Button variant="ghost" onClick={onBack} className="hover:bg-white rounded-xl">
        <ArrowLeft size={20} className="mr-2" />
        Back to Invoices
      </Button>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Invoice #{invoice.id}</h1>
          <p className="text-lg text-muted-foreground">{invoice.project.name}</p>
        </div>
        <div className="flex gap-3">
          <Badge className={`${getStatusColor(invoice.status)} px-4 py-2 text-sm font-semibold flex items-center gap-2 border-2`}>
            {getStatusIcon(invoice.status)}
            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
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
          {/* Invoice Header */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg">
                  <Receipt size={32} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-primary mb-1">BMP.tn</h2>
                <p className="text-sm text-muted-foreground">Construction Marketplace</p>
              </div>
              <div className="text-right">
                <h3 className="text-3xl font-bold text-foreground mb-2">INVOICE</h3>
                <p className="text-lg text-muted-foreground">#{invoice.id}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 pb-8 border-b-2 border-gray-100">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">BILL TO</h4>
                <div className="space-y-2">
                  <p className="font-bold text-foreground text-lg">{invoice.client.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail size={14} />
                    <span>{invoice.client.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone size={14} />
                    <span>{invoice.client.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={14} />
                    <span>{invoice.client.address}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">PROJECT</h4>
                <div className="space-y-2">
                  <p className="font-bold text-foreground text-lg">{invoice.project.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={14} />
                    <span>{invoice.project.location}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Invoice Items */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-6">Items</h2>
            <div className="space-y-3">
              {invoice.items.map((item, index) => (
                <div key={index} className="p-5 rounded-xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground text-lg mb-2">{item.description}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Qty: {item.quantity}</span>
                        <span>•</span>
                        <span>Unit Price: {item.unitPrice.toLocaleString()} TND</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{item.total.toLocaleString()} TND</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t-2 border-gray-100">
              <div className="space-y-3 max-w-md ml-auto">
                <div className="flex justify-between text-lg">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold text-foreground">{invoice.subtotal.toLocaleString()} TND</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-muted-foreground">Tax (19%)</span>
                  <span className="font-semibold text-foreground">{invoice.tax.toLocaleString()} TND</span>
                </div>
                <div className="flex justify-between pt-4 border-t-2 border-gray-200">
                  <span className="text-2xl font-bold text-foreground">Total Amount</span>
                  <span className="text-3xl font-bold text-primary">{invoice.total.toLocaleString()} TND</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
              <h2 className="text-2xl font-bold text-foreground mb-4">Notes</h2>
              <div className="p-6 rounded-xl bg-accent/5 border-2 border-accent/20">
                <p className="text-foreground leading-relaxed">{invoice.notes}</p>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Invoice Details */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Invoice Details</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar size={20} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Issue Date</p>
                  <p className="font-bold text-foreground">{invoice.issueDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={20} className="text-secondary" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Due Date</p>
                  <p className="font-bold text-foreground">{invoice.dueDate}</p>
                </div>
              </div>
              {invoice.paidDate && (
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Paid Date</p>
                    <p className="font-bold text-accent">{invoice.paidDate}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Payment Information */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Payment Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <DollarSign size={20} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Payment Method</p>
                  <p className="font-bold text-foreground">{invoice.paymentMethod}</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20">
                <p className="text-xs text-muted-foreground font-medium mb-2">Total Amount</p>
                <p className="text-3xl font-bold text-primary">{invoice.total.toLocaleString()} TND</p>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-4">Actions</h3>
            <div className="space-y-3">
              <Button className="w-full h-11 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md">
                <Download size={18} className="mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" className="w-full h-11 rounded-xl border-2">
                Send to Client
              </Button>
              <Button variant="outline" className="w-full h-11 rounded-xl border-2">
                Print Invoice
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
