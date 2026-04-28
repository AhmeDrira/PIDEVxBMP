import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import axios from 'axios';
import {
  FileText,
  Pen,
  Trash2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  Download,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { downloadContractPDF } from '../common/ContractDocument';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Party {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhoto?: string;
}

interface Contract {
  _id: string;
  artisanId: Party;
  expertId: Party;
  content: string;
  status: 'draft' | 'pending_expert_signature' | 'pending_artisan_signature' | 'signed' | 'completed';
  signedByExpertAt?: string | null;
  signatureDataExpert?: string | null;
  signedByArtisanAt?: string | null;
  signatureData?: string | null;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:5000';
const API_URL = `${API_BASE}/api`;

const getToken = () => {
  const t = localStorage.getItem('token');
  if (t) return t;
  try { return JSON.parse(localStorage.getItem('user') || '{}').token || ''; }
  catch { return ''; }
};
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// ─── Party Avatar ─────────────────────────────────────────────────────────────

function PartyAvatar({ party }: { party: Party }) {
  const initials = `${party.firstName?.[0] ?? ''}${party.lastName?.[0] ?? ''}`.toUpperCase();
  if (party.profilePhoto) {
    const src = party.profilePhoto.startsWith('http')
      ? party.profilePhoto
      : `${API_BASE}/${party.profilePhoto.replace(/^\/+/, '')}`;
    return (
      <img src={src} alt={initials}
        className="w-9 h-9 rounded-full object-cover ring-2 ring-border flex-shrink-0"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
      {initials || <User size={14} />}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExpertContractSignProps {
  contractId: string;
  onBack: () => void;
  onSigned: () => void;
}

export default function ExpertContractSign({ contractId, onBack, onSigned }: ExpertContractSignProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const sigCanvasRef = useRef<SignatureCanvas>(null);

  const [contract, setContract]         = useState<Contract | null>(null);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState('');
  const [signed, setSigned]             = useState(false);
  const [signedContract, setSignedContract] = useState<Contract | null>(null);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [agreed, setAgreed]             = useState(false);
  const [isEmpty, setIsEmpty]           = useState(true);

  useEffect(() => {
    const fetchContract = async () => {
      setLoading(true);
      setFetchError('');
      try {
        const res = await axios.get(`${API_URL}/contracts/${contractId}`, { headers: authHeaders() });
        setContract(res.data);
        // Already signed by expert
        if (res.data.signedByExpertAt) {
          setSigned(true);
          setSignedContract(res.data);
        }
      } catch (err: any) {
        setFetchError(
          err?.response?.data?.message ||
          tr('Failed to load contract.', 'Impossible de charger le contrat.', 'فشل تحميل العقد.')
        );
      } finally {
        setLoading(false);
      }
    };
    fetchContract();
  }, [contractId]);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSign = async () => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const signatureData = sigCanvasRef.current.toDataURL('image/png');
      const res = await axios.post(
        `${API_URL}/contracts/${contractId}/sign-expert`,
        { signatureData },
        { headers: authHeaders() }
      );
      setSignedContract(res.data);
      setSigned(true);
      setTimeout(() => onSigned(), 2500);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message ||
        tr('An error occurred. Please try again.', 'Une erreur est survenue.', 'حدث خطأ. حاول مجدداً.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground">
        <RefreshCw size={32} className="animate-spin text-primary" />
        <p className="text-sm">{tr('Loading contract…', 'Chargement du contrat…', 'جاري تحميل العقد…')}</p>
      </div>
    );
  }

  // ── Fetch error ──
  if (fetchError) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2 rounded-xl">
          <ArrowLeft size={15} /> {tr('Back', 'Retour', 'رجوع')}
        </Button>
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-5">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{fetchError}</p>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  // ── Already signed by expert ──
  if (signed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {tr('Contract signed!', 'Contrat signé !', 'تم توقيع العقد!')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'Your electronic signature has been recorded. The artisan will be notified to sign.',
              'Votre signature électronique a été enregistrée. L\'artisan sera notifié pour signer.',
              'تم تسجيل توقيعك الإلكتروني. سيتم إخطار الحرفي للتوقيع.'
            )}
          </p>
          {signedContract?.signedByExpertAt && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(signedContract.signedByExpertAt).toLocaleString()}
            </p>
          )}
        </div>
        {signedContract?.signatureDataExpert && (
          <div className="border border-border rounded-xl p-3 bg-white dark:bg-slate-900">
            <img
              src={signedContract.signatureDataExpert}
              alt="signature"
              className="max-h-24 object-contain mx-auto"
            />
          </div>
        )}
        <div className="flex gap-3">
          {signedContract && (
            <Button
              variant="outline"
              onClick={() => downloadContractPDF(signedContract, language)}
              className="rounded-xl flex items-center gap-2"
            >
              <Download size={15} />
              {tr('Download PDF', 'Télécharger PDF', 'تحميل PDF')}
            </Button>
          )}
          <Button onClick={onBack} className="rounded-xl flex items-center gap-2">
            <ArrowLeft size={15} />
            {tr('Back to contracts', 'Retour aux contrats', 'العودة إلى العقود')}
          </Button>
        </div>
      </div>
    );
  }

  // L'expert peut signer s'il n'a pas encore signé, peu importe le statut exact
  // (corrige les anciens contrats créés avec pending_artisan_signature directement)
  const canSign = !contract.signedByExpertAt && (
    contract.status === 'pending_expert_signature' ||
    contract.status === 'pending_artisan_signature'
  );
  const canSubmit = !isEmpty && agreed && !submitting;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack} className="rounded-xl flex items-center gap-2 h-9">
          <ArrowLeft size={15} />
          {tr('Back', 'Retour', 'رجوع')}
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Pen size={20} className="text-primary" />
            {tr('Sign the contract', 'Signer le contrat', 'توقيع العقد')}
          </h1>
          <p className="text-xs text-muted-foreground">
            #{contract._id.slice(-6).toUpperCase()} —{' '}
            {tr('Created on', 'Créé le', 'أُنشئ في')} {new Date(contract.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* ── Your role notice ── */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Pen size={15} className="text-primary" />
        </div>
        <p className="text-sm text-foreground">
          {tr(
            'You are signing this contract as the Expert (first signatory). The artisan will sign after you.',
            'Vous signez ce contrat en tant qu\'Expert (premier signataire). L\'artisan signera après vous.',
            'أنت توقّع هذا العقد بصفتك الخبير (أول موقّع). سيوقّع الحرفي بعدك.'
          )}
        </p>
      </div>

      {/* ── Parties ── */}
      <Card className="p-4 rounded-2xl border border-border">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">
          {tr('Parties', 'Parties', 'الأطراف')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: tr('Artisan', 'Artisan', 'حرفي'), party: contract.artisanId },
            { label: tr('Expert',  'Expert',  'خبير'), party: contract.expertId  },
          ].map(({ label, party }) => (
            <div key={party._id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
              <PartyAvatar party={party} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground">{party.firstName} {party.lastName}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Contract content (collapsible) ── */}
      <Card className="rounded-2xl border border-border overflow-hidden p-0">
        <button
          onClick={() => setContentExpanded(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors text-sm font-semibold text-foreground"
        >
          <span className="flex items-center gap-2">
            <FileText size={15} className="text-primary" />
            {tr('Read the contract', 'Lire le contrat', 'قراءة العقد')}
          </span>
          {contentExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {contentExpanded && (
          <pre className="px-5 pb-5 pt-2 text-sm text-foreground whitespace-pre-wrap break-words font-mono leading-relaxed bg-background max-h-64 overflow-y-auto overflow-x-hidden border-t border-border">
            {contract.content}
          </pre>
        )}
      </Card>

      {!canSign ? (
        <Card className="p-5 rounded-2xl border border-border">
          <div className="flex items-start gap-3">
            <Clock size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {contract.signedByExpertAt
                ? contract.signedByArtisanAt
                  ? tr('This contract has been fully signed by both parties.', 'Ce contrat a été signé par les deux parties.', 'تم توقيع هذا العقد من قبل الطرفين.')
                  : tr('You have already signed. Waiting for the artisan\'s signature.', 'Vous avez déjà signé. En attente de la signature de l\'artisan.', 'لقد وقّعت بالفعل. في انتظار توقيع الحرفي.')
                : tr('This contract cannot be signed at this time.', 'Ce contrat ne peut pas être signé pour l\'instant.', 'لا يمكن توقيع هذا العقد في الوقت الحالي.')}
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* ── Signature pad ── */}
          <Card className="p-5 rounded-2xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {tr('Your signature', 'Votre signature', 'توقيعك')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tr(
                    'Draw your signature with your mouse or finger.',
                    'Dessinez votre signature avec votre souris ou votre doigt.',
                    'ارسم توقيعك بالماوس أو إصبعك.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 size={13} />
                {tr('Clear', 'Effacer', 'مسح')}
              </button>
            </div>

            {/* react-signature-canvas */}
            <div className="rounded-xl border-2 border-dashed border-border overflow-hidden bg-white">
              <SignatureCanvas
                ref={sigCanvasRef}
                penColor="#1e293b"
                backgroundColor="white"
                canvasProps={{
                  style: { width: '100%', height: '180px', display: 'block' },
                }}
                onBegin={() => setIsEmpty(false)}
              />
            </div>

            {isEmpty && (
              <p className="text-xs text-muted-foreground text-center">
                {tr('↑ Draw your signature in the box above', '↑ Dessinez votre signature dans le cadre ci-dessus', '↑ ارسم توقيعك في الإطار أعلاه')}
              </p>
            )}
          </Card>

          {/* ── Agreement checkbox ── */}
          <label className="flex items-start gap-3 cursor-pointer p-4 rounded-2xl border border-border hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary flex-shrink-0"
            />
            <p className="text-sm text-foreground">
              {tr(
                'I have read and understood the contract and I agree to sign it electronically as the expert. I acknowledge that this electronic signature has the same legal value as a handwritten signature.',
                'J\'ai lu et compris le contrat et j\'accepte de le signer électroniquement en tant qu\'expert. Je reconnais que cette signature électronique a la même valeur légale qu\'une signature manuscrite.',
                'لقد قرأت وفهمت العقد وأوافق على توقيعه إلكترونياً بصفتي خبيراً. أُقرّ بأن هذا التوقيع الإلكتروني له نفس القيمة القانونية للتوقيع بخط اليد.'
              )}
            </p>
          </label>

          {/* ── Error ── */}
          {submitError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          {/* ── Submit ── */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onBack} className="rounded-xl" disabled={submitting}>
              {tr('Cancel', 'Annuler', 'إلغاء')}
            </Button>
            <Button
              onClick={handleSign}
              disabled={!canSubmit}
              className="rounded-xl text-white bg-primary hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 px-6"
            >
              {submitting ? (
                <><RefreshCw size={15} className="animate-spin" /> {tr('Signing…', 'Signature…', 'جاري التوقيع…')}</>
              ) : (
                <><Pen size={15} /> {tr('Sign the contract', 'Signer le contrat', 'توقيع العقد')}</>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
