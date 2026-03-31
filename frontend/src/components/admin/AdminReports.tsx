import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface ReportItem {
  _id: string;
  reportType: 'user' | 'app';
  reason: string;
  details?: string;
  status: 'submitted' | 'accepted' | 'rejected';
  createdAt: string;
  reporter?: {
    firstName?: string;
    lastName?: string;
    role?: string;
    email?: string;
  };
  targetUser?: {
    firstName?: string;
    lastName?: string;
    role?: string;
    email?: string;
    companyName?: string;
  };
}

interface AdminReportsProps {
  canManageReports?: boolean;
}

const getToken = () => {
  const direct = localStorage.getItem('token');
  if (direct) return direct;
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user).token || null : null;
  } catch {
    return null;
  }
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const STATUS_LABEL: Record<ReportItem['status'], string> = {
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export default function AdminReports({ canManageReports = false }: AdminReportsProps) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'user' | 'app'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchReports = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const query = filter === 'all' ? '' : `?type=${filter}`;
      const res = await axios.get(`/api/reports/admin${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const updateStatus = async (reportId: string, status: 'accepted' | 'rejected') => {
    if (!canManageReports) {
      toast.error('You do not have permission to manage reports.');
      return;
    }

    const token = getToken();
    if (!token) {
      toast.error('Authentication token is missing.');
      return;
    }

    setUpdatingId(reportId);
    try {
      const res = await axios.patch(
        `/api/reports/admin/${reportId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updated = res.data as ReportItem;
      setReports((prev) => prev.map((item) => (item._id === reportId ? updated : item)));
      toast.success(`Report ${status}.`);
    } catch {
      toast.error('Failed to update report status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const counts = useMemo(() => ({
    all: reports.length,
    user: reports.filter((item) => item.reportType === 'user').length,
    app: reports.filter((item) => item.reportType === 'app').length,
  }), [reports]);

  const statusClass = (status: ReportItem['status']) => {
    if (status === 'accepted') return 'border';
    if (status === 'rejected') return 'border';
    return 'border';
  };

  const statusStyle = (status: ReportItem['status']) => {
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
        <div className="flex min-h-24 flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Reports</h2>
            <p className="text-base text-muted-foreground">Review submitted user and app reports.</p>
          </div>
          <div className="inline-flex items-center rounded-xl border border-border bg-muted/30 p-1">
            {(['all', 'user', 'app'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  filter === item
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item === 'all' ? `All (${counts.all})` : item === 'user' ? `User (${counts.user})` : `App (${counts.app})`}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="border border-border shadow-sm">
        <div className="p-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading reports...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports found for this filter.</p>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => {
                const reporterName = `${report.reporter?.firstName || ''} ${report.reporter?.lastName || ''}`.trim() || 'Unknown user';
                const targetName = report.targetUser
                  ? (report.targetUser.companyName || `${report.targetUser.firstName || ''} ${report.targetUser.lastName || ''}`.trim() || 'Unknown target')
                  : 'App';
                const reportLabel = report.reportType === 'user' ? `User Report - ${targetName}` : 'App Report';

                const isUpdatingThis = updatingId === report._id;

                return (
                  <article key={report._id} className="rounded-2xl border border-amber-200/80 bg-background p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2 md:space-y-3">
                        <h3 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground md:text-4xl">
                          {reportLabel}
                        </h3>
                        <p className="text-2xl font-medium leading-tight text-foreground/80 md:text-3xl">{report.reason}</p>
                      </div>
                      <Badge
                        className={`px-3 py-1 text-sm font-semibold ${statusClass(report.status)}`}
                        style={statusStyle(report.status)}
                      >
                        {STATUS_LABEL[report.status]}
                      </Badge>
                    </div>

                    {report.details ? (
                      <p className="mt-6 text-base leading-7 text-foreground/90">{report.details}</p>
                    ) : null}

                    <div className="mt-6 flex flex-col gap-3 text-left md:flex-row md:items-end md:justify-between">
                      <div className="space-y-1 text-base text-foreground/85">
                        <p className="text-foreground/80">Reporter: {reporterName} ({report.reporter?.role || 'user'})</p>
                        <p className="font-medium">Created on {formatDate(report.createdAt)}</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant={report.status === 'accepted' ? 'secondary' : 'outline'}
                          disabled={isUpdatingThis || !canManageReports}
                          onClick={() => updateStatus(report._id, 'accepted')}
                          className={report.status === 'accepted' ? 'border-2 border-black font-semibold text-black' : ''}
                          title={canManageReports ? 'Accept report' : 'Permission required'}
                        >
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={report.status === 'rejected' ? 'secondary' : 'outline'}
                          disabled={isUpdatingThis || !canManageReports}
                          onClick={() => updateStatus(report._id, 'rejected')}
                          className={report.status === 'rejected' ? 'border-2 border-black font-semibold text-black' : ''}
                          title={canManageReports ? 'Reject report' : 'Permission required'}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
