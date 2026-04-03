import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  ShoppingCart, User, MapPin, Truck, CreditCard, CheckCircle2,
  ArrowRight, ArrowLeft, Package, Shield, Clock, Check
} from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

import { useLanguage } from '../../context/LanguageContext';
interface CartItem {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  stock?: number;
  category?: string;
  manufacturer?: { companyName?: string; firstName?: string };
}

interface CheckoutData {
  personalInfo: { fullName: string; email: string; phone: string };
  shippingAddress: { address: string; city: string; state: string; postalCode: string; country: string };
  shippingMethod: 'standard';
}

interface CheckoutWizardProps {
  cart: CartItem[];
  onBack: () => void;
  onCheckout: (checkoutData: CheckoutData) => Promise<void>;
  isLoading: boolean;
  getManufacturerName: (item: any) => string;
  updateCartQuantity: (productId: string, delta: number) => void;
}

const STEPS = [
  { id: 0, label: 'Cart',     icon: ShoppingCart },
  { id: 1, label: 'Info',     icon: User },
  { id: 2, label: 'Address',  icon: MapPin },
  { id: 3, label: 'Shipping', icon: Truck },
  { id: 4, label: 'Payment',  icon: CreditCard },
];

const SHIPPING_COST = 15;

const TUNISIAN_STATES = [
  'Ariana','Beja','Ben Arous','Bizerte','Gabes','Gafsa','Jendouba',
  'Kairouan','Kasserine','Kebili','Kef','Mahdia','Manouba','Medenine',
  'Monastir','Nabeul','Sfax','Sidi Bouzid','Siliana','Sousse',
  'Tataouine','Tozeur','Tunis','Zaghouan',
];

const inputCls = (hasError: boolean) =>
  `h-11 rounded-xl border-2 ${hasError ? '' : 'border-border focus:border-blue-500'}`;

const inputStyle = (hasError: boolean): React.CSSProperties =>
  hasError ? { borderColor: '#f87171', borderWidth: 2 } : {};

