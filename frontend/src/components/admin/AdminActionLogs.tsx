import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  BarChart3,
  CalendarRange,
  CreditCard,
  Filter,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldEllipsis,
  ShoppingBag,
  Trash2,
  UserCog,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import actionLogService, { ActionLogItem } from '../../services/actionLogService';
import authService from '../../services/authService';

const roleColors: Record<string, string> = {
  artisan: 'bg-amber-500/15 text-amber-200 border-amber-400/40',
  expert: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40',
  manufacturer: 'bg-violet-500/15 text-violet-200 border-violet-400/40',
  admin: 'bg-rose-500/15 text-rose-200 border-rose-400/40',
  system: 'bg-slate-500/15 text-slate-200 border-slate-400/40',
};

const actionLabels = [
  { label: 'Toutes les actions', value: '' },
  { label: 'Projet créé', value: 'artisan.project.create' },
  { label: 'Devis généré', value: 'artisan.quote.create' },
  { label: 'Facture générée', value: 'artisan.invoice.create' },
  { label: 'Facture supprimée', value: 'artisan.invoice.delete' },
  { label: 'Paiement tranche 1 facture', value: 'artisan.invoice.payment.upfront' },
  { label: 'Paiement tranche 2 facture', value: 'artisan.invoice.payment.completion' },
  { label: 'Matériel ajouté', value: 'manufacturer.product.create' },
  { label: 'Matériel modifié', value: 'manufacturer.product.update' },
  { label: 'Matériel supprimé', value: 'manufacturer.product.delete' },
  { label: 'Achat marketplace', value: 'marketplace.checkout' },
  { label: 'Achat marketplace (Stripe)', value: 'marketplace.checkout.stripe' },
  { label: 'Sous-admin créé', value: 'admin.subadmin.create' },
  { label: 'Mot de passe sous-admin réinitialisé', value: 'admin.subadmin.password.reset' },
  { label: 'Fabricant approuvé', value: 'admin.manufacturer.approve' },
  { label: 'Fabricant rejeté', value: 'admin.manufacturer.reject' },
  { label: 'Utilisateur suspendu', value: 'admin.user.suspend' },
  { label: 'Utilisateur activé', value: 'admin.user.activate' },
  { label: 'Utilisateur supprimé', value: 'admin.user.delete' },
];

type BasicUserRow = {
  _id: string;
  role: string;
  adminType?: string;
};

