import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Handshake,
  MapPin,
  Calendar,
  Banknote,
  User,
  AlertCircle,
  RefreshCw,
  FileText,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
  MessageCircle,
  TrendingUp,
  Clock,
  Eye,
  CircleDot,
  Circle,
  ListTodo,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Artisan {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhoto?: string;
  domain?: string;
  location?: string;
}

interface ContractRef {
  _id: string;
  status: 'draft' | 'pending_artisan_signature' | 'signed' | 'completed';
  signedByArtisanAt?: string | null;
  signatureData?: string | null;
}

interface Task {
  _id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
}

interface CollaborativeProject {
  _id: string;
  title: string;
  description: string;
  location: string;
  budget: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'pending' | 'completed';
  progress: number;
  tasks?: Task[];
  artisan: Artisan;
  contractId?: ContractRef | null;
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
const getCurrentUserId = (): string => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return u._id || u.id || '';
  } catch { return ''; }
};
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  pending:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

function ArtisanAvatar({ artisan }: { artisan: Artisan }) {
  const initials = `${artisan.firstName?.[0] ?? ''}${artisan.lastName?.[0] ?? ''}`.toUpperCase();
  if (artisan.profilePhoto) {
    const src = artisan.profilePhoto.startsWith('http')
      ? artisan.profilePhoto
      : `${API_BASE}/${artisan.profilePhoto.replace(/^\/+/, '')}`;
    return (
      <img src={src} alt={initials}
        className="w-10 h-10 rounded-full object-cover ring-2 ring-border flex-shrink-0"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
      {initials || <User size={16} />}
    </div>
  );
}

// ─── Contract Modal (read-only) ───────────────────────────────────────────────

interface ContractFullData {
  _id: string;
  content: string;
  status: string;
  signedByArtisanAt?: string | null;
  signatureData?: string | null;
}

function ContractModal({
  contractId,
  onClose,
  tr,
}: {
  contractId: string;
  onClose: () => void;
  tr: (en: string, fr: string, ar?: string) => string;
}) {
  const [contract, setContract] = useState<ContractFullData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/contracts/${contractId}`, { headers: authHeaders() })
      .then(r => setContract(r.data))
      .catch(e => setError(e?.response?.data?.message || tr('Failed to load.', 'Impossible de charger.', 'فشل التحميل.')))
      .finally(() => setLoading(false));
  }, [contractId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border flex flex-col"
        style={{ maxHeight: 'min(90vh,100%)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            {tr('Signed contract', 'Contrat signé', 'العقد الموقع')} #{contractId.slice(-6).toUpperCase()}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <RefreshCw size={24} className="animate-spin text-primary" />
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {contract && (
            <>
              {contract.status === 'signed' && contract.signedByArtisanAt && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                      {tr('Signed by the artisan', 'Signé par l\'artisan', 'وقّعه الحرفي')}
                    </p>
                    <p className="text-xs text-green-600">{new Date(contract.signedByArtisanAt).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {contract.signatureData && (
                <div className="border border-border rounded-xl p-3 bg-white dark:bg-slate-900 inline-block">
                  <p className="text-xs text-muted-foreground mb-2">
                    {tr('Artisan\'s signature', 'Signature de l\'artisan', 'توقيع الحرفي')}
                  </p>
                  <img src={contract.signatureData} alt="signature" className="max-h-20 object-contain" />
                </div>
              )}

              <div className="rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 text-sm font-medium text-foreground transition-colors">
                  <span className="flex items-center gap-2"><FileText size={14} />{tr('Contract content', 'Contenu du contrat', 'محتوى العقد')}</span>
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expanded && (
                  <pre className="p-4 text-sm text-foreground whitespace-pre-wrap break-words font-mono leading-relaxed bg-background overflow-x-hidden w-full">
                    {contract.content}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            {tr('Close', 'Fermer', 'إغلاق')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Details Modal (read-only) ───────────────────────────────────────

function ProjectDetailsModal({
  project,
  onClose,
  tr,
}: {
  project: CollaborativeProject;
  onClose: () => void;
  tr: (en: string, fr: string, ar?: string) => string;
}) {
  const tasks  = project.tasks ?? [];
  const todo   = tasks.filter(t => t.status === 'todo');
  const inProg = tasks.filter(t => t.status === 'in_progress');
  const done   = tasks.filter(t => t.status === 'done');
  const prog   = Math.min(100, Math.max(0, project.progress || 0));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-xl border border-border flex flex-col"
        style={{ maxHeight: 'min(92vh, 720px)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border flex-shrink-0 gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground leading-snug line-clamp-2">
              {project.title}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {project.artisan.firstName} {project.artisan.lastName}
              {project.artisan.domain && ` · ${project.artisan.domain}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">

          {/* Description */}
          {project.description && (
            <p className="text-sm text-foreground leading-relaxed">{project.description}</p>
          )}

          {/* Progress */}
          <div className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp size={14} className="text-primary" />
                {tr('Progress', 'Avancement', 'التقدم')}
              </span>
              <span className="text-2xl font-bold text-primary">{prog}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${prog}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {done.length} / {tasks.length} {tr('tasks completed', 'tâches terminées', 'مهام منجزة')}
            </p>
          </div>

          {/* Tasks */}
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <ListTodo size={28} />
              <p className="text-sm">{tr('No tasks yet', 'Aucune tâche pour le moment', 'لا توجد مهام بعد')}</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* In Progress */}
              {inProg.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <CircleDot size={12} className="text-blue-600" />
                    {tr('In Progress', 'En cours', 'قيد التنفيذ')} ({inProg.length})
                  </p>
                  <div className="space-y-1.5">
                    {inProg.map(t => (
                      <div key={t._id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-800">
                        <CircleDot size={14} className="text-blue-600 flex-shrink-0" />
                        <span className="text-sm text-foreground">{t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* To Do */}
              {todo.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Circle size={12} />
                    {tr('To Do', 'À faire', 'المهام المعلقة')} ({todo.length})
                  </p>
                  <div className="space-y-1.5">
                    {todo.map(t => (
                      <div key={t._id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/40 border border-border">
                        <Circle size={14} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-foreground">{t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Done */}
              {done.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <CheckCircle size={12} className="text-green-600" />
                    {tr('Done', 'Terminées', 'المنجزة')} ({done.length})
                  </p>
                  <div className="space-y-1.5">
                    {done.map(t => (
                      <div key={t._id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-green-50 border border-green-100 dark:bg-green-950/20 dark:border-green-800">
                        <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
                        <span className="text-sm text-foreground line-through opacity-60">{t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            {tr('Close', 'Fermer', 'إغلاق')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  tr,
  onViewContract,
  onMessage,
  onViewProject,
}: {
  project: CollaborativeProject;
  tr: (en: string, fr: string, ar?: string) => string;
  onViewContract: (contractId: string) => void;
  onMessage: (artisanId: string) => void;
  onViewProject: (p: CollaborativeProject) => void;
}) {
  const st = project.status || 'active';
  const prog = Math.min(100, Math.max(0, project.progress || 0));

  return (
    <Card className="p-5 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2 flex-1">
          {project.title}
        </h3>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_STYLES[st as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.active}`}>
          {st === 'active'    ? tr('Active',    'Actif',    'نشط')
         : st === 'completed' ? tr('Completed', 'Terminé',  'مكتمل')
         :                      tr('Pending',   'En cours', 'قيد الانتظار')}
        </span>
      </div>

      {/* Artisan */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 mb-3">
        <ArtisanAvatar artisan={project.artisan} />
        <div>
          <p className="text-xs text-muted-foreground">{tr('Artisan', 'Artisan', 'حرفي')}</p>
          <p className="text-sm font-semibold text-foreground">
            {project.artisan.firstName} {project.artisan.lastName}
          </p>
          {project.artisan.domain && (
            <p className="text-xs text-muted-foreground">{project.artisan.domain}</p>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
        <div className="flex items-center gap-1.5">
          <Banknote size={12} className="text-green-600 flex-shrink-0" />
          <span className="font-semibold text-green-600">{project.budget.toLocaleString()} TND</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-blue-500 flex-shrink-0" />
          <span>{new Date(project.startDate).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1.5 col-span-2">
          <MapPin size={12} className="text-primary flex-shrink-0" />
          <span className="truncate">{project.location}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp size={11} /> {tr('Progress', 'Avancement', 'التقدم')}
          </span>
          <span className="text-xs font-bold text-primary">{prog}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${prog}%` }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        <Button
          onClick={() => onViewProject(project)}
          className="flex-1 min-w-[110px] h-9 text-sm rounded-xl text-white bg-primary hover:bg-primary/90 flex items-center justify-center gap-1.5"
        >
          <Eye size={14} />
          {tr('View Project', 'Voir le projet', 'عرض المشروع')}
        </Button>
        {project.contractId && (
          <Button
            onClick={() => onViewContract(project.contractId!._id)}
            variant="outline"
            className="h-9 px-3 text-sm rounded-xl border-primary/30 text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5"
            title={tr('View contract', 'Voir le contrat', 'عرض العقد')}
          >
            <FileText size={14} />
            {project.contractId.status === 'signed' && (
              <CheckCircle size={12} className="text-green-500" />
            )}
          </Button>
        )}
        <Button
          onClick={() => onMessage(project.artisan._id)}
          variant="outline"
          className="h-9 px-3 text-sm rounded-xl flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          title={tr('Message', 'Message', 'رسالة')}
        >
          <MessageCircle size={14} />
        </Button>
      </div>

      {/* Created date */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
        <Clock size={11} />
        <span>{tr('Started on', 'Démarré le', 'بدأ في')} {new Date(project.createdAt).toLocaleDateString()}</span>
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExpertCollaborativeProjectsProps {
  onNavigate?: (view: string) => void;
}

export default function ExpertCollaborativeProjects({ onNavigate }: ExpertCollaborativeProjectsProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    language === 'ar' ? ar : language === 'fr' ? fr : en;

  const [projects, setProjects]             = useState<CollaborativeProject[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [viewingContractId, setViewingContractId]   = useState<string | null>(null);
  const [viewingProject, setViewingProject]         = useState<CollaborativeProject | null>(null);

  const expertId = getCurrentUserId();

  const fetchProjects = async () => {
    if (!expertId) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/projects/expert/${expertId}`, { headers: authHeaders() });
      // Garde defensive : si l'API renvoie autre chose qu'un tableau (typiquement
      // l'index.html du SPA quand VITE_API_URL est mal configuree), l'operation de
      // tableau plus bas ferait planter le rendu React (ecran blanc).
      setProjects(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        tr('Failed to load projects.', 'Impossible de charger les projets.', 'فشل تحميل المشاريع.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, [expertId]);

  const handleMessage = async (artisanId: string) => {
    try {
      const res = await axios.post(
        `${API_URL}/conversations`,
        { participantId: artisanId },
        { headers: authHeaders() }
      );
      const convId = res.data._id || res.data.id;
      localStorage.setItem('selectedConversationId', convId);
    } catch { /* ignore */ }
    onNavigate?.('messages');
  };

  return (
    <div className="space-y-6">
      {/* ── Title ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Handshake size={24} className="text-primary" />
            {tr('Collaborative Projects', 'Projets collaboratifs', 'المشاريع التعاونية')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr(
              'Projects started with artisans after contract signature. Read-only view.',
              'Projets lancés avec des artisans après signature du contrat. Vue en lecture seule.',
              'مشاريع بدأت مع الحرفيين بعد توقيع العقد. عرض للقراءة فقط.'
            )}
          </p>
        </div>
        <Button onClick={fetchProjects} variant="outline" className="rounded-xl flex items-center gap-2" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {tr('Refresh', 'Actualiser', 'تحديث')}
        </Button>
      </div>

      {/* ── Stats ── */}
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {(['active', 'pending', 'completed'] as const).map(s => {
            const count = projects.filter(p => (p.status || 'active') === s).length;
            if (!count) return null;
            return (
              <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_STYLES[s]}`}>
                <span>{count}</span>
                <span>{s === 'active' ? tr('active', 'actif(s)', 'نشط') : s === 'completed' ? tr('completed', 'terminé(s)', 'مكتمل') : tr('pending', 'en cours', 'قيد الانتظار')}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <RefreshCw size={32} className="animate-spin text-primary" />
          <p className="text-sm">{tr('Loading projects…', 'Chargement des projets…', 'جاري تحميل المشاريع…')}</p>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-5">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchProjects} variant="outline" className="mt-3 h-8 text-xs rounded-lg border-red-300 text-red-600">
              {tr('Retry', 'Réessayer', 'إعادة المحاولة')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Handshake size={32} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {tr('No collaborative projects yet', 'Aucun projet collaboratif', 'لا توجد مشاريع تعاونية بعد')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {tr(
                'Projects appear here after an artisan signs the contract for your proposal.',
                'Les projets apparaissent ici après qu\'un artisan signe le contrat pour votre demande.',
                'تظهر المشاريع هنا بعد توقيع الحرفي على العقد الخاص بطلبك.'
              )}
            </p>
            <Button onClick={() => onNavigate?.('proposals')} className="mt-4 rounded-xl">
              {tr('View my proposals', 'Voir mes propositions', 'عرض مقترحاتي')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      {!loading && !error && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {projects.map(p => (
            <ProjectCard
              key={p._id}
              project={p}
              tr={tr}
              onViewContract={setViewingContractId}
              onMessage={handleMessage}
              onViewProject={setViewingProject}
            />
          ))}
        </div>
      )}

      {/* ── Contract modal ── */}
      {viewingContractId && (
        <ContractModal
          contractId={viewingContractId}
          onClose={() => setViewingContractId(null)}
          tr={tr}
        />
      )}

      {/* ── Project details modal (read-only) ── */}
      {viewingProject && (
        <ProjectDetailsModal
          project={viewingProject}
          onClose={() => setViewingProject(null)}
          tr={tr}
        />
      )}
    </div>
  );
}