export default function CheckoutWizard({ cart, onBack, onCheckout, isLoading, getManufacturerName, updateCartQuantity }: CheckoutWizardProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  const [step, setStep] = useState(0);
  const [data, setData] = useState<CheckoutData>({
    personalInfo: { fullName: '', email: '', phone: '' },
    shippingAddress: { address: '', city: '', state: '', postalCode: '', country: 'Tunisia' },
    shippingMethod: 'standard',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const user = JSON.parse(raw);
        setData(prev => ({
          ...prev,
          personalInfo: {
            fullName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : prev.personalInfo.fullName,
            email: user.email || prev.personalInfo.email,
            phone: user.phone || prev.personalInfo.phone,
          },
        }));
      }
    } catch { /* ignore */ }
  }, []);

  const subtotal   = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const grandTotal = subtotal + SHIPPING_COST;

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!data.personalInfo.fullName.trim())  e.fullName = 'Full name is required';
      if (!data.personalInfo.email.trim())     e.email    = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.personalInfo.email)) e.email = 'Invalid email format';
      if (!data.personalInfo.phone.trim())     e.phone    = 'Phone number is required';
      else if (!/^[\d\s+()-]{8,}$/.test(data.personalInfo.phone)) e.phone = 'Invalid phone number';
    }
    if (s === 2) {
      if (!data.shippingAddress.address.trim())    e.address    = 'Address is required';
      if (!data.shippingAddress.city.trim())       e.city       = 'City is required';
      if (!data.shippingAddress.state)             e.state      = 'State/Governorate is required';
      if (!data.shippingAddress.postalCode.trim()) e.postalCode = 'Postal code is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => {
    if (step === 0 && cart.length === 0) return;
    if (!validateStep(step)) return;
    if (step < 4) setStep(step + 1);
  };

  const goBack = () => { if (step > 0) setStep(step - 1); };

  // ── ORDER SUMMARY (sidebar, used for all steps) ──
  const orderSummary = (
    <div className="sticky top-8 space-y-4">
      <Card className="p-5 bg-card rounded-2xl border border-border shadow-lg">
        <h3 className="text-lg font-bold text-foreground mb-4">Order Summary</h3>
        <div className="space-y-3 mb-4 max-h-52 overflow-y-auto">
          {cart.map(item => (
            <div key={item._id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">x{item.quantity}</p>
              </div>
              <p className="text-sm font-semibold">{(item.price * item.quantity).toFixed(2)} DT</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-3 border-t border-border">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal ({totalItems} items)</span>
            <span className="font-medium text-foreground">{subtotal.toFixed(2)} DT</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Shipping</span>
            <span className="font-medium text-foreground">{SHIPPING_COST.toFixed(2)} DT</span>
          </div>
          <div className="pt-3 border-t border-border flex justify-between">
            <span className="text-base font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">{grandTotal.toFixed(2)} DT</span>
          </div>
        </div>
      </Card>
      <Card className="p-4 bg-card rounded-2xl border border-border shadow-lg">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm"><Shield size={16} className="text-green-600" /><span>Secure checkout</span></div>
          <div className="flex items-center gap-2 text-sm"><Truck size={16} className="text-blue-600" /><span>Nationwide delivery</span></div>
          <div className="flex items-center gap-2 text-sm"><CheckCircle2 size={16} className="text-purple-600" /><span>Quality guaranteed</span></div>
        </div>
      </Card>
    </div>
  );

  // ── NAVIGATION BUTTONS ──
  const navButtons = (
    <div className="flex justify-between mt-6">
      {step > 0 ? (
        <Button variant="outline" onClick={goBack} className="h-12 px-6 rounded-xl border-2">
          <ArrowLeft size={18} className="mr-2" /> Back
        </Button>
      ) : <div />}
      {step < 4 ? (
        <Button
          onClick={goNext}
          disabled={step === 0 && cart.length === 0}
          className="h-12 px-8 rounded-xl shadow-lg"
          style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
        >
          Continue <ArrowRight size={18} className="ml-2" />
        </Button>
      ) : (
        <Button
          onClick={() => onCheckout(data)}
          disabled={isLoading || cart.length === 0}
          className="h-12 px-8 rounded-xl shadow-lg"
          style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CreditCard size={18} /> Pay {grandTotal.toFixed(2)} DT
            </span>
          )}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={step === 0 ? onBack : goBack} className="rounded-xl border-2">
        <ArrowLeft size={18} className="mr-2" /> {step === 0 ? 'Back to Cart' : 'Previous Step'}
      </Button>

      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive    = step === i;
          const isCompleted = step > i;
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: isCompleted ? '#22c55e' : isActive ? 'var(--primary, #2563eb)' : 'var(--muted)',
                    boxShadow: isActive ? '0 4px 14px rgba(37,99,235,0.3)' : 'none',
                  }}
                >
                  {isCompleted
                    ? <Check size={18} style={{ color: '#ffffff' }} />
                    : <Icon size={18} style={{ color: isActive ? '#ffffff' : '#9ca3af' }} />
                  }
                </div>
                <span className="text-xs mt-1.5 font-medium" style={{ color: isCompleted ? '#16a34a' : isActive ? 'var(--primary, #2563eb)' : '#9ca3af' }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="w-12 h-0.5 mx-1 mt-[-12px] transition-all duration-300"
                  style={{ backgroundColor: step > i ? '#22c55e' : 'var(--border)' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Centered content */}
      <div className="max-w-2xl mx-auto w-full">
        <div>

          {/* ── STEP 0: CART ── */}
          {step === 0 && (
            <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <ShoppingCart size={24} className="text-primary" />
                <h2 className="text-2xl font-bold">Review Your Cart</h2>
                <Badge variant="secondary" className="ml-auto">{totalItems} items</Badge>
              </div>
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart size={48} className="mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item._id} className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/20 transition-all">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">{getManufacturerName(item)}</p>
                        <p className="text-sm font-medium text-primary">{item.price} DT / unit</p>
                      </div>
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2 py-1 border border-border">
                        <button type="button" className="w-7 h-7 rounded-md border border-border bg-card text-sm font-bold hover:bg-muted" onClick={() => updateCartQuantity(String(item._id), -1)}>-</button>
                        <span className="font-bold text-base min-w-[20px] text-center">{item.quantity}</span>
                        <button type="button" className="w-7 h-7 rounded-md border border-border bg-card text-sm font-bold hover:bg-muted" onClick={() => updateCartQuantity(String(item._id), 1)}>+</button>
                      </div>
                      <p className="text-lg font-bold text-foreground min-w-[80px] text-right">{(item.price * item.quantity).toFixed(2)} DT</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ── STEP 1: PERSONAL INFO (inline — no inner component to avoid focus loss) ── */}
          {step === 1 && (
            <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <User size={24} className="text-primary" />
                <h2 className="text-2xl font-bold">Personal Information</h2>
              </div>
              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Full Name *</Label>
                  <Input
                    value={data.personalInfo.fullName}
                    onChange={e => setData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, fullName: e.target.value } }))}
                    placeholder="Ahmed Ben Ali"
                    className={inputCls(!!errors.fullName)}
                    style={inputStyle(!!errors.fullName)}
                  />
                  {errors.fullName && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.fullName}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Email Address *</Label>
                  <Input
                    type="email"
                    value={data.personalInfo.email}
                    onChange={e => setData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, email: e.target.value } }))}
                    placeholder="ahmed@example.com"
                    className={inputCls(!!errors.email)}
                    style={inputStyle(!!errors.email)}
                  />
                  {errors.email && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.email}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Phone Number *</Label>
                  <Input
                    value={data.personalInfo.phone}
                    onChange={e => setData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, phone: e.target.value } }))}
                    placeholder="+216 XX XXX XXX"
                    className={inputCls(!!errors.phone)}
                    style={inputStyle(!!errors.phone)}
                  />
                  {errors.phone && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.phone}</p>}
                </div>
              </div>
            </Card>
          )}

          {/* ── STEP 2: SHIPPING ADDRESS (inline) ── */}
          {step === 2 && (
            <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <MapPin size={24} className="text-primary" />
                <h2 className="text-2xl font-bold">Shipping Address</h2>
              </div>
              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Street Address *</Label>
                  <Input
                    value={data.shippingAddress.address}
                    onChange={e => setData(prev => ({ ...prev, shippingAddress: { ...prev.shippingAddress, address: e.target.value } }))}
                    placeholder="123 Rue de la République"
                    className={inputCls(!!errors.address)}
                    style={inputStyle(!!errors.address)}
                  />
                  {errors.address && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.address}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">City *</Label>
                    <Input
                      value={data.shippingAddress.city}
                      onChange={e => setData(prev => ({ ...prev, shippingAddress: { ...prev.shippingAddress, city: e.target.value } }))}
                      placeholder="Tunis"
                      className={inputCls(!!errors.city)}
                      style={inputStyle(!!errors.city)}
                    />
                    {errors.city && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.city}</p>}
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Governorate *</Label>
                    <select
                      value={data.shippingAddress.state}
                      onChange={e => setData(prev => ({ ...prev, shippingAddress: { ...prev.shippingAddress, state: e.target.value } }))}
                      className="w-full h-11 rounded-xl border-2 px-3 text-sm bg-card border-border focus:border-blue-500"
                      style={inputStyle(!!errors.state)}
                    >
                      <option value="">Select...</option>
                      {TUNISIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.state && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.state}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Postal Code *</Label>
                    <Input
                      value={data.shippingAddress.postalCode}
                      onChange={e => setData(prev => ({ ...prev, shippingAddress: { ...prev.shippingAddress, postalCode: e.target.value } }))}
                      placeholder="1000"
                      className={inputCls(!!errors.postalCode)}
                      style={inputStyle(!!errors.postalCode)}
                    />
                    {errors.postalCode && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.postalCode}</p>}
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Country</Label>
                    <Input value="Tunisia" disabled className="h-11 rounded-xl bg-muted/50" />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ── STEP 3: SHIPPING METHOD ── */}
          {step === 3 && (
            <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <Truck size={24} className="text-primary" />
                <h2 className="text-2xl font-bold">Shipping Method</h2>
              </div>
              <div className="p-5 rounded-xl border-2 border-primary bg-primary/5 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary dark:bg-blue-600 text-white">
                      <Package size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Standard Delivery</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock size={14} /> 3-5 business days</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{SHIPPING_COST.toFixed(2)} DT</p>
                    <Badge className="bg-primary/10 text-primary border-0 text-xs">Selected</Badge>
                  </div>
                </div>
              </div>
              <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2 text-blue-700 text-sm">
                  <Shield size={16} />
                  <span className="font-medium">Secure & insured shipping across Tunisia</span>
                </div>
              </div>
            </Card>
          )}

          {/* ── STEP 4: REVIEW & PAY ── */}
          {step === 4 && (
            <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <CreditCard size={24} className="text-primary" />
                <h2 className="text-2xl font-bold">Review & Pay</h2>
              </div>
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contact</h4>
                  <p className="font-medium">{data.personalInfo.fullName}</p>
                  <p className="text-sm text-muted-foreground">{data.personalInfo.email} · {data.personalInfo.phone}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Shipping Address</h4>
                  <p className="font-medium">{data.shippingAddress.address}</p>
                  <p className="text-sm text-muted-foreground">{data.shippingAddress.city}, {data.shippingAddress.state} {data.shippingAddress.postalCode}</p>
                  <p className="text-sm text-muted-foreground">{data.shippingAddress.country}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Shipping Method</h4>
                  <p className="font-medium">Standard Delivery (3-5 days) — {SHIPPING_COST.toFixed(2)} DT</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Items ({totalItems})</h4>
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item._id} className="flex justify-between text-sm">
                        <span>{item.name} x{item.quantity}</span>
                        <span className="font-medium">{(item.price * item.quantity).toFixed(2)} DT</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total to Pay</span>
                    <span className="text-2xl font-bold text-primary">{grandTotal.toFixed(2)} DT</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield size={16} className="text-green-600" />
                  <span>Secure payment powered by <strong>Stripe</strong>. Your card details are encrypted.</span>
                </div>
              </div>
            </Card>
          )}

          {navButtons}
        </div>
      </div>
    </div>
  );
}
