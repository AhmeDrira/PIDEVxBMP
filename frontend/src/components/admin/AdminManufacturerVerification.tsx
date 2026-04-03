import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle, XCircle, FileText, Building } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import authService from '../../services/authService';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';

interface AdminManufacturerVerificationProps {
  canVerifyManufacturers?: boolean;
}

type CertificationFile = string | { fileName?: string; data?: unknown; contentType?: string } | null;

type ManufacturerItem = {
  _id: string;
  companyName: string;
  email: string;
  certificationFile?: CertificationFile;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
};

const getCertFileName = (cf: CertificationFile, t: (key: string) => string): string => {
  if (!cf) return t('admin.verification.notProvided');
  if (typeof cf === 'string') return cf;
  return cf.fileName || t('admin.verification.documentUploaded');
};

export default function AdminManufacturerVerification({ canVerifyManufacturers = false }: AdminManufacturerVerificationProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  const { t } = useLanguage();
  const [pendingManufacturers, setPendingManufacturers] = useState<ManufacturerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await authService.getPendingManufacturers();
      // The backend returns verificationStatus, let's ensure we use that
      setPendingManufacturers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const approve = async (id: string) => {
    if (!canVerifyManufacturers) {
      toast.error(t('admin.verification.noPermission'));
      return;
    }
    await authService.approveManufacturer(id);
    await loadData();
  };

  const reject = async (id: string) => {
    if (!canVerifyManufacturers) {
      toast.error(t('admin.verification.noPermission'));
      return;
    }
    await authService.rejectManufacturer(id, rejectReason);
    setRejectingId(null);
    setRejectReason('');
    await loadData();
  };

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-3 gap-6">
        <StatsCard
          label={t('admin.verification.pendingReviews')}
          value={pendingManufacturers.length}
          icon={<FileText size={28} />}
          color="#F59E0B"
          subtitle={t('admin.verification.awaitingApproval')}
        />
        <StatsCard
          label={t('admin.verification.approvedThisMonth')}
          value="12"
          icon={<CheckCircle size={28} />}
          color="#10B981"
          trend="+3"
          trendUp={true}
        />
        <StatsCard
          label={t('admin.verification.rejected')}
          value="3"
          icon={<XCircle size={28} />}
          color="#EF4444"
          subtitle={t('admin.verification.thisMonth')}
        />
      </div>

      <div className="space-y-4">
        {loading && <p className="text-muted-foreground">{t('common.loading')}</p>}
        {!loading && pendingManufacturers.length === 0 && (
          <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
            <p className="text-muted-foreground">{t('admin.verification.noPending')}</p>
          </Card>
        )}
        {pendingManufacturers.map((manufacturer) => (
          <Card key={manufacturer._id} className="p-8 bg-card rounded-2xl border border-border shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-2xl font-bold text-foreground">{manufacturer.companyName}</h3>
                  <Badge className="bg-secondary/10 text-secondary border-secondary/20 border-2 px-4 py-1.5 text-sm font-semibold">
                    {t('admin.verification.pendingReview')}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <p><strong className="text-foreground">{t('admin.verification.email')}</strong> {manufacturer.email}</p>
                  <p><strong className="text-foreground">{t('admin.verification.submitted')}</strong> {manufacturer.createdAt ? new Date(manufacturer.createdAt).toLocaleDateString() : '-'}</p>
                </div>
              </div>

              <div className="space-y-4 lg:min-w-[280px]">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border-2 border-border">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{t('admin.verification.certificationDoc')}</p>
                    <p className="text-xs text-muted-foreground truncate">{getCertFileName(manufacturer.certificationFile, t)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-2"
                    disabled={!manufacturer.certificationFile}
                    onClick={async () => {
                      try {
                        const blob = await authService.getCertificationFile(manufacturer._id);
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank');
                      } catch (err) {
                        toast.error(t('admin.verification.couldNotLoadDoc'));
                      }
                    }}
                  >
                    <Building size={16} className="mr-2" />
                    {t('admin.verification.viewDocument')}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => approve(manufacturer._id)}
                    className="flex-1 h-12 text-white bg-accent hover:bg-accent/90 rounded-xl shadow-md"
                    disabled={!canVerifyManufacturers}
                    title={canVerifyManufacturers ? 'Approve manufacturer' : 'Permission required'}
                  >
                    <CheckCircle size={18} className="mr-2" />
                    {t('admin.verification.approve')}
                  </Button>
                  <Button
                    onClick={() => setRejectingId(manufacturer._id)}
                    className="flex-1 h-12 text-white bg-destructive hover:bg-destructive/90 rounded-xl shadow-md"
                    disabled={!canVerifyManufacturers}
                    title={canVerifyManufacturers ? 'Reject manufacturer' : 'Permission required'}
                  >
                    <XCircle size={18} className="mr-2" />
                    {t('admin.verification.reject')}
                  </Button>
                </div>
                {rejectingId === manufacturer._id && (
                  <div className="space-y-2">
                    <textarea
                      className="w-full h-20 rounded-xl border-2 border-border p-3"
                      placeholder={t('admin.verification.rejectionReason')}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => { setRejectingId(null); setRejectReason(''); }}>{t('common.cancel')}</Button>
                      <Button
                        className="flex-1 bg-destructive text-white"
                        onClick={() => reject(manufacturer._id)}
                        disabled={!canVerifyManufacturers}
                      >
                        {t('admin.verification.confirmReject')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
