/**
 * Reusable "Face Recognition" card for profile edit pages.
 * Shows:
 *  - If user already has face ID → a "registered" badge + Remove button
 *  - If not → a collapsible camera widget to register a new face
 */
import { useState, useEffect } from 'react';
import { ScanFace, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { Card } from '../ui/card';
import { toast } from 'sonner';
import authService from '../../services/authService';
import FaceCaptureWidget from '../auth/FaceCaptureWidget';

export default function FaceIdSection() {
  const [checking, setChecking] = useState(true);
  const [hasFaceId, setHasFaceId] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    authService.getFaceDescriptorStatus()
      .then((res) => setHasFaceId(res.hasFaceDescriptor))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleCapture = async (descriptor: number[]) => {
    setSaving(true);
    try {
      await authService.saveFaceDescriptor(descriptor);
      setHasFaceId(true);
      setShowCamera(false);
      toast.success('Face recognition registered successfully!');
    } catch {
      toast.error('Failed to save face data. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove face recognition? You can add it again later.')) return;
    setRemoving(true);
    try {
      await authService.deleteFaceDescriptor();
      setHasFaceId(false);
      toast.success('Face recognition removed.');
    } catch {
      toast.error('Failed to remove face data.');
    } finally {
      setRemoving(false);
    }
  };

  if (checking) {
    return (
      <Card className="p-6 flex items-center gap-3 text-muted-foreground">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Checking face recognition status…</span>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: hasFaceId ? '#dcfce7' : '#eff6ff' }}>
            <ScanFace size={20} style={{ color: hasFaceId ? '#16a34a' : '#2563eb' }} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Face Recognition</h3>
            <p className="text-sm text-muted-foreground">
              {hasFaceId
                ? 'Face ID is registered — you can log in without a password.'
                : 'Add face recognition to enable faster login.'}
            </p>
          </div>
        </div>

        {hasFaceId ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full"
              style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
              <CheckCircle2 size={14} /> Registered
            </span>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCamera(!showCamera)}
            className="shrink-0 text-sm font-semibold px-4 py-2 rounded-xl border-2 border-primary text-primary hover:bg-primary/5 transition-colors"
          >
            {showCamera ? 'Hide camera' : 'Add Face ID'}
          </button>
        )}
      </div>

      {!hasFaceId && showCamera && (
        <div className="mt-2">
          {saving ? (
            <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
              <Loader2 size={24} className="animate-spin" />
              <span className="font-medium">Saving face data…</span>
            </div>
          ) : (
            <FaceCaptureWidget
              mode="register"
              onCapture={handleCapture}
              onCancel={() => setShowCamera(false)}
            />
          )}
        </div>
      )}
    </Card>
  );
}
