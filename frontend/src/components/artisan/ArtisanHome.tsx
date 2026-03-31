import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  CreditCard,
  FileText,
  FolderKanban,
  Receipt,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import ProfileCompletionBanner from '../common/ProfileCompletionBanner';

interface ArtisanHomeProps {
  onNavigate: (view: string, projectId?: string) => void;
}

interface ProductMaterial {
  _id?: string;
  name?: string;
  category?: string;
}

interface Project {
  _id: string;
  title?: string;
  description?: string;
  location?: string;
  budget?: number;
  status?: string;
  priority?: string;
  progress?: number;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  materials?: ProductMaterial[];
}

interface Quote {
  _id: string;
  quoteNumber?: string;
  amount?: number;
  status?: 'pending' | 'approved' | 'rejected' | string;
  createdAt?: string;
  updatedAt?: string;
  project?: {
    title?: string;
  } | null;
}

interface Invoice {
  _id: string;
  invoiceNumber?: string;
  clientName?: string;
  amount?: number;
  status?: 'pending' | 'paid' | 'overdue' | string;
  issueDate?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ActivityItem {
  date: Date;
  text: string;
  icon: React.ReactNode;
  color: string;
}

const CHART_COLORS = ['#1E40AF', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#14B8A6'];

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getTimeAgo = (date: Date) => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const years = Math.floor(seconds / 31536000);
  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  const months = Math.floor(seconds / 2592000);
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

const monthLabel = (date: Date) =>
  date.toLocaleString('en-US', { month: 'short' });

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl bg-muted/50 px-6 text-center">
      {message}
    </div>
  );
}

