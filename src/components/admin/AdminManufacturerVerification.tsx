import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle, XCircle, FileText, Building } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import authService from '../../services/authService';

type CertificationFile = string | { fileName?: string; data?: unknown; contentType?: string } | null;

type ManufacturerItem = {
  _id: string;
  companyName: string;
  email: string;
  certificationFile?: CertificationFile;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
};

const getCertFileName = (cf: CertificationFile): string => {
  if (!cf) return 'Not provided';
  if (typeof cf === 'string') return cf;
  return cf.fileName || 'Document uploaded';
};

export default function AdminManufacturerVerification() {
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
    await authService.approveManufacturer(id);
    await loadData();
  };

  const reject = async (id: string) => {
    await authService.rejectManufacturer(id, rejectReason);
    setRejectingId(null);
    setRejectReason('');
    await loadData();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Manufacturer Verification</h1>
        <p className="text-lg text-muted-foreground">Review and approve manufacturer applications</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <StatsCard
          label="Pending Reviews"
          value={pendingManufacturers.length}
          icon={<FileText size={28} />}
          color="#F59E0B"
          subtitle="Awaiting approval"
        />
        <StatsCard
          label="Approved This Month"
          value="12"
          icon={<CheckCircle size={28} />}
          color="#10B981"
          trend="+3"
          trendUp={true}
        />
        <StatsCard
          label="Rejected"
          value="3"
          icon={<XCircle size={28} />}
          color="#EF4444"
          subtitle="This month"
        />
      </div>

      <div className="space-y-4">
        {loading && <p className="text-muted-foreground">Loading...</p>}
        {!loading && pendingManufacturers.length === 0 && (
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <p className="text-muted-foreground">No pending manufacturer applications.</p>
          </Card>
        )}
        {pendingManufacturers.map((manufacturer) => (
          <Card key={manufacturer._id} className="p-8 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-2xl font-bold text-foreground">{manufacturer.companyName}</h3>
                  <Badge className="bg-secondary/10 text-secondary border-secondary/20 border-2 px-4 py-1.5 text-sm font-semibold">
                    Pending Review
                  </Badge>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <p><strong className="text-foreground">Email:</strong> {manufacturer.email}</p>
                  <p><strong className="text-foreground">Submitted:</strong> {manufacturer.createdAt ? new Date(manufacturer.createdAt).toLocaleDateString() : '-'}</p>
                </div>
              </div>

              <div className="space-y-4 lg:min-w-[280px]">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Certification Document</p>
                    <p className="text-xs text-muted-foreground truncate">{getCertFileName(manufacturer.certificationFile)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-2"
                    onClick={async () => {
                      try {
                        const blob = await authService.getCertificationFile(manufacturer._id);
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank');
                      } catch (err) {
                        alert('Could not load document. The manufacturer may not have uploaded a file.');
                      }
                    }}
                  >
                    <Building size={16} className="mr-2" />
                    View Document
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => approve(manufacturer._id)} className="flex-1 h-12 text-white bg-accent hover:bg-accent/90 rounded-xl shadow-md">
                    <CheckCircle size={18} className="mr-2" />
                    Approve
                  </Button>
                  <Button onClick={() => setRejectingId(manufacturer._id)} className="flex-1 h-12 text-white bg-destructive hover:bg-destructive/90 rounded-xl shadow-md">
                    <XCircle size={18} className="mr-2" />
                    Reject
                  </Button>
                </div>
                {rejectingId === manufacturer._id && (
                  <div className="space-y-2">
                    <textarea
                      className="w-full h-20 rounded-xl border-2 border-gray-200 p-3"
                      placeholder="Provide a rejection reason (optional)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</Button>
                      <Button className="flex-1 bg-destructive text-white" onClick={() => reject(manufacturer._id)}>Confirm Reject</Button>
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
