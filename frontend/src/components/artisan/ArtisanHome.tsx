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
import { useLanguage } from '../../context/LanguageContext';

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

const getTimeAgo = (date: Date, language: string) => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const isFr = language === 'fr';
  const years = Math.floor(seconds / 31536000);
  if (years > 0) return isFr ? `Il y a ${years} an${years > 1 ? 's' : ''}` : `${years} year${years > 1 ? 's' : ''} ago`;
  const months = Math.floor(seconds / 2592000);
  if (months > 0) return isFr ? `Il y a ${months} mois` : `${months} month${months > 1 ? 's' : ''} ago`;
  const days = Math.floor(seconds / 86400);
  if (days > 0) return isFr ? `Il y a ${days} jour${days > 1 ? 's' : ''}` : `${days} day${days > 1 ? 's' : ''} ago`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return isFr ? `Il y a ${hours} heure${hours > 1 ? 's' : ''}` : `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return isFr ? `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}` : `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return isFr ? 'À l’instant' : 'Just now';
};

const monthLabel = (date: Date, language: string) =>
  date.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl bg-muted/50 px-6 text-center">
      {message}
    </div>
  );
}

export default function ArtisanHome({ onNavigate }: ArtisanHomeProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
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
        setError(tr('Session expired. Please login again.', 'Session expirée. Veuillez vous reconnecter.', 'Session expired. Please login again.'));
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
      setError(tr('Unable to load dashboard data.', 'Impossible de charger les données du tableau de bord.', 'Unable to load dashboard data.'));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [API_URL, language]);

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
        month: monthLabel(d, language),
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
  }, [invoices, language]);

  const activitySeries = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: monthLabel(d, language),
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
  }, [invoices, language, projects, quotes]);

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
         { name: tr('Active', 'Actif', 'نشط'), value: activeCount, color: '#1E40AF' },
         { name: tr('Completed', 'Terminé', 'مكتمل'), value: completedThisMonth, color: '#10B981' },
      ],
    };
  }, [projects, language]);

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
      { name: tr('Active', 'Actif', 'نشط'), value: active, color: '#1E40AF' },
      { name: tr('Pending', 'En attente', 'قيد الانتظار'), value: pending, color: '#F59E0B' },
      { name: tr('Completed', 'Terminé', 'مكتمل'), value: completed, color: '#10B981' },
    ];
  }, [projects, language]);

  const quoteStatusSeries = useMemo(
    () => [
      { name: tr('Accepted', 'Accepté', 'مقبول'), value: quoteConversion.accepted, color: '#10B981' },
      { name: tr('Pending', 'En attente', 'قيد الانتظار'), value: quoteConversion.pending, color: '#F59E0B' },
      { name: tr('Rejected', 'Rejeté', 'مرفوض'), value: quoteConversion.rejected, color: '#EF4444' },
    ],
    [quoteConversion.accepted, quoteConversion.pending, quoteConversion.rejected, language],
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
        { name: tr('Paid On Time', 'Payée à temps', 'تم الدفع في الوقت المحدد'), value: paidOnTime, color: '#10B981' },
        { name: tr('Late / Overdue', 'En retard / Échue', 'متأخر/منتهي الصلاحية'), value: paidLate + unpaidLate, color: '#EF4444' },
      ],
    };
  }, [invoices, language]);

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
        label: tr('Active Projects', 'Projets actifs', 'المشاريع النشطة'),
        value: activeProjects,
        icon: <FolderKanban size={28} />,
        color: '#1E40AF',
        subtitle: `${projects.length} ${tr('total projects', 'projets au total', 'إجمالي المشاريع')}`,
      },
      {
        label: tr('Quote Conversion', 'Conversion des devis', 'تحويل العروض'),
        value: `${quoteConversion.rate}%`,
        icon: <FileText size={28} />,
        color: '#F59E0B',
        subtitle: `${quoteConversion.accepted}/${quoteConversion.sent || 0} ${tr('accepted', 'acceptés', 'مقبول')}`,
      },
      {
        label: tr('Paid Invoices', 'Factures payées', 'الفواتير المدفوعة'),
        value: paidInvoices,
        icon: <Receipt size={28} />,
        color: '#10B981',
        subtitle: `${invoices.length} ${tr('invoices tracked', 'factures suivies', 'الفواتير المتتبعة')}`,
      },
      {
        label: tr('Revenue (This Month)', 'Revenus (ce mois)', 'الإيرادات (هذا الشهر)'),
        value: `${Math.round(monthlyRevenue)} TND`,
        icon: <TrendingUp size={28} />,
        color: '#8B5CF6',
        subtitle: tr('Paid + pending invoices', 'Factures payées + en attente', 'الفواتير المدفوعة + المعلقة'),
      },
    ];
  }, [invoices, projects.length, projectCompletionData.activeCount, quoteConversion.accepted, quoteConversion.rate, quoteConversion.sent, language]);

  const keyMetrics = useMemo(() => {
    const avgInvoiceAmount = invoices.length
      ? Math.round(invoices.reduce((sum, invoice) => sum + safeNumber(invoice.amount), 0) / invoices.length)
      : 0;
    const overdueInvoices = invoices.filter((invoice) => invoice.status === 'overdue').length;

    return [
      { label: tr('Average Completion', 'Progression moyenne', 'متوسط الإنجاز'), value: `${projectCompletionData.avgCompletion}%`, tone: 'live' as const },
      { label: tr('Avg Invoice Amount', 'Montant moyen facture', 'متوسط مبلغ الفاتورة'), value: `${avgInvoiceAmount} TND`, tone: 'live' as const },
      { label: tr('Pending Quotes', 'Devis en attente', 'العروض المعلقة'), value: `${quoteConversion.pending}`, tone: 'live' as const },
      { label: tr('Overdue Invoices', 'Factures en retard', 'الفواتير المتأخرة'), value: `${overdueInvoices}`, tone: 'monitor' as const },
      { label: tr('Tracked Materials', 'Matériaux suivis', 'المواد المتتبعة'), value: `${topMaterials.length}`, tone: 'live' as const },
    ];
  }, [invoices, projectCompletionData.avgCompletion, quoteConversion.pending, topMaterials.length, language]);

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
            text: `${tr('Project', 'Projet', 'مشروع')} "${project.title || tr('Untitled', 'Sans titre', 'بدون عنوان')}" ${tr('created', 'créé', 'تم إنشاء')}`,
          icon: <FolderKanban size={18} />,
          color: '#1E40AF',
        });
      }

      if (safeNumber(project.progress) > 0) {
        const updated = parseDate(project.updatedAt);
        if (updated) {
          items.push({
            date: updated,
            text: `${tr('Project', 'Projet', 'مشروع')} "${project.title || tr('Untitled', 'Sans titre', 'بدون عنوان')}" ${tr('reached', 'a atteint', 'وصل إلى')} ${safeNumber(project.progress)}%`,
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
          text: `${tr('Quote', 'Devis', 'عرض سعر')} ${quote.quoteNumber || quote._id.slice(-6)} ${tr('generated', 'généré', 'تم إنشاء')}`,
          icon: <FileText size={18} />,
          color: '#F59E0B',
        });
      }
      if (quote.status === 'approved') {
        const updated = parseDate(quote.updatedAt);
        if (updated) {
          items.push({
            date: updated,
            text: `${tr('Quote', 'Devis', 'عرض سعر')} ${quote.quoteNumber || quote._id.slice(-6)} ${tr('approved', 'approuvé', 'وافق عليه')}`,
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
            text: `${tr('Quote', 'Devis', 'عرض سعر')} ${quote.quoteNumber || quote._id.slice(-6)} ${tr('rejected', 'rejeté', 'مرفوض')}`,
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
          text: `${tr('Invoice', 'Facture', 'فاتورة')} ${invoice.invoiceNumber || invoice._id.slice(-6)} ${tr('generated for', 'générée pour', 'تم إنشاء لـ')} ${invoice.clientName || tr('client', 'client', 'عميل')}`,
          icon: <Receipt size={18} />,
          color: '#8B5CF6',
        });
      }
      if (invoice.status === 'paid') {
        const updated = parseDate(invoice.updatedAt);
        if (updated) {
          items.push({
            date: updated,
            text: `${tr('Payment received for invoice', 'Paiement reçu pour la facture', 'تم استلام الدفع للفاتورة')} ${invoice.invoiceNumber || invoice._id.slice(-6)}`,
            icon: <CheckCircle size={18} />,
            color: '#10B981',
          });
        }
      }
    });

    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
  }, [invoices, projects, quotes, language]);

  const formatBudget = (budget: number) =>
    new Intl.NumberFormat(language === 'fr' ? 'fr-TN' : 'en-US', {
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

  const getStatusLabel = (status?: string) => {
    if (status === 'active') return tr('Active', 'Actif', 'نشط');
    if (status === 'in-progress') return tr('In progress', 'En cours', 'جاري');
    if (status === 'pending') return tr('Pending', 'En attente', 'قيد الانتظار');
    if (status === 'completed') return tr('Completed', 'Terminé', 'مكتمل');
    return status || tr('unknown', 'inconnu', 'غير معروف');
  };

  const getPriorityColor = (priority?: string) => {
    if (priority === 'high') return 'bg-red-100 text-red-700';
    if (priority === 'medium') return 'bg-yellow-100 text-yellow-700';
    if (priority === 'low') return 'bg-green-100 text-green-700';
    return 'bg-muted text-foreground';
  };

  const getPriorityLabel = (priority?: string) => {
    if (priority === 'high') return tr('High', 'Haute', 'عالية');
    if (priority === 'medium') return tr('Medium', 'Moyenne', 'متوسطة');
    if (priority === 'low') return tr('Low', 'Faible', 'منخفضة');
    return priority || '';
  };

  const plans = [
    { id: 'monthly', price: 150 },
    { id: '3months', price: 390 },
    { id: 'yearly', price: 1350 },
  ];

  const currentPlan = userData?.subscription?.status === 'active'
    ? {
        type: userData.subscription.planId.charAt(0).toUpperCase() + userData.subscription.planId.slice(1),
        status: tr('Active', 'Actif', 'Active'),
        startDate: new Date(userData.subscription.startDate).toLocaleDateString(),
        endDate: new Date(userData.subscription.endDate).toLocaleDateString(),
        amount: plans.find((p) => p.id === userData.subscription.planId)?.price || 0,
      }
    : {
        type: tr('Free', 'Gratuit', 'مجاني'),
        status: tr('Inactive', 'Inactif', 'غير نشط'),
        startDate: '-',
        endDate: '-',
        amount: 0,
      };

  if (loading) return <div className="p-10 text-center text-muted-foreground">{tr('Loading your dashboard...', 'Chargement de votre tableau de bord...', 'تحميل لوحة التحكم الخاصة بك...')}</div>;

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
              <h2 className="text-2xl font-bold text-foreground">{tr('My Subscription', 'Mon abonnement', 'اشتراكي')}</h2>
              <Badge className={`${userData?.subscription?.status === 'active' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-muted text-muted-foreground border-border'} border-2 px-4 py-1 text-xs font-bold`}>
                {currentPlan.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-6">
              {tr('Plan', 'Plan', 'الخطة')} : <strong className="text-foreground">{currentPlan.type}</strong>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{tr('Start Date', 'Date de début', 'تاريخ البداية')}</p>
                  <p className="font-bold text-sm text-foreground">{currentPlan.startDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Calendar size={20} className="text-secondary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{tr('Renewal Date', 'Date de renouvellement', 'تاريخ التجديد')}</p>
                  <p className="font-bold text-sm text-foreground">{currentPlan.endDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <CreditCard size={20} className="text-accent" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">{tr('Price', 'Prix', 'السعر')}</p>
                  <p className="font-bold text-sm text-foreground">{currentPlan.amount} TND</p>
                </div>
              </div>
            </div>
          </div>
          <Button
            onClick={() => onNavigate('subscription')}
            className="h-12 px-8 bg-primary !text-white dark:!bg-secondary dark:!text-white hover:bg-primary/90 dark:hover:!bg-secondary/90 rounded-xl shadow-lg font-bold transition-all border-0"
          >
            {tr('Manage Billing', 'Gérer la facturation', 'إدارة الفواتير')}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {quickStats.map((stat, idx) => (
          <StatsCard key={idx} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">{tr('Activity Timeline (6 Months)', "Chronologie d'activité (6 mois)", 'الخط الزمني للنشاط (6 أشهر)')}</h2>
            <p className="text-sm text-muted-foreground">{tr('Projects, quotes, and invoices created over time.', 'Projets, devis et factures créés au fil du temps.', 'المشاريع والعروض والفواتير التي تم إنشاؤها بمرور الوقت.')}</p>
          </div>
          <div>
            {hasActivityData ? (
              <ResponsiveContainer width="100%" height={300} minWidth={280}>
                <LineChart data={activitySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number | string) => [safeNumber(value), tr('Count', 'Nombre', 'Count')]} />
                  <Line type="monotone" dataKey="projects" stroke="#1E40AF" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="quotes" stroke="#F59E0B" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="invoices" stroke="#10B981" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px]">
                  <ChartEmptyState message={tr('No activity trend yet. Start creating projects and quotes to unlock this chart.', "Pas encore de tendance d'activité. Commencez à créer des projets et des devis pour débloquer ce graphique.", 'لا توجد اتجاهات نشاط حتى الآن. ابدأ بإنشاء المشاريع والعروض لفتح هذا الرسم البياني.')} />
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">{tr('Revenue Overview (6 Months)', 'Aperçu des revenus (6 mois)', 'نظرة عامة على الإيرادات (6 أشهر)')}</h2>
            <p className="text-sm text-muted-foreground">{tr('Paid and pending invoice amounts by month.', 'Montants des factures payées et en attente par mois.', 'مبالغ الفواتير المدفوعة والمعلقة حسب الشهر.')}</p>
          </div>
          <div>
            {hasRevenueData ? (
              <ResponsiveContainer width="100%" height={300} minWidth={280}>
                <LineChart data={revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number | string) => [`${safeNumber(value).toFixed(0)} TND`, tr('Amount', 'Montant', 'المبلغ')]} />
                  <Line type="monotone" dataKey="paid" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="pending" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="total" stroke="#1E40AF" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px]">
                  <ChartEmptyState message={tr('Revenue insights will appear as soon as invoices are generated.', 'Les analyses de revenus apparaîtront dès que des factures seront générées.', 'ستظهر رؤى الإيرادات بمجرد إنشاء الفواتير.')} />
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">{tr('Project Pipeline', 'Pipeline des projets', 'خط أنابيب المشروع')}</h2>
            <p className="text-sm text-muted-foreground">{tr('Distribution by project status and execution progress.', "Répartition par statut du projet et progression d'exécution.", 'التوزيع حسب حالة المشروع وتقدم التنفيذ.')}</p>
          </div>
          <div>
            {hasProjectStatusData ? (
              <ResponsiveContainer width="100%" height={240} minWidth={240}>
                <BarChart data={projectStatusSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number | string) => [safeNumber(value), tr('Projects', 'Projets', 'المشاريع')]} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {projectStatusSeries.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px]">
                <ChartEmptyState message={tr('No project status data yet.', 'Aucune donnée de statut de projet pour le moment.', 'لا توجد بيانات حالة مشروع حتى الآن.')} />
              </div>
            )}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
               <span className="text-muted-foreground">{tr('Average Completion', 'Progression moyenne', 'متوسط الإنجاز')}</span>
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
            <h2 className="text-xl font-bold text-foreground">{tr('Quote Conversion', 'Conversion des devis', 'تحويل العروض')}</h2>
            <p className="text-sm text-muted-foreground">{tr('Accepted, pending, and rejected quote distribution.', 'Répartition des devis acceptés, en attente et rejetés.', 'توزيع العروض المقبولة والمعلقة والمرفوضة.')}</p>
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
                  <Tooltip formatter={(value: number | string) => [safeNumber(value), tr('Quotes', 'Devis', 'العروض')]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px]">
                  <ChartEmptyState message={tr('Create your first quote to visualize conversion performance.', 'Créez votre premier devis pour visualiser la performance de conversion.', 'أنشئ عرضك الأول لتصور أداء التحويل.')} />
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">{tr('Payment Health', 'Santé des paiements', 'صحة الدفع')}</h2>
            <p className="text-sm text-muted-foreground">{tr('Current behavior from available payment records.', 'Comportement actuel basé sur les paiements disponibles.', 'السلوك الحالي بناءً على سجلات الدفع المتاحة.')}</p>
          </div>
          <div>
            {hasPaymentData ? (
              <ResponsiveContainer width="100%" height={240} minWidth={240}>
                <BarChart data={paymentDelayData.bars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number | string) => [safeNumber(value), tr('Invoices', 'Factures', 'الفواتير')]} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {paymentDelayData.bars.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px]">
                  <ChartEmptyState message={tr('Payment delay analytics will become richer once payment flow is implemented.', 'Les analyses de retard de paiement seront plus riches une fois le flux de paiement en place.', 'ستصبح تحليلات تأخير الدفع أكثر ثراءً بمجرد تطبيق تدفق الدفع.')} />
              </div>
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {tr('Average payment time', 'Délai moyen de paiement', 'متوسط وقت الدفع')} : <span className="font-semibold text-foreground">{paymentDelayData.avgPaymentDays} {tr('days', 'jours', 'أيام')}</span>
          </p>
        </Card>

        <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">{tr('Top Purchased Materials', 'Matériaux les plus achetés', 'المواد الأكثر شراءً')}</h2>
            <p className="text-sm text-muted-foreground">{tr('Most used materials across your active projects.', 'Matériaux les plus utilisés dans vos projets actifs.', 'المواد الأكثر استخداماً في مشاريعك النشطة.')}</p>
          </div>
          {topMaterials.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground">
              {tr('No material usage data yet. Add materials to projects to unlock insights.', 'Aucune donnée d’usage des matériaux pour le moment. Ajoutez des matériaux aux projets pour débloquer des analyses.', 'No material usage data yet. Add materials to projects to unlock insights.')}
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
                    <Tooltip formatter={(value: number | string) => [safeNumber(value), tr('Uses', 'Utilisations', 'الاستخدامات')]} />
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
      </div>

      <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
        <h2 className="text-xl font-bold text-foreground mb-4">{tr('Key Metrics', 'Indicateurs clés', 'المقاييس الرئيسية')}</h2>
        <div className="space-y-3">
          {keyMetrics.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="text-lg font-semibold text-foreground">{metric.value}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  metric.tone === 'monitor' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {metric.tone === 'monitor' ? tr('Monitor', 'À surveiller', 'مراقبة') : tr('Live', 'En direct', 'مباشر')}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{tr('Recent Projects', 'Projets récents', 'المشاريع الأخيرة')}</h2>
            <p className="text-muted-foreground mt-1">{tr('Your active construction projects', 'Vos projets de construction actifs', 'مشاريعك الإنشائية النشطة')}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => onNavigate('projects')}
            className="rounded-xl border-2 hover:border-primary hover:text-primary"
          >
            {tr('View All Projects', 'Voir tous les projets', 'عرض جميع المشاريع')}
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>

        {recentProjects.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">{tr('No projects yet. Create your first project.', 'Aucun projet pour le moment. Créez votre premier projet.', 'لا توجد مشاريع حتى الآن. أنشئ مشروعك الأول.')}</div>
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
                      <h3 className="text-xl font-semibold text-foreground">{project.title || tr('Untitled project', 'Projet sans titre', 'مشروع بدون عنوان')}</h3>
                      <Badge className={`${getStatusColor(project.status || '')} px-3 py-1 text-xs font-semibold`}>
                        {getStatusLabel(project.status)}
                      </Badge>
                      {project.priority && (
                        <Badge className={`${getPriorityColor(project.priority)} px-3 py-1 text-xs font-semibold`}>
                          {getPriorityLabel(project.priority)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mb-4 flex flex-wrap items-center gap-2 text-sm">
                      <span>📍 {(project.location || tr('Unknown', 'Inconnu', 'غير معروف')).slice(0, 28)}</span>
                      <span className="text-gray-300">•</span>
                      <span>{tr('Budget', 'Budget', 'الميزانية')} : <strong className="text-foreground">{formatBudget(safeNumber(project.budget))}</strong></span>
                      <span className="text-gray-300">•</span>
                      <span>{tr('Due', 'Échéance', 'الاستحقاق')} : <strong className="text-foreground">{parseDate(project.endDate)?.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB') || tr('N/A', 'N/D', 'غير متاح')}</strong></span>
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-muted-foreground">{tr('Progress', 'Progression', 'الترقية')}</span>
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
        <h2 className="text-2xl font-bold text-foreground mb-6">{tr('Recent Activity', 'Activité récente', 'النشاط الأخير')}</h2>
        <div className="space-y-5">
          {recentActivities.length === 0 ? (
            <p className="text-muted-foreground">{tr('No recent activity detected.', 'Aucune activité récente détectée.', 'لم يتم الكشف عن أي نشاط حديث.')}</p>
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
                  <p className="text-sm text-muted-foreground mt-1">{getTimeAgo(activity.date, language)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}


