import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import {
  AppWindow,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  FileText,
  Hammer,
  Loader2,
  User,
  XCircle,
} from 'lucide-react';

type ReportStatus = 'submitted' | 'accepted' | 'rejected';
type ReportType = 'user' | 'app';

interface MyReportsProps {
  role: 'artisan' | 'expert' | 'manufacturer';
  userId: string;
}

interface UserTargetOption {
  key: 'artisan' | 'expert' | 'manufacturer';
  label: string;
  description: string;
}

interface SelectableUser {
  id: string;
  name: string;
  role: 'artisan' | 'expert' | 'manufacturer';
  meta?: string;
}

interface ReportItem {
  _id: string;
  reportType: ReportType;
  reason: string;
  details?: string;
  status: ReportStatus;
  createdAt: string;
  targetUser?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    role?: string;
  } | null;
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const REPORT_REASONS = [
  'Harassment or abusive behavior',
  'Spam or misleading content',
  'Fraud or suspicious activity',
  'Late delivery or no-show',
  'Poor quality of service/product',
  'Policy violation',
  'Other',
];

const USER_TARGET_OPTIONS: Record<MyReportsProps['role'], UserTargetOption[]> = {
  artisan: [
    { key: 'expert', label: 'Expert', description: 'Report an expert account' },
    { key: 'manufacturer', label: 'Manufacturer', description: 'Report a manufacturer account' },
  ],
  expert: [
    { key: 'artisan', label: 'Artisan', description: 'Report an artisan account' },
    { key: 'manufacturer', label: 'Manufacturer', description: 'Report a manufacturer account' },
  ],
  manufacturer: [
    { key: 'expert', label: 'Expert', description: 'Report an expert account' },
    { key: 'artisan', label: 'Artisan', description: 'Report an artisan account' },
  ],
};

const roleToLabel = (target: SelectableUser['role']) =>
  target.charAt(0).toUpperCase() + target.slice(1);