export default function AdminActionLogs() {
  const [logs, setLogs] = useState<ActionLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [accountStats, setAccountStats] = useState({ total: 0, users: 0, subAdmins: 0 });
  const [accountStatsLoading, setAccountStatsLoading] = useState(false);
  const [logSummary, setLogSummary] = useState({
    total: 0,
    paymentEvents: 0,
    marketplaceEvents: 0,
    invoiceInstallmentEvents: 0,
    manufacturerProductEvents: 0,
    adminSecurityEvents: 0,
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
      const response = await actionLogService.list({
        page: targetPage,
        limit,
        search,
        actorRole,
        actionKey,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setLogs(response.logs);
      setTotalPages(response.pagination.pages);
      setTotalItems(response.pagination.total);
      if (response.summary) {
        setLogSummary(response.summary);
      }
      setSelectedIds([]);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Impossible de charger les logs.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(page);
  }, [page]);

  useEffect(() => {
    setPage(1);
    loadLogs(1);
  }, [search, actorRole, actionKey, fromDate, toDate]);

  const loadAccountStats = async () => {
    setAccountStatsLoading(true);
    try {
      const users = (await authService.listUsers()) as BasicUserRow[];
      const total = Array.isArray(users) ? users.length : 0;
      const nonAdminUsers = Array.isArray(users)
        ? users.filter((u) => ['artisan', 'expert', 'manufacturer'].includes(String(u.role).toLowerCase()))
        : [];
      const subAdmins = Array.isArray(users)
        ? users.filter(
            (u) => String(u.role).toLowerCase() === 'admin' && String(u.adminType || '').toLowerCase() === 'sub'
          )
        : [];

      setAccountStats({
        total,
        users: nonAdminUsers.length,
        subAdmins: subAdmins.length,
      });
    } catch (error: any) {
      const message = error?.response?.data?.message || "Impossible de charger les statistiques d'utilisateurs.";
      toast.error(message);
      setAccountStats({ total: 0, users: 0, subAdmins: 0 });
    } finally {
      setAccountStatsLoading(false);
    }
  };

  useEffect(() => {
    loadAccountStats();
  }, []);

  const isAllSelected = logs.length > 0 && selectedIds.length === logs.length;

  const toggleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedIds(logs.map((log) => log._id));
      return;
    }
    setSelectedIds([]);
  };

  const toggleRowSelection = (id: string, checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedIds((prev) => [...prev, id]);
      return;
    }
    setSelectedIds((prev) => prev.filter((value) => value !== id));
  };

  const deleteOne = async (id: string) => {
    try {
      await actionLogService.deleteById(id);
      toast.success('Log supprimé.');
      loadLogs(page);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Impossible de supprimer le log.';
      toast.error(message);
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) {
      toast.error('Sélectionnez au moins un log.');
      return;
    }
    try {
      await actionLogService.bulkDelete(selectedIds);
      toast.success('Logs sélectionnés supprimés.');
      loadLogs(page);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Impossible de supprimer la sélection.';
      toast.error(message);
    }
  };

  const formatMoney = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : null;
  };

  const renderMetadataDetails = (log: ActionLogItem) => {
    const metadata = (log.metadata || {}) as Record<string, unknown>;
    const chips: string[] = [];

    const itemCount = Number(metadata.itemCount || 0);
    if (Number.isFinite(itemCount) && itemCount > 0) chips.push(`${itemCount} item(s)`);

    const amount = formatMoney(metadata.totalAmount ?? metadata.amount);
    if (amount) chips.push(`${amount} ${(metadata.currency || 'USD') as string}`);

    const phase = String(metadata.phase || '').trim();
    if (phase) chips.push(`phase: ${phase}`);

    const stripeSessionId = String(metadata.stripeSessionId || metadata.sessionId || '').trim();
    if (stripeSessionId) chips.push(`session: ${stripeSessionId.slice(0, 12)}...`);

    const invoiceNumber = String(metadata.invoiceNumber || '').trim();
    if (invoiceNumber) chips.push(`invoice: ${invoiceNumber}`);

    const quoteNumber = String(metadata.quoteNumber || '').trim();
    if (quoteNumber) chips.push(`quote: ${quoteNumber}`);

    const productName = String(metadata.name || '').trim();
    if (productName) chips.push(`material: ${productName}`);

    if (!chips.length) return null;

    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((chip, idx) => (
          <span key={`${log._id}-chip-${idx}`} className="text-[11px] px-2 py-1 rounded-md bg-blue-900/55 text-cyan-100 border border-blue-700/70">
            {chip}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-7 text-slate-100">
      <div className="relative overflow-hidden rounded-3xl p-7 border border-blue-800 bg-gradient-to-br from-[#071427] via-[#0a2f59] to-[#0e4f7a] shadow-[0_20px_55px_rgba(1,8,22,0.55)]">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 w-72 h-72 rounded-full bg-blue-400/25 blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl lg:text-4xl font-black text-cyan-100 tracking-tight flex items-center gap-3">
              <History className="text-cyan-300" size={34} />
              Logs & Historiques
            </h1>
            <p className="text-blue-100 mt-3 text-base lg:text-lg max-w-2xl leading-relaxed font-medium">
              Suivi centralisé des actions + audit des accès (super admin).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[320px]">
            <Card className="p-4 border border-cyan-400/40 bg-[#061a33] shadow-none">
              <p className="text-xs uppercase tracking-wider text-cyan-200">Total comptes</p>
              <p className="text-3xl font-black text-cyan-100 mt-1">{accountStatsLoading ? '…' : accountStats.total}</p>
            </Card>
            <Card className="p-4 border border-cyan-400/40 bg-[#061a33] shadow-none">
              <p className="text-xs uppercase tracking-wider text-cyan-200">Utilisateurs</p>
              <p className="text-3xl font-black text-cyan-100 mt-1">{accountStatsLoading ? '…' : accountStats.users}</p>
            </Card>
            <Card className="p-4 border border-cyan-400/40 bg-[#061a33] shadow-none">
              <p className="text-xs uppercase tracking-wider text-cyan-200">Sous-admins</p>
              <p className="text-3xl font-black text-cyan-100 mt-1">{accountStatsLoading ? '…' : accountStats.subAdmins}</p>
            </Card>
          </div>
        </div>
      </div>

      <Card className="p-6 rounded-3xl border border-blue-900 shadow-[0_12px_30px_rgba(2,10,28,0.45)] bg-[#071a31]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4">
            <div className="h-11 w-full rounded-xl border border-blue-700 bg-[#0b2748] px-3 flex items-center gap-2">
              <Search className="text-cyan-300 shrink-0" size={17} />
              <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher: nom, action, cible…"
                className="h-full border-0 bg-transparent text-cyan-50 placeholder:text-blue-200/70 focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearch(searchInput.trim());
                }
              }}
            />
            </div>
          </div>

          <div className="lg:col-span-2">
            <select
              value={actorRole}
              onChange={(e) => setActorRole(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-blue-700 bg-[#0b2748] text-cyan-50"
            >
              <option value="">Tous les rôles</option>
              <option value="artisan">Artisan</option>
              <option value="expert">Expert</option>
              <option value="manufacturer">Fabricant</option>
              <option value="admin">Admin / Sous-admin</option>
            </select>
          </div>

          <div className="lg:col-span-3">
            <select
              value={actionKey}
              onChange={(e) => setActionKey(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-blue-700 bg-[#0b2748] text-cyan-50"
            >
              {actionLabels.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3 flex gap-2">
            <Button
              className="h-11 px-5 rounded-xl text-cyan-50 bg-blue-600 hover:bg-blue-500 shadow"
              onClick={() => setSearch(searchInput.trim())}
            >
              <Filter size={16} className="mr-2" />
              Appliquer
            </Button>
            <Button
              variant="outline"
              className="h-11 px-5 rounded-xl border border-blue-700 text-cyan-100 bg-[#0b2748] hover:bg-[#13365f]"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setActorRole('');
                setActionKey('');
                setFromDate('');
                setToDate('');
              }}
            >
              <RefreshCw size={16} className="mr-2" />
              Réinitialiser
            </Button>
          </div>

          <div className="lg:col-span-6">
            <div className="flex items-center gap-2 text-cyan-100">
              <CalendarRange size={16} className="text-cyan-300" />
              <p className="text-sm font-semibold">Période (intervalle)</p>
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-200 w-10">Du</span>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-11 rounded-xl border border-blue-700 bg-[#0b2748] text-cyan-50"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-200 w-10">Au</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-11 rounded-xl border border-blue-700 bg-[#0b2748] text-cyan-50"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-blue-200/85">
              Filtre les actions créées entre ces 2 dates (inclus). Laissez vide pour ne pas filtrer.
            </p>
          </div>

          <div className="lg:col-span-6 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-xl border border-rose-500/60 text-rose-100 bg-rose-950/40 hover:bg-rose-900/50"
              disabled={!selectedIds.length}
              onClick={deleteSelected}
            >
              <Trash2 size={16} className="mr-2" />
              Supprimer sélection ({selectedIds.length})
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl border border-indigo-500/60 text-indigo-100 bg-indigo-950/40 hover:bg-indigo-900/50"
              onClick={() => {
                loadAccountStats();
                loadLogs(page);
              }}
            >
              <RefreshCw size={16} className="mr-2" />
              Actualiser
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <Card className="p-4 border border-blue-800 bg-[#071a31] shadow-none">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-blue-200">Paiements</p>
            <CreditCard size={16} className="text-cyan-300" />
          </div>
          <p className="text-2xl font-black text-cyan-100 mt-2">{logSummary.paymentEvents}</p>
        </Card>
        <Card className="p-4 border border-blue-800 bg-[#071a31] shadow-none">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-blue-200">Marketplace</p>
            <ShoppingBag size={16} className="text-cyan-300" />
          </div>
          <p className="text-2xl font-black text-cyan-100 mt-2">{logSummary.marketplaceEvents}</p>
        </Card>
        <Card className="p-4 border border-blue-800 bg-[#071a31] shadow-none">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-blue-200">Tranches facture</p>
            <BarChart3 size={16} className="text-cyan-300" />
          </div>
          <p className="text-2xl font-black text-cyan-100 mt-2">{logSummary.invoiceInstallmentEvents}</p>
        </Card>
        <Card className="p-4 border border-blue-800 bg-[#071a31] shadow-none">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-blue-200">Actions produit</p>
            <Wrench size={16} className="text-cyan-300" />
          </div>
          <p className="text-2xl font-black text-cyan-100 mt-2">{logSummary.manufacturerProductEvents}</p>
        </Card>
        <Card className="p-4 border border-blue-800 bg-[#071a31] shadow-none">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-blue-200">Sécurité admin</p>
            <ShieldEllipsis size={16} className="text-cyan-300" />
          </div>
          <p className="text-2xl font-black text-cyan-100 mt-2">{logSummary.adminSecurityEvents}</p>
        </Card>
      </div>

      <Card className="p-4 rounded-2xl border border-blue-900 bg-[#071a31] shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-blue-200">Top actions (filtre courant)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {logSummary.topActions.length ? (
                logSummary.topActions.map((item) => (
                  <button
                    key={item.actionKey}
                    type="button"
                    onClick={() => setActionKey(item.actionKey)}
                    className="text-left px-3 py-1.5 rounded-lg border border-blue-700 bg-[#0b2748] hover:bg-[#13365f]"
                  >
                    <div className="text-xs text-cyan-100 font-semibold">{item.actionLabel}</div>
                    <div className="text-[11px] text-blue-200">{item.count} occurrence(s)</div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-blue-200">Aucune action trouvée sur le filtre courant.</p>
              )}
            </div>
          </div>
          <div className="text-sm text-blue-200">
            Répartition rôles: artisan {logSummary.byRole.artisan || 0} | expert {logSummary.byRole.expert || 0} | fabricant {logSummary.byRole.manufacturer || 0} | admin {logSummary.byRole.admin || 0}
          </div>
        </div>
      </Card>

      <Card className="rounded-3xl border border-blue-900 shadow-[0_12px_30px_rgba(2,10,28,0.45)] overflow-hidden bg-[#071a31]">
        <div className="p-6 border-b border-blue-900 bg-gradient-to-r from-[#0a2b51] to-[#0f4372] flex items-center justify-between">
          <h2 className="text-3xl font-black text-cyan-100">Historique des actions</h2>
          <div className="flex items-center gap-2 text-sm text-cyan-100/90 font-semibold">
            <ShieldCheck size={16} className="text-cyan-300" />
            {totalItems} logs au total
          </div>
        </div>

        <Table className="text-[15px]">
          <TableHeader className="bg-[#0d2f56]">
            <TableRow>
              <TableHead className="w-10 text-cyan-100 font-bold uppercase tracking-wide text-xs">
                <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead className="text-cyan-100 font-bold uppercase tracking-wide text-xs">Acteur</TableHead>
              <TableHead className="text-cyan-100 font-bold uppercase tracking-wide text-xs">Rôle</TableHead>
              <TableHead className="text-cyan-100 font-bold uppercase tracking-wide text-xs">Action</TableHead>
              <TableHead className="text-cyan-100 font-bold uppercase tracking-wide text-xs">Cible</TableHead>
              <TableHead className="text-cyan-100 font-bold uppercase tracking-wide text-xs">Date</TableHead>
              <TableHead className="text-cyan-100 font-bold uppercase tracking-wide text-xs">Détails</TableHead>
              <TableHead className="text-right text-cyan-100 font-bold uppercase tracking-wide text-xs">Supp.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-blue-200 font-medium bg-[#071a31]">
                  Chargement des logs…
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-28 text-center text-blue-200 font-medium bg-[#071a31]">
                  Aucun log trouvé avec ces filtres.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log._id} className="bg-[#071a31] border-blue-950 hover:bg-[#0a2342]">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(log._id)}
                      onCheckedChange={(checked: boolean | 'indeterminate') => toggleRowSelection(log._id, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-cyan-50">{log.actorName || '-'}</div>
                    {log.actorAdminType && (
                      <div className="text-xs text-blue-200 flex items-center gap-1 mt-1 font-medium">
                        <UserCog size={12} />
                        {log.actorAdminType === 'sub' ? 'sous-admin' : 'super admin'}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`border ${roleColors[log.actorRole] || roleColors.system}`}>
                      {log.actorRole}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-cyan-50">{log.actionLabel}</div>
                    <div className="text-xs text-blue-200">{log.actionKey}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold text-cyan-50">{log.targetName || '-'}</div>
                    <div className="text-xs text-blue-200">{log.targetRole || log.entityType}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-cyan-50 font-semibold">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-blue-200">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[360px]">
                    <p className="text-sm text-blue-100 leading-5">
                      {log.description || 'Aucun détail supplémentaire'}
                    </p>
                    {renderMetadataDetails(log)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg border border-red-400/50 bg-red-950/50 hover:bg-red-900/70"
                      onClick={() => deleteOne(log._id)}
                    >
                      <Trash2 size={14} className="text-red-200" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="p-4 border-t border-blue-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#0a2b51]">
          <p className="text-sm text-cyan-100 font-medium">
            Page {page} / {totalPages} ({totalItems} lignes)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-lg border border-blue-700 text-cyan-100 bg-[#0b2748] hover:bg-[#13365f]"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              className="rounded-lg border border-blue-700 text-cyan-100 bg-[#0b2748] hover:bg-[#13365f]"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            >
              Suivant
            </Button>
          </div>
        </div>
      </Card>

    </div>
  );
}
