import { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  BarChart3, CalendarRange, CreditCard, Filter, History, RefreshCw, Search,
  ShieldCheck, ShieldEllipsis, ShoppingBag, Trash2, UserCog, Wrench,
  Users, Activity, TrendingUp, Zap, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { toast } from 'sonner';
import actionLogService, { ActionLogItem } from '../../services/actionLogService';
import authService from '../../services/authService';
import { useLanguage } from '../../context/LanguageContext';

const roleStyles: Record<string, { color: string; bg: string; dot: string }> = {
  artisan:      { color: '#d97706', bg: 'rgba(245,158,11,0.15)', dot: '#f59e0b' },
  expert:       { color: '#059669', bg: 'rgba(16,185,129,0.15)', dot: '#10b981' },
  manufacturer: { color: '#7c3aed', bg: 'rgba(139,92,246,0.15)', dot: '#8b5cf6' },
  admin:        { color: '#dc2626', bg: 'rgba(220,38,38,0.15)', dot: '#ef4444' },
  system:       { color: 'var(--muted-foreground)', bg: 'var(--border)', dot: 'var(--muted-foreground)' },
};

type BasicUserRow = { _id: string; role: string; adminType?: string };

const card: React.CSSProperties = { background: 'var(--card)', border: '2px solid var(--border)', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };
const selectBase: React.CSSProperties = { width: '100%', height: 44, padding: '0 12px', borderRadius: 12, border: '2px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 14, outline: 'none', cursor: 'pointer' };

export default function AdminActionLogs() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const { t } = useLanguage();

  const roleConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    artisan:      { label: t('role.artisan'),      ...roleStyles.artisan },
    expert:       { label: t('role.expert'),       ...roleStyles.expert },
    manufacturer: { label: t('role.manufacturer'), ...roleStyles.manufacturer },
    admin:        { label: t('role.admin'),        ...roleStyles.admin },
    system:       { label: t('role.system'),       ...roleStyles.system },
  };

  const actionLabels = [
    { label: t('admin.logs.allActions'),                value: '' },
    { label: t('admin.logs.projectCreated'),            value: 'artisan.project.create' },
    { label: t('admin.logs.quoteGenerated'),            value: 'artisan.quote.create' },
    { label: t('admin.logs.invoiceGenerated'),          value: 'artisan.invoice.create' },
    { label: t('admin.logs.invoiceDeleted'),            value: 'artisan.invoice.delete' },
    { label: t('admin.logs.paymentUpfront'),            value: 'artisan.invoice.payment.upfront' },
    { label: t('admin.logs.paymentCompletion'),         value: 'artisan.invoice.payment.completion' },
    { label: t('admin.logs.productAdded'),              value: 'manufacturer.product.create' },
    { label: t('admin.logs.productUpdated'),            value: 'manufacturer.product.update' },
    { label: t('admin.logs.productDeleted'),            value: 'manufacturer.product.delete' },
    { label: t('admin.logs.marketplacePurchase'),       value: 'marketplace.checkout' },
    { label: t('admin.logs.marketplacePurchaseStripe'), value: 'marketplace.checkout.stripe' },
    { label: t('admin.logs.subAdminCreated'),           value: 'admin.subadmin.create' },
    { label: t('admin.logs.passwordReset'),             value: 'admin.subadmin.password.reset' },
    { label: t('admin.logs.manufacturerApproved'),      value: 'admin.manufacturer.approve' },
    { label: t('admin.logs.manufacturerRejected'),      value: 'admin.manufacturer.reject' },
    { label: t('admin.logs.userSuspended'),             value: 'admin.user.suspend' },
    { label: t('admin.logs.userActivated'),             value: 'admin.user.activate' },
    { label: t('admin.logs.userDeleted'),               value: 'admin.user.delete' },
    { label: t('admin.logs.reportSubmitted'),           value: 'report.submit' },
    { label: t('admin.logs.reportStatusUpdated'),       value: 'admin.report.status.update' },
  ];

  const [logs, setLogs] = useState<ActionLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [accountStats, setAccountStats] = useState({ total: 0, users: 0, subAdmins: 0 });
  const [accountStatsLoading, setAccountStatsLoading] = useState(false);
  const [logSummary, setLogSummary] = useState({
    total: 0, paymentEvents: 0, marketplaceEvents: 0, invoiceInstallmentEvents: 0,
    manufacturerProductEvents: 0, adminSecurityEvents: 0, reportEvents: 0,
    byRole: {} as Record<string, number>,
    topActions: [] as Array<{ actionKey: string; actionLabel: string; count: number }>,
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [actionKey, setActionKey] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadLogs = async (targetPage = page) => {
    setLoading(true);
    try {
      const response = await actionLogService.list({ page: targetPage, limit, search, actorRole, actionKey, from: fromDate || undefined, to: toDate || undefined });
      setLogs(response.logs);
      setTotalPages(response.pagination.pages);
      setTotalItems(response.pagination.total);
      if (response.summary) setLogSummary(response.summary);
      setSelectedIds([]);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || tr('Failed to load logs', 'Échec du chargement des journaux', 'فشل تحميل السجلات'));
    } finally { setLoading(false); }
  };

  useEffect(() => { loadLogs(page); }, [page]);
  useEffect(() => { setPage(1); loadLogs(1); }, [search, actorRole, actionKey, fromDate, toDate]);

  const loadAccountStats = async () => {
    setAccountStatsLoading(true);
    try {
      const users = (await authService.listUsers()) as BasicUserRow[];
      const total = Array.isArray(users) ? users.length : 0;
      const nonAdminUsers = Array.isArray(users) ? users.filter((u) => ['artisan', 'expert', 'manufacturer'].includes(String(u.role).toLowerCase())) : [];
      const subAdmins = Array.isArray(users) ? users.filter((u) => String(u.role).toLowerCase() === 'admin' && String(u.adminType || '').toLowerCase() === 'sub') : [];
      setAccountStats({ total, users: nonAdminUsers.length, subAdmins: subAdmins.length });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || tr('Failed to load account statistics', "Échec du chargement des statistiques du compte", 'فشل تحميل إحصائيات الحساب'));
      setAccountStats({ total: 0, users: 0, subAdmins: 0 });
    } finally { setAccountStatsLoading(false); }
  };

  useEffect(() => { loadAccountStats(); }, []);

  const isAllSelected = logs.length > 0 && selectedIds.length === logs.length;
  const toggleSelectAll = (checked: boolean | 'indeterminate') => setSelectedIds(checked === true ? logs.map((l) => l._id) : []);
  const toggleRowSelection = (id: string, checked: boolean | 'indeterminate') =>
    setSelectedIds((prev) => checked === true ? [...prev, id] : prev.filter((v) => v !== id));

  const deleteOne = async (id: string) => {
    try { await actionLogService.deleteById(id); toast.success(tr('Log deleted', 'Journal supprimé', 'تم حذف السجل')); loadLogs(page); }
    catch (error: any) { toast.error(error?.response?.data?.message || tr('Failed to delete log', 'Échec de la suppression du journal', 'فشل حذف السجل')); }
  };
  const deleteSelected = async () => {
    if (!selectedIds.length) { toast.error(tr('Select at least one log', 'Sélectionnez au moins un journal', 'حدد سجل واحد على الأقل')); return; }
    try { await actionLogService.bulkDelete(selectedIds); toast.success(tr('Selected logs deleted', 'Les journaux sélectionnés ont été supprimés', 'تم حذف السجلات المحددة')); loadLogs(page); }
    catch (error: any) { toast.error(error?.response?.data?.message || tr('Failed to delete selected logs', 'Échec de la suppression des journaux sélectionnés', 'فشل حذف السجلات المحددة')); }
  };

  const formatMoney = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : null; };

  const renderMetadataDetails = (log: ActionLogItem) => {
    const metadata = (log.metadata || {}) as Record<string, unknown>;
    const chips: string[] = [];
    const itemCount = Number(metadata.itemCount || 0);
    if (Number.isFinite(itemCount) && itemCount > 0) chips.push(`${itemCount} item(s)`);
    const amount = formatMoney(metadata.totalAmount ?? metadata.amount);
    if (amount) chips.push(`${amount} ${(metadata.currency || 'USD') as string}`);
    const phase = String(metadata.phase || '').trim(); if (phase) chips.push(`${tr('Phase', 'Phase', 'المرحلة')}: ${phase}`);
    const stripeSessionId = String(metadata.stripeSessionId || metadata.sessionId || '').trim();
    if (stripeSessionId) chips.push(`${tr('Session', 'Séance', 'الجلسة')}: ${stripeSessionId.slice(0, 12)}…`);
    const invoiceNumber = String(metadata.invoiceNumber || '').trim(); if (invoiceNumber) chips.push(`${tr('Invoice', 'Facture', 'الفاتورة')}: ${invoiceNumber}`);
    const quoteNumber = String(metadata.quoteNumber || '').trim(); if (quoteNumber) chips.push(`${tr('Quote', 'Devis', 'الاقتباس')}: ${quoteNumber}`);
    const productName = String(metadata.name || '').trim(); if (productName) chips.push(`${tr('Product', 'Produit', 'المنتج')}: ${productName}`);
    const reportType = String(metadata.reportType || '').trim(); if (reportType) chips.push(`${tr('Report', 'Rapport', 'التقرير')}: ${reportType}`);
    const reportStatus = String(metadata.newStatus || metadata.status || '').trim(); if (reportStatus) chips.push(`${tr('Status', 'Statut', 'الحالة')}: ${reportStatus}`);
    const reportReason = String(metadata.reason || '').trim(); if (reportReason) chips.push(`${tr('Reason', 'Raison', 'السبب')}: ${reportReason.slice(0, 40)}${reportReason.length > 40 ? '...' : ''}`)
    if (!chips.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {chips.map((chip, idx) => (
          <span key={`${log._id}-chip-${idx}`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(37,99,235,0.1)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.3)' }}>{chip}</span>
        ))}
      </div>
    );
  };

  const activeFilterCount = [search, actorRole, actionKey, fromDate, toDate].filter(Boolean).length;

  const statCards = [
    { label: tr('Payments', 'Paiements', 'المدفوعات'),       value: logSummary.paymentEvents,            icon: CreditCard,     accent: '#2563eb' },
    { label: tr('Marketplace', 'Marché', 'السوق'),    value: logSummary.marketplaceEvents,         icon: ShoppingBag,    accent: '#7c3aed' },
    { label: tr('Installments', 'Versements', 'الأقساط'),   value: logSummary.invoiceInstallmentEvents,  icon: BarChart3,      accent: '#d97706' },
    { label: tr('Products', 'Produits', 'المنتجات'),       value: logSummary.manufacturerProductEvents, icon: Wrench,         accent: '#059669' },
    { label: tr('Admin Security', 'Sécurité Admin', 'أمان المسؤول'),  value: logSummary.adminSecurityEvents,       icon: ShieldEllipsis, accent: '#dc2626' },
    { label: tr('Reports', 'Rapports', 'التقارير'),        value: logSummary.reportEvents,              icon: UserCog,        accent: '#0ea5e9' },
  ];

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 60%, #0ea5e9 100%)', borderRadius: 20, padding: '28px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -30, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
              <History size={26} style={{ color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{tr('Action Logs', 'Journaux d\'actions', 'سجلات الإجراءات')}</h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{tr('Complete audit trail of all system actions', 'Trace d\'audit complète de toutes les actions du système', 'سجل تدقيق كامل لجميع إجراءات النظام')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            {[
              { label: tr('Total Accounts', 'Comptes totaux', 'إجمالي الحسابات'), value: accountStats.total,     icon: Users },
              { label: tr('Users', 'Utilisateurs', 'المستخدمون'),         value: accountStats.users,     icon: Activity },
              { label: tr('Sub Admins', 'Sous-administrateurs', 'المسؤولون الفرعيون'),     value: accountStats.subAdmins, icon: ShieldCheck },
            ].map((s) => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 14, padding: '12px 18px', minWidth: 110, backdropFilter: 'blur(8px)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <s.icon size={13} style={{ color: 'rgba(255,255,255,0.7)' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
                </div>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{accountStatsLoading ? '…' : s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <div key={s.label} style={{ ...card, padding: '18px 20px', borderTop: `3px solid ${s.accent}` }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{s.label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${s.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={15} style={{ color: s.accent }} />
              </div>
            </div>
            <p style={{ fontSize: 30, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div style={{ ...card, padding: 20 }}>
        <div className="flex items-center gap-2 mb-4">
          <Filter size={15} style={{ color: '#2563eb' }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{tr('Filters', 'Filtres', 'المرشحات')}</span>
          {activeFilterCount > 0 && (
            <span style={{ fontSize: 11, background: '#2563eb', color: '#fff', borderRadius: 999, padding: '1px 8px', fontWeight: 800 }}>
              {tr(`${activeFilterCount} active`, `${activeFilterCount} actif`, `${activeFilterCount} نشط`)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Search */}
          <div className="lg:col-span-4">
            <div style={{ height: 44, background: 'var(--muted)', border: '2px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px' }}>
              <Search size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput.trim()); }}
                placeholder={tr('Name, action, target…', 'Nom, action, cible…', 'الاسم، الإجراء، الهدف...')}
                style={{ border: 'none', background: 'transparent', color: 'var(--foreground)', outline: 'none', boxShadow: 'none', height: '100%', fontSize: 14 }}
                className="focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
              />
              {searchInput && (
                <button onClick={() => { setSearchInput(''); setSearch(''); }} style={{ color: 'var(--muted-foreground)', cursor: 'pointer', background: 'none', border: 'none' }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Role */}
          <div className="lg:col-span-2">
            <select value={actorRole} onChange={(e) => setActorRole(e.target.value)} style={selectBase}>
              <option value="">{tr('All roles', 'Tous les rôles', 'جميع الأدوار')}</option>
              <option value="artisan">{t('role.artisan')}</option>
              <option value="expert">{t('role.expert')}</option>
              <option value="manufacturer">{t('role.manufacturer')}</option>
              <option value="admin">{t('role.admin')}</option>
            </select>
          </div>

          {/* Action */}
          <div className="lg:col-span-3">
            <select value={actionKey} onChange={(e) => setActionKey(e.target.value)} style={selectBase}>
              {actionLabels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>

          {/* Buttons */}
          <div className="lg:col-span-3 flex gap-2">
            <button
              onClick={() => setSearch(searchInput.trim())}
              style={{ height: 44, padding: '0 18px', borderRadius: 12, background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <Filter size={14} /> {tr('Apply', 'Appliquer', 'تطبيق')}
            </button>
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setActorRole(''); setActionKey(''); setFromDate(''); setToDate(''); }}
              style={{ height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, border: '2px solid var(--border)', cursor: 'pointer' }}
            >
              <RefreshCw size={14} /> {tr('Reset', 'Réinitialiser', 'إعادة تعيين')}
            </button>
          </div>

          {/* Date range */}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3 flex-wrap">
              <CalendarRange size={14} style={{ color: '#2563eb', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600, whiteSpace: 'nowrap' }}>{tr('Period:', 'Période :', 'الفترة:')}</span>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{tr('From', 'De', 'من')}</span>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                style={{ height: 40, background: 'var(--muted)', border: '2px solid var(--border)', borderRadius: 10, color: 'var(--foreground)', fontSize: 13 }}
                className="focus-visible:ring-0" />
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{tr('To', 'À', 'إلى')}</span>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                style={{ height: 40, background: 'var(--muted)', border: '2px solid var(--border)', borderRadius: 10, color: 'var(--foreground)', fontSize: 13 }}
                className="focus-visible:ring-0" />
            </div>
          </div>

          {/* Bulk actions */}
          <div className="lg:col-span-5 flex items-center justify-end gap-2">
            <button
              disabled={!selectedIds.length}
              onClick={deleteSelected}
              style={{ height: 40, padding: '0 16px', borderRadius: 10, background: selectedIds.length ? 'rgba(220,38,38,0.1)' : 'var(--muted)', color: selectedIds.length ? '#dc2626' : 'var(--muted-foreground)', border: `2px solid ${selectedIds.length ? 'rgba(220,38,38,0.3)' : 'var(--border)'}`, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: selectedIds.length ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
            >
              <Trash2 size={14} /> {tr(`Delete (${selectedIds.length})`, `Supprimer (${selectedIds.length})`, `حذف (${selectedIds.length})`)}
            </button>
            <button
              onClick={() => { loadAccountStats(); loadLogs(page); }}
              style={{ height: 40, padding: '0 16px', borderRadius: 10, background: 'rgba(37,99,235,0.1)', color: '#2563eb', border: '2px solid rgba(37,99,235,0.3)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <RefreshCw size={14} /> {tr('Refresh', 'Rafraîchir', 'تحديث')}
            </button>
          </div>
        </div>
      </div>

      {/* ── TOP ACTIONS + BREAKDOWN ── */}
      {(logSummary.topActions.length > 0 || Object.keys(logSummary.byRole).length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div style={{ ...card, padding: 20 }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={14} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{tr('Top actions', 'Actions principales', 'الإجراءات الرئيسية')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {logSummary.topActions.length ? logSummary.topActions.map((item) => (
                <button key={item.actionKey} onClick={() => setActionKey(item.actionKey)}
                  style={{ padding: '7px 13px', borderRadius: 9, background: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 600 }}>{item.actionLabel}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{item.count} {item.count > 1 ? tr('occurrences', 'occurrences', 'حدوثات') : tr('occurrence', 'occurrence', 'حدوث')}</div>
                </button>
              )) : <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{tr('No actions for the current filter.', 'Aucune action pour le filtre actuel.', 'لا توجد إجراءات للمرشح الحالي.')}</p>}
            </div>
          </div>

          <div style={{ ...card, padding: 20 }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap size={14} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{tr('Breakdown by role', 'Répartition par rôle', 'توزيع حسب الدور')}</span>
            </div>
            <div className="space-y-3">
              {(['artisan', 'expert', 'manufacturer', 'admin'] as const).map((role) => {
                const count = logSummary.byRole[role] || 0;
                const cfg = roleConfig[role];
                const max = Math.max(...['artisan','expert','manufacturer','admin'].map(r => logSummary.byRole[r] || 0), 1);
                return (
                  <div key={role} className="flex items-center gap-3">
                    <span style={{ fontSize: 12, color: cfg.color, fontWeight: 700, minWidth: 80 }}>{cfg.label}</span>
                    <div style={{ flex: 1, height: 7, background: 'var(--border)', borderRadius: 99 }}>
                      <div style={{ height: '100%', borderRadius: 99, background: cfg.dot, width: `${(count / max) * 100}%`, transition: 'width 0.5s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: 20, textAlign: 'right', fontWeight: 600 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TABLE ── */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {/* Table header bar */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(90deg, var(--muted), rgba(37,99,235,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-2">
            <History size={17} style={{ color: '#2563eb' }} />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{tr('Action History', 'Historique des actions', 'سجل الإجراءات')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 500 }}>{totalItems} {totalItems > 1 ? tr('logs', 'journaux', 'السجلات') : tr('log', 'journal', 'السجل')} {tr('total', 'total', 'إجمالي')}</span>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              <TableHead style={{ width: 40 }}>
                <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} />
              </TableHead>
              {[
                { label: 'Actor', tr: tr('Actor', 'Acteur', 'الفاعل') },
                { label: 'Role', tr: tr('Role', 'Rôle', 'الدور') },
                { label: 'Action', tr: tr('Action', 'Action', 'الإجراء') },
                { label: 'Target', tr: tr('Target', 'Cible', 'الهدف') },
                { label: 'Date', tr: tr('Date', 'Date', 'التاريخ') },
                { label: 'Details', tr: tr('Details', 'Détails', 'التفاصيل') },
                { label: '', tr: '' }
              ].map((h) => (
                <TableHead key={h.label} style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h.tr}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} style={{ height: 120, textAlign: 'center', background: 'var(--card)' }}>
                  <div className="flex items-center justify-center gap-3">
                    <div style={{ width: 20, height: 20, border: '2px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>{tr('Loading logs…', 'Chargement des journaux…', 'جاري تحميل السجلات...')}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} style={{ height: 140, textAlign: 'center', background: 'var(--card)' }}>
                  <History size={36} style={{ color: 'var(--border)', margin: '0 auto 10px' }} />
                  <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>{tr('No logs found with these filters.', 'Aucun journal trouvé avec ces filtres.', 'لم يتم العثور على سجلات بهذه المرشحات.')}</p>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log, idx) => {
                const isSelected = selectedIds.includes(log._id);
                const roleCfg = roleConfig[log.actorRole] || roleConfig.system;
                return (
                  <TableRow key={log._id} style={{ background: isSelected ? 'rgba(59,130,246,0.12)' : idx % 2 === 0 ? 'var(--card)' : 'var(--muted)', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                    <TableCell>
                      <Checkbox checked={isSelected} onCheckedChange={(c: boolean | 'indeterminate') => toggleRowSelection(log._id, c)} />
                    </TableCell>
                    <TableCell>
                      <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: 14 }}>{log.actorName || '—'}</div>
                      {log.actorAdminType && (
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <UserCog size={11} /> {log.actorAdminType === 'sub' ? tr('sub-admin', 'Sous-administrateur', 'مسؤول فرعي') : tr('super admin', 'Super Administrateur', 'المسؤول الأعلى')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: roleCfg.bg, color: roleCfg.color, border: `1px solid ${roleCfg.dot}40`, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: roleCfg.dot, display: 'inline-block' }} />
                        {roleCfg.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div style={{ fontWeight: 600, color: 'var(--foreground)', fontSize: 13 }}>{log.actionLabel}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, fontFamily: 'monospace' }}>{log.actionKey}</div>
                    </TableCell>
                    <TableCell>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{log.targetName || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{log.targetRole || log.entityType}</div>
                    </TableCell>
                    <TableCell>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                        {new Date(log.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top" style={{ maxWidth: 320, width: 320, paddingRight: 24 }}>
                      <p style={{ fontSize: 13, color: '#111827', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{log.description || tr('No additional details', 'Aucun détail supplémentaire', 'لا توجد تفاصيل إضافية')}</p>
                      {renderMetadataDetails(log)}
                    </TableCell>
                    <TableCell style={{ textAlign: 'right', width: 72, minWidth: 72, maxWidth: 72, paddingLeft: 16, paddingRight: 12 }}>
                      <button
                        onClick={() => deleteOne(log._id)}
                        style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.1)')}
                      >
                        <Trash2 size={13} style={{ color: '#dc2626' }} />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            {tr('Page', 'Page', 'الصفحة')} <strong style={{ color: 'var(--foreground)' }}>{page}</strong> / <strong style={{ color: 'var(--foreground)' }}>{totalPages}</strong>
            <span style={{ marginLeft: 8, color: 'var(--muted-foreground)' }}>({totalItems} {tr('rows', 'lignes', 'صفوف')})</span>
          </span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(p - 1, 1))}
              style={{ height: 36, padding: '0 14px', borderRadius: 10, background: 'var(--card)', color: page <= 1 ? 'var(--border)' : 'var(--muted-foreground)', border: '2px solid var(--border)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
              <ChevronLeft size={15} /> {tr('Previous', 'Précédent', 'السابق')}
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              if (pageNum < 1 || pageNum > totalPages) return null;
              return (
                <button key={pageNum} onClick={() => setPage(pageNum)}
                  style={{ width: 36, height: 36, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '2px solid', background: pageNum === page ? '#2563eb' : 'var(--card)', color: pageNum === page ? '#fff' : 'var(--muted-foreground)', borderColor: pageNum === page ? '#2563eb' : 'var(--border)' }}>
                  {pageNum}
                </button>
              );
            })}
            <button disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              style={{ height: 36, padding: '0 14px', borderRadius: 10, background: 'var(--card)', color: page >= totalPages ? 'var(--border)' : 'var(--muted-foreground)', border: '2px solid var(--border)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>
              {tr('Next', 'Suivant', 'التالي')} <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