const formatDate = (isoDate: string) => {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getAuthToken = () => {
  const direct = localStorage.getItem('token');
  if (direct) return direct;
  try {
    const rawUser = localStorage.getItem('user');
    return rawUser ? JSON.parse(rawUser).token || null : null;
  } catch {
    return null;
  }
};

const getRoleIcon = (target: UserTargetOption['key']) => {
  if (target === 'artisan') return <Hammer size={16} className="text-primary" />;
  if (target === 'expert') return <Briefcase size={16} className="text-primary" />;
  return <Building2 size={16} className="text-primary" />;
};

export default function MyReports({ role, userId: _userId }: MyReportsProps) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'user' | 'problem'>('all');

  const [isAdding, setIsAdding] = useState(false);
  const [reportType, setReportType] = useState<'user' | 'problem' | ''>('');
  const [selectedUserTarget, setSelectedUserTarget] = useState<'artisan' | 'expert' | 'manufacturer' | ''>('');
  const [users, setUsers] = useState<SelectableUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [form, setForm] = useState({
    reason: REPORT_REASONS[0],
    customReason: '',
    summary: '',
  });

  const fetchReports = async () => {
    const token = getAuthToken();
    if (!token) return;

    setLoadingReports(true);
    try {
      const response = await fetch('/api/reports/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load reports');
      }

      const data = await response.json();
      setReports(Array.isArray(data) ? data : []);
    } catch {
      setReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const totals = useMemo(() => {
    const submitted = reports.filter((report) => report.status === 'submitted').length;
    const accepted = reports.filter((report) => report.status === 'accepted').length;
    const rejected = reports.filter((report) => report.status === 'rejected').length;
    return {
      all: reports.length,
      submitted,
      accepted,
      rejected,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (historyFilter === 'all') return reports;

    return reports.filter((report) => {
      const isProblem = report.reportType === 'app';
      if (historyFilter === 'problem') return isProblem;
      return !isProblem;
    });
  }, [reports, historyFilter]);

  const resetForm = () => {
    setReportType('');
    setSelectedUserTarget('');
    setUsers([]);
    setUsersError('');
    setUsersLoading(false);
    setSearchQuery('');
    setSelectedUserId('');
    setForm({
      reason: REPORT_REASONS[0],
      customReason: '',
      summary: '',
    });
  };

  const fetchUsersByTarget = async (target: 'artisan' | 'expert' | 'manufacturer') => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const token = getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      if (target === 'artisan') {
        const response = await fetch('/api/artisans');
        const data = (await response.json()) as any[];
        const mapped: SelectableUser[] = (Array.isArray(data) ? data : []).map((item) => ({
          id: String(item._id),
          name: `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Artisan',
          role: 'artisan',
          meta: item.domain || item.location || '',
        }));
        setUsers(mapped);
        return;
      }

      if (target === 'manufacturer') {
        const response = await fetch('/api/products/marketplace', { headers });
        const data = (await response.json()) as any[];
        const unique = new Map<string, SelectableUser>();
        (Array.isArray(data) ? data : []).forEach((product) => {
          const manufacturer = product?.manufacturer;
          if (!manufacturer) return;
          const id = String(manufacturer._id || '');
          if (!id || unique.has(id)) return;
          const name = String(
            manufacturer.companyName || `${manufacturer.firstName || ''} ${manufacturer.lastName || ''}`.trim() || 'Manufacturer',
          );
          unique.set(id, {
            id,
            name,
            role: 'manufacturer',
            meta: 'Marketplace seller',
          });
        });
        setUsers(Array.from(unique.values()));
        return;
      }

      const response = await fetch('/api/conversations', { headers });
      const conversations = (await response.json()) as any[];
      const unique = new Map<string, SelectableUser>();
      (Array.isArray(conversations) ? conversations : []).forEach((conversation) => {
        const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
        participants.forEach((participant: any) => {
          const participantRole = participant?.role;
          const participantId = String(participant?._id || '');
          if (participantRole !== 'expert' || !participantId || unique.has(participantId)) return;
          unique.set(participantId, {
            id: participantId,
            name: `${participant.firstName || ''} ${participant.lastName || ''}`.trim() || 'Expert',
            role: 'expert',
            meta: 'From your conversations',
          });
        });
      });
      setUsers(Array.from(unique.values()));
    } catch {
      setUsers([]);
      setUsersError('Unable to load users right now. Please try again.');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleReportType = async (nextType: 'user' | 'problem') => {
    setReportType(nextType);
    setSelectedUserId('');
    setSearchQuery('');
    setUsers([]);
    setUsersError('');

    if (nextType === 'problem') {
      setSelectedUserTarget('');
      return;
    }

    const defaultTarget = USER_TARGET_OPTIONS[role][0]?.key || '';
    setSelectedUserTarget(defaultTarget);
    if (defaultTarget) {
      await fetchUsersByTarget(defaultTarget);
    }
  };

  const handleUserTargetChange = async (target: 'artisan' | 'expert' | 'manufacturer') => {
    setSelectedUserTarget(target);
    setSelectedUserId('');
    setSearchQuery('');
    await fetchUsersByTarget(target);
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((item) => {
      const haystack = `${item.name} ${item.meta || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [users, searchQuery]);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [users, selectedUserId],
  );

  const isSubmitDisabled =
    !reportType ||
    (reportType === 'user' && !selectedUserId) ||
    (form.reason === 'Other' && !form.customReason.trim());

  const submitReport = async () => {
    if (isSubmitDisabled) return;

    const token = getAuthToken();
    if (!token) {
      toast.error('You must be logged in to submit a report.');
      return;
    }

    const reasonLabel = form.reason === 'Other' ? form.customReason.trim() : form.reason;
    const isUserReport = reportType === 'user';

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reportType: isUserReport ? 'user' : 'app',
          targetUserId: isUserReport ? selectedUser?.id : undefined,
          targetRole: isUserReport ? selectedUserTarget : undefined,
          reason: reasonLabel,
          details: form.summary.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }
    } catch {
      toast.error('Failed to submit report. Please try again.');
      return;
    }

    await fetchReports();
    toast.success('Report submitted. We will notify you soon via email once it is treated.');
    setIsAdding(false);
    resetForm();
  };

  const getStatusClasses = (status: ReportStatus) => {
    if (status === 'accepted') return 'border';
    if (status === 'rejected') return 'border';
    if (status === 'submitted') return 'border';
    return 'border';
  };

  const getStatusStyle = (status: ReportStatus) => {
    if (status === 'accepted') {
      return {
        backgroundColor: '#dcfce7',
        borderColor: '#86efac',
        color: '#166534',
      };
    }
    if (status === 'rejected') {
      return {
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5',
        color: '#991b1b',
      };
    }
    return {
      backgroundColor: '#fef3c7',
      borderColor: '#fcd34d',
      color: '#92400e',
    };
  };

  return (
    <div className="space-y-8">
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-col gap-5 py-6 md:min-h-24 md:flex-row md:items-center md:justify-between">
          <div className="flex min-h-14 items-center">
            <CardTitle className="text-3xl font-semibold leading-tight tracking-tight text-foreground">My Reports</CardTitle>
          </div>
          <Button
            type="button"
            onClick={() => {
              if (isAdding) {
                setIsAdding(false);
                resetForm();
                return;
              }
              setIsAdding(true);
            }}
            className="gap-2"
          >
            <FilePlus2 size={16} />
            {isAdding ? 'Close Form' : 'Add Report'}
          </Button>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <p className="text-base text-muted-foreground">Total Reports</p>
              <p className="text-3xl font-bold">{totals.all}</p>
            </div>
            <ClipboardList className="text-primary" size={24} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <p className="text-base text-muted-foreground">Submitted</p>
              <p className="text-3xl font-bold">{totals.submitted}</p>
            </div>
            <BarChart3 className="text-blue-600" size={24} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <p className="text-base text-muted-foreground">Accepted</p>
              <p className="text-3xl font-bold">{totals.accepted}</p>
            </div>
            <CheckCircle2 className="text-green-600" size={24} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <p className="text-base text-muted-foreground">Rejected</p>
              <p className="text-3xl font-bold">{totals.rejected}</p>
            </div>
            <XCircle className="text-red-600" size={24} />
          </CardContent>
        </Card>
      </div>

      {isAdding && (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-semibold">Add Report</CardTitle>
            <CardDescription>
              First choose report user or report problem, then select a logical reason or write your own.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => { void handleReportType('user'); }}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  reportType === 'user' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
                }`}
              >
                <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2.5">
                  <User size={18} className="text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground">Report User</p>
                <p className="mt-1 text-sm text-muted-foreground">Report an artisan, expert, or manufacturer account.</p>
              </button>

              <button
                type="button"
                onClick={() => { void handleReportType('problem'); }}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  reportType === 'problem' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
                }`}
              >
                <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2.5">
                  <AppWindow size={18} className="text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground">Report Problem</p>
                <p className="mt-1 text-sm text-muted-foreground">Report a bug, issue, or content problem on the app.</p>
              </button>
            </div>

            {reportType === 'user' && (
              <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                <div className="space-y-2">
                  <label className="text-base font-medium text-foreground" htmlFor="report-user-target">User Type</label>
                  <select
                    id="report-user-target"
                    value={selectedUserTarget}
                    onChange={(e) => { void handleUserTargetChange(e.target.value as 'artisan' | 'expert' | 'manufacturer'); }}
                    className="h-11 w-full rounded-md border border-input bg-input-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {USER_TARGET_OPTIONS[role].map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                  {selectedUserTarget && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      {getRoleIcon(selectedUserTarget)}
                      <span>{USER_TARGET_OPTIONS[role].find((item) => item.key === selectedUserTarget)?.description}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-base font-medium text-foreground" htmlFor="report-user-search">Select User</label>
                  <Input
                    id="report-user-search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by user name"
                  />
                </div>

                <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-2">
                  {usersLoading && (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" />
                      Loading users...
                    </div>
                  )}

                  {!usersLoading && usersError && (
                    <p className="py-8 text-center text-sm text-red-600">{usersError}</p>
                  )}

                  {!usersLoading && !usersError && filteredUsers.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No users found.</p>
                  )}

                  {!usersLoading && !usersError && filteredUsers.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedUserId(entry.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedUserId === entry.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:bg-muted'
                      }`}
                    >
                      <p className="text-base font-semibold text-foreground">{entry.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {roleToLabel(entry.role)}{entry.meta ? ` - ${entry.meta}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-base font-medium text-foreground" htmlFor="report-reason">Reason</label>
              <select
                id="report-reason"
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                className="h-11 w-full rounded-md border border-input bg-input-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>

            {form.reason === 'Other' && (
              <div className="space-y-2">
                <label className="text-base font-medium text-foreground" htmlFor="report-custom-reason">Custom reason</label>
                <Input
                  id="report-custom-reason"
                  value={form.customReason}
                  onChange={(e) => setForm((prev) => ({ ...prev, customReason: e.target.value }))}
                  placeholder="Write your own report reason"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-base font-medium text-foreground" htmlFor="report-summary">Report details (optional)</label>
              <Textarea
                id="report-summary"
                value={form.summary}
                onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                placeholder="Explain what happened..."
                className="min-h-32 text-base"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => { void submitReport(); }} disabled={isSubmitDisabled}>
                Submit Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl font-semibold">Report History</CardTitle>
              <CardDescription>
                Latest reports submitted under your account.
              </CardDescription>
            </div>
            <div className="inline-flex items-center rounded-xl border border-border bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setHistoryFilter('all')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  historyFilter === 'all'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('user')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  historyFilter === 'user'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                User Reports
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('problem')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  historyFilter === 'problem'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                App Reports
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingReports ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              Loading reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
              <FileText size={34} className="mb-3 text-muted-foreground" />
              <p className="text-base font-medium text-foreground">No reports found</p>
              <p className="text-sm text-muted-foreground">
                {historyFilter === 'all'
                  ? 'Create your first report using the Add Report button.'
                  : 'Try another filter or create a new report.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => {
                const targetName = report.targetUser
                  ? (report.targetUser.companyName || `${report.targetUser.firstName || ''} ${report.targetUser.lastName || ''}`.trim() || 'User')
                  : null;
                const displayTitle = report.reportType === 'user' && targetName
                  ? `User Report - ${targetName}`
                  : report.reportType === 'app'
                    ? 'App Report'
                    : 'Report';

                return (
                  <article key={report._id} className="rounded-2xl border border-border bg-background p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-semibold tracking-tight text-foreground">{displayTitle}</h3>
                        <p className="text-lg text-muted-foreground">{report.reason}</p>
                      </div>
                      <Badge
                        className={`px-3 py-1 text-sm font-semibold ${getStatusClasses(report.status)}`}
                        style={getStatusStyle(report.status)}
                      >
                        {STATUS_LABEL[report.status]}
                      </Badge>
                    </div>

                    {report.details && (
                      <div className="mt-4">
                        <p className="text-base leading-7 text-foreground/90">{report.details}</p>
                      </div>
                    )}

                    <p className="mt-6 text-sm font-medium text-muted-foreground">Created on {formatDate(report.createdAt)}</p>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