export default function ArtisanHome({ onNavigate }: ArtisanHomeProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const getToken = () => {
    let token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token && storedUser) {
      token = JSON.parse(storedUser).token;
    }
    return token;
  };

  const fetchAllData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);
      const token = getToken();
      if (!token) {
        setError('Session expired. Please login again.');
        return;
      }

      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [resProjects, resQuotes, resInvoices] = await Promise.all([
        axios.get<Project[]>(`${API_URL}/projects`, config),
        axios.get<Quote[]>(`${API_URL}/quotes`, config),
        axios.get<Invoice[]>(`${API_URL}/invoices`, config),
      ]);

      setProjects(Array.isArray(resProjects.data) ? resProjects.data : []);
      setQuotes(Array.isArray(resQuotes.data) ? resQuotes.data : []);
      setInvoices(Array.isArray(resInvoices.data) ? resInvoices.data : []);

      try {
        const userRes = await axios.get(`${API_URL}/auth/me`, config);
        setUserData(userRes.data);
      } catch {
        setUserData(null);
      }
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
      setError('Unable to load dashboard data.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchAllData(true);

    const handleFocusRefresh = () => fetchAllData(false);
    const handlePaymentRefresh = () => fetchAllData(false);

    window.addEventListener('focus', handleFocusRefresh);
    window.addEventListener('artisan-marketplace-payment-success', handlePaymentRefresh as EventListener);

    return () => {
      window.removeEventListener('focus', handleFocusRefresh);
      window.removeEventListener('artisan-marketplace-payment-success', handlePaymentRefresh as EventListener);
    };
  }, [fetchAllData]);

  const revenueSeries = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: monthLabel(d),
        paid: 0,
        pending: 0,
        total: 0,
      };
    });

    const monthMap = new Map(months.map((m) => [m.key, m]));

    invoices.forEach((invoice) => {
      const baseDate = parseDate(invoice.issueDate) || parseDate(invoice.createdAt);
      if (!baseDate) return;
      const key = `${baseDate.getFullYear()}-${baseDate.getMonth()}`;
      const target = monthMap.get(key);
      if (!target) return;

      const amount = safeNumber(invoice.amount);
      if (invoice.status === 'paid') {
        target.paid += amount;
      } else if (invoice.status === 'pending' || invoice.status === 'overdue') {
        target.pending += amount;
      }
      target.total += amount;
    });

    return months;
  }, [invoices]);

  const activitySeries = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: monthLabel(d),
        projects: 0,
        quotes: 0,
        invoices: 0,
      };
    });

    const monthMap = new Map(months.map((m) => [m.key, m]));

    projects.forEach((project) => {
      const created = parseDate(project.createdAt);
      if (!created) return;
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      const bucket = monthMap.get(key);
      if (bucket) bucket.projects += 1;
    });

    quotes.forEach((quote) => {
      const created = parseDate(quote.createdAt);
      if (!created) return;
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      const bucket = monthMap.get(key);
      if (bucket) bucket.quotes += 1;
    });

    invoices.forEach((invoice) => {
      const created = parseDate(invoice.createdAt) || parseDate(invoice.issueDate);
      if (!created) return;
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      const bucket = monthMap.get(key);
      if (bucket) bucket.invoices += 1;
    });

    return months;
  }, [invoices, projects, quotes]);

  const projectCompletionData = useMemo(() => {
    const activeCount = projects.filter((p) => p.status === 'active' || p.status === 'in-progress').length;
    const now = new Date();
    const completedThisMonth = projects.filter((p) => {
      if (p.status !== 'completed') return false;
      const d = parseDate(p.updatedAt) || parseDate(p.createdAt);
      if (!d) return false;
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const avgCompletion = projects.length
      ? Math.round(projects.reduce((sum, p) => sum + safeNumber(p.progress), 0) / projects.length)
      : 0;

    return {
      activeCount,
      completedThisMonth,
      avgCompletion,
      bars: [
        { name: 'Active', value: activeCount, color: '#1E40AF' },
        { name: 'Completed', value: completedThisMonth, color: '#10B981' },
      ],
    };
  }, [projects]);

  const quoteConversion = useMemo(() => {
    const sent = quotes.length;
    const accepted = quotes.filter((q) => q.status === 'approved').length;
    const rejected = quotes.filter((q) => q.status === 'rejected').length;
    const pending = quotes.filter((q) => q.status === 'pending').length;
    const rate = sent > 0 ? Math.round((accepted / sent) * 100) : 0;

    return { sent, accepted, rejected, pending, rate };
  }, [quotes]);

  const projectStatusSeries = useMemo(() => {
    const active = projects.filter((p) => p.status === 'active' || p.status === 'in-progress').length;
    const pending = projects.filter((p) => p.status === 'pending').length;
    const completed = projects.filter((p) => p.status === 'completed').length;

    return [
      { name: 'Active', value: active, color: '#1E40AF' },
      { name: 'Pending', value: pending, color: '#F59E0B' },
      { name: 'Completed', value: completed, color: '#10B981' },
    ];
  }, [projects]);

  const quoteStatusSeries = useMemo(
    () => [
      { name: 'Accepted', value: quoteConversion.accepted, color: '#10B981' },
      { name: 'Pending', value: quoteConversion.pending, color: '#F59E0B' },
      { name: 'Rejected', value: quoteConversion.rejected, color: '#EF4444' },
    ],
    [quoteConversion.accepted, quoteConversion.pending, quoteConversion.rejected],
  );

  const paymentDelayData = useMemo(() => {
    const now = new Date();
    let paidOnTime = 0;
    let paidLate = 0;
    let unpaidLate = 0;
    let paidDaysSum = 0;
    let paidCount = 0;

    invoices.forEach((invoice) => {
      const dueDate = parseDate(invoice.dueDate);
      const issueDate = parseDate(invoice.issueDate) || parseDate(invoice.createdAt);

      if (invoice.status === 'paid') {
        const paidDate = parseDate(invoice.updatedAt) || parseDate(invoice.createdAt);
        if (dueDate && paidDate && paidDate.getTime() <= dueDate.getTime()) {
          paidOnTime += 1;
        } else {
          paidLate += 1;
        }

        if (issueDate && paidDate) {
          const diffDays = Math.max(0, Math.round((paidDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
          paidDaysSum += diffDays;
          paidCount += 1;
        }
      } else if ((invoice.status === 'pending' || invoice.status === 'overdue') && dueDate && dueDate.getTime() < now.getTime()) {
        unpaidLate += 1;
      }
    });

    const avgPaymentDays = paidCount > 0 ? Math.round(paidDaysSum / paidCount) : 0;

    return {
      avgPaymentDays,
      bars: [
        { name: 'Paid On Time', value: paidOnTime, color: '#10B981' },
        { name: 'Late / Overdue', value: paidLate + unpaidLate, color: '#EF4444' },
      ],
    };
  }, [invoices]);

  const topMaterials = useMemo(() => {
    const materialCount = new Map<string, number>();

    projects.forEach((project) => {
      (project.materials || []).forEach((material) => {
        const name = (material?.name || '').trim();
        if (!name) return;
        materialCount.set(name, (materialCount.get(name) || 0) + 1);
      });
    });

    return Array.from(materialCount.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [projects]);

  const quickStats = useMemo(() => {
    const activeProjects = projectCompletionData.activeCount;
    const paidInvoices = invoices.filter((i) => i.status === 'paid').length;
    const thisMonth = new Date();

    const monthlyRevenue = invoices
      .filter((i) => {
        const d = parseDate(i.issueDate) || parseDate(i.createdAt);
        return !!d && d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear();
      })
      .reduce((sum, i) => sum + safeNumber(i.amount), 0);

    return [
      {
        label: 'Active Projects',
        value: activeProjects,
        icon: <FolderKanban size={28} />,
        color: '#1E40AF',
        subtitle: `${projects.length} total projects`,
      },
      {
        label: 'Quote Conversion',
        value: `${quoteConversion.rate}%`,
        icon: <FileText size={28} />,
        color: '#F59E0B',
        subtitle: `${quoteConversion.accepted}/${quoteConversion.sent || 0} accepted`,
      },
      {
        label: 'Paid Invoices',
        value: paidInvoices,
        icon: <Receipt size={28} />,
        color: '#10B981',
        subtitle: `${invoices.length} invoices tracked`,
      },
      {
        label: 'Revenue (This Month)',
        value: `${Math.round(monthlyRevenue)} TND`,
        icon: <TrendingUp size={28} />,
        color: '#8B5CF6',
        subtitle: 'Paid + pending invoices',
      },
    ];
  }, [invoices, projects.length, projectCompletionData.activeCount, quoteConversion.accepted, quoteConversion.rate, quoteConversion.sent]);

  const keyMetrics = useMemo(() => {
    const avgInvoiceAmount = invoices.length
      ? Math.round(invoices.reduce((sum, invoice) => sum + safeNumber(invoice.amount), 0) / invoices.length)
      : 0;
    const overdueInvoices = invoices.filter((invoice) => invoice.status === 'overdue').length;

    return [
      { label: 'Average Completion', value: `${projectCompletionData.avgCompletion}%`, tone: 'Live' },
      { label: 'Avg Invoice Amount', value: `${avgInvoiceAmount} TND`, tone: 'Live' },
      { label: 'Pending Quotes', value: `${quoteConversion.pending}`, tone: 'Live' },
      { label: 'Overdue Invoices', value: `${overdueInvoices}`, tone: 'Monitor' },
      { label: 'Tracked Materials', value: `${topMaterials.length}`, tone: 'Live' },
    ];
  }, [invoices, projectCompletionData.avgCompletion, quoteConversion.pending, topMaterials.length]);

  const recentProjects = useMemo(() => projects.slice(0, 5), [projects]);

  const hasRevenueData = useMemo(() => revenueSeries.some((item) => item.total > 0), [revenueSeries]);
  const hasActivityData = useMemo(
    () => activitySeries.some((item) => item.projects + item.quotes + item.invoices > 0),
    [activitySeries],
  );
  const hasPaymentData = useMemo(
    () => paymentDelayData.bars.some((item) => item.value > 0),
    [paymentDelayData.bars],
  );
  const hasProjectStatusData = useMemo(
    () => projectStatusSeries.some((item) => item.value > 0),
    [projectStatusSeries],
  );

  const recentActivities = useMemo(() => {
    const items: ActivityItem[] = [];

    projects.forEach((project) => {
      const created = parseDate(project.createdAt);
      if (created) {
        items.push({
          date: created,
          text: `Project "${project.title || 'Untitled'}" created`,
          icon: <FolderKanban size={18} />,
          color: '#1E40AF',
        });
      }

      if (safeNumber(project.progress) > 0) {
        const updated = parseDate(project.updatedAt);
        if (updated) {
          items.push({
            date: updated,
            text: `Project "${project.title || 'Untitled'}" reached ${safeNumber(project.progress)}%`,
            icon: <TrendingUp size={18} />,
            color: '#10B981',
          });
        }
      }
    });

    quotes.forEach((quote) => {
      const created = parseDate(quote.createdAt);
      if (created) {
        items.push({
          date: created,
          text: `Quote ${quote.quoteNumber || quote._id.slice(-6)} generated`,
          icon: <FileText size={18} />,
          color: '#F59E0B',
        });
      }
      if (quote.status === 'approved') {
        const updated = parseDate(quote.updatedAt);
        if (updated) {
          items.push({
            date: updated,
            text: `Quote ${quote.quoteNumber || quote._id.slice(-6)} approved`,
            icon: <CheckCircle size={18} />,
            color: '#10B981',
          });
        }
      }
      if (quote.status === 'rejected') {
        const updated = parseDate(quote.updatedAt);
        if (updated) {
          items.push({
            date: updated,
            text: `Quote ${quote.quoteNumber || quote._id.slice(-6)} rejected`,
            icon: <XCircle size={18} />,
            color: '#EF4444',
          });
        }
      }
    });

    invoices.forEach((invoice) => {
      const created = parseDate(invoice.createdAt) || parseDate(invoice.issueDate);
      if (created) {
        items.push({
          date: created,
          text: `Invoice ${invoice.invoiceNumber || invoice._id.slice(-6)} generated for ${invoice.clientName || 'client'}`,
          icon: <Receipt size={18} />,
          color: '#8B5CF6',
        });
      }
      if (invoice.status === 'paid') {
        const updated = parseDate(invoice.updatedAt);
        if (updated) {
          items.push({
            date: updated,
            text: `Payment received for invoice ${invoice.invoiceNumber || invoice._id.slice(-6)}`,
            icon: <CheckCircle size={18} />,
            color: '#10B981',
          });
        }
      }
    });

    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
  }, [invoices, projects, quotes]);

  const formatBudget = (budget: number) =>
    new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      maximumFractionDigits: 0,
    }).format(safeNumber(budget));

  const getStatusColor = (status: string) => {
    if (status === 'active' || status === 'in-progress') return 'bg-emerald-100 text-emerald-700';
    if (status === 'pending') return 'bg-amber-100 text-amber-700';
    if (status === 'completed') return 'bg-blue-100 text-blue-700';
    return 'bg-muted text-foreground';
  };

  const getPriorityColor = (priority?: string) => {
    if (priority === 'high') return 'bg-red-100 text-red-700';
    if (priority === 'medium') return 'bg-yellow-100 text-yellow-700';
    if (priority === 'low') return 'bg-green-100 text-green-700';
    return 'bg-muted text-foreground';
  };

  const plans = [
    { id: 'monthly', price: 150 },
    { id: '3months', price: 390 },
    { id: 'yearly', price: 1350 },
  ];

  const currentPlan = userData?.subscription?.status === 'active'
    ? {
        type: userData.subscription.planId.charAt(0).toUpperCase() + userData.subscription.planId.slice(1),
        status: 'Active',
        startDate: new Date(userData.subscription.startDate).toLocaleDateString(),
        endDate: new Date(userData.subscription.endDate).toLocaleDateString(),
        amount: plans.find((p) => p.id === userData.subscription.planId)?.price || 0,
      }
    : {
        type: 'Free',
        status: 'Inactive',
        startDate: '-',
        endDate: '-',
        amount: 0,
      };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading your dashboard...</div>;

  return (
    <div className="space-y-8">
      {error && (
        <Card className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-xl">
          {error}
        </Card>
      )}

      <ProfileCompletionBanner user={userData} onNavigate={onNavigate} profileView="profile" />

      <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-bold text-foreground">My Subscription</h2>
              <Badge className={`${currentPlan.status === 'Active' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-muted text-muted-foreground border-border'} border-2 px-4 py-1 text-xs font-bold`}>
                {currentPlan.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-6">
              Plan: <strong className="text-foreground">{currentPlan.type}</strong>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Start Date</p>
                  <p className="font-bold text-sm text-foreground">{currentPlan.startDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Calendar size={20} className="text-secondary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Renewal Date</p>
                  <p className="font-bold text-sm text-foreground">{currentPlan.endDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <CreditCard size={20} className="text-accent" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Price</p>
                  <p className="font-bold text-sm text-foreground">{currentPlan.amount} TND</p>
                </div>
              </div>
            </div>
          </div>
          <Button
            onClick={() => onNavigate('subscription')}
            className="h-12 px-8 bg-primary !text-white dark:!bg-secondary dark:!text-white hover:bg-primary/90 dark:hover:!bg-secondary/90 rounded-xl shadow-lg font-bold transition-all border-0"
          >
            Manage Billing
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {quickStats.map((stat, idx) => (
          <StatsCard key={idx} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">Activity Timeline (6 Months)</h2>
            <p className="text-sm text-muted-foreground">Projects, quotes, and invoices created over time.</p>
          </div>
          <div>
            {hasActivityData ? (
              <ResponsiveContainer width="100%" height={300} minWidth={280}>
                <LineChart data={activitySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number | string) => [safeNumber(value), 'Count']} />
                  <Line type="monotone" dataKey="projects" stroke="#1E40AF" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="quotes" stroke="#F59E0B" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="invoices" stroke="#10B981" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px]">
                <ChartEmptyState message="No activity trend yet. Start creating projects and quotes to unlock this chart." />
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">Revenue Overview (6 Months)</h2>
            <p className="text-sm text-muted-foreground">Paid and pending invoice amounts by month.</p>
          </div>
          <div>
            {hasRevenueData ? (
              <ResponsiveContainer width="100%" height={300} minWidth={280}>
                <LineChart data={revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => [`${safeNumber(value).toFixed(0)} TND`, 'Amount']} />
                  <Line type="monotone" dataKey="paid" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="pending" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="total" stroke="#1E40AF" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px]">
                <ChartEmptyState message="Revenue insights will appear as soon as invoices are generated." />
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">Project Pipeline</h2>
            <p className="text-sm text-muted-foreground">Distribution by project status and execution progress.</p>
          </div>
          <div>
            {hasProjectStatusData ? (
              <ResponsiveContainer width="100%" height={240} minWidth={240}>
                <BarChart data={projectStatusSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number | string) => [safeNumber(value), 'Projects']} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {projectStatusSeries.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px]">
                <ChartEmptyState message="No project status data yet." />
              </div>
            )}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Average Completion</span>
              <span className="font-semibold text-foreground">{projectCompletionData.avgCompletion}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500"
                style={{ width: `${projectCompletionData.avgCompletion}%` }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">Quote Conversion</h2>
            <p className="text-sm text-muted-foreground">Accepted, pending, and rejected quote distribution.</p>
          </div>
          <div>
            {quoteConversion.sent > 0 ? (
              <ResponsiveContainer width="100%" height={240} minWidth={240}>
                <PieChart>
                  <Pie
                    data={quoteStatusSeries}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {quoteStatusSeries.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number | string) => [safeNumber(value), 'Quotes']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px]">
                <ChartEmptyState message="Create your first quote to visualize conversion performance." />
              </div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {quoteStatusSeries.map((status) => (
              <div key={status.name} className="rounded-lg bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">{status.name}</p>
                <p className="text-sm font-bold" style={{ color: status.color }}>{status.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 h-2.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500"
              style={{ width: `${quoteConversion.rate}%` }}
            />
          </div>
        </Card>

        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">Payment Health</h2>
            <p className="text-sm text-muted-foreground">Current behavior from available payment records.</p>
          </div>
          <div>
            {hasPaymentData ? (
              <ResponsiveContainer width="100%" height={240} minWidth={240}>
                <BarChart data={paymentDelayData.bars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number | string) => [safeNumber(value), 'Invoices']} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {paymentDelayData.bars.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px]">
                <ChartEmptyState message="Payment delay analytics will become richer once payment flow is implemented." />
              </div>
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Average payment time: <span className="font-semibold text-foreground">{paymentDelayData.avgPaymentDays} days</span>
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg xl:col-span-2">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">Top Purchased Materials</h2>
            <p className="text-sm text-muted-foreground">Most used materials across your active projects.</p>
          </div>
          {topMaterials.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground">
              No material usage data yet. Add materials to projects to unlock insights.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
              <div className="h-64">
                <ResponsiveContainer width="100%" height={260} minWidth={260}>
                  <PieChart>
                    <Pie
                      data={topMaterials}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      innerRadius={50}
                      paddingAngle={3}
                    >
                      {topMaterials.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number | string) => [safeNumber(value), 'Uses']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {topMaterials.map((material, index) => (
                  <div key={material.name} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-foreground">{material.name}</span>
                    </div>
                    <span className="text-sm font-bold text-muted-foreground">{material.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <h2 className="text-xl font-bold text-foreground mb-4">Key Metrics</h2>
          <div className="space-y-3">
            {keyMetrics.map((metric) => (
              <div key={metric.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="text-lg font-semibold text-foreground">{metric.value}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    metric.tone === 'Monitor' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {metric.tone}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Recent Projects</h2>
            <p className="text-muted-foreground mt-1">Your active construction projects</p>
          </div>
          <Button
            variant="outline"
            onClick={() => onNavigate('projects')}
            className="rounded-xl border-2 hover:border-primary hover:text-primary"
          >
            View All Projects
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>

        {recentProjects.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No projects yet. Create your first project.</div>
        ) : (
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <div
                key={project._id}
                className="p-6 rounded-2xl border-2 border-border hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold text-foreground">{project.title || 'Untitled project'}</h3>
                      <Badge className={`${getStatusColor(project.status || '')} px-3 py-1 text-xs font-semibold`}>
                        {project.status || 'unknown'}
                      </Badge>
                      {project.priority && (
                        <Badge className={`${getPriorityColor(project.priority)} px-3 py-1 text-xs font-semibold`}>
                          {project.priority}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mb-4 flex flex-wrap items-center gap-2 text-sm">
                      <span>📍 {(project.location || 'Unknown').slice(0, 28)}</span>
                      <span className="text-gray-300">•</span>
                      <span>Budget: <strong className="text-foreground">{formatBudget(safeNumber(project.budget))}</strong></span>
                      <span className="text-gray-300">•</span>
                      <span>Due: <strong className="text-foreground">{parseDate(project.endDate)?.toLocaleDateString('en-GB') || 'N/A'}</strong></span>
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-muted-foreground">Progress</span>
                        <span className="text-lg font-bold text-primary">{safeNumber(project.progress)}%</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden bg-gray-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                          style={{ width: `${safeNumber(project.progress)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Recent Activity</h2>
        <div className="space-y-5">
          {recentActivities.length === 0 ? (
            <p className="text-muted-foreground">No recent activity detected.</p>
          ) : (
            recentActivities.map((activity, index) => (
              <div key={`${activity.text}-${index}`} className="flex items-start gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${activity.color}18` }}
                >
                  <div style={{ color: activity.color }}>{activity.icon}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium leading-relaxed">{activity.text}</p>
                  <p className="text-sm text-muted-foreground mt-1">{getTimeAgo(activity.date)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
