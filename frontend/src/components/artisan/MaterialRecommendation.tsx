/**
 * MaterialRecommendation v4 — BMP.tn
 * ─────────────────────────────────────
 * Wizard de recommandation IA basé sur la surface/volume/longueur.
 *
 * Formulaire :
 *   Requis   : catégorie, surface (valeur + unité), budget (TND)
 *   Option   : marge de sécurité +10 % (cochée par défaut), note min, contrainte
 *
 * Scoring affiché :
 *   Compat. surface 25 pts · Budget 25 pts · Contrainte 20 pts
 *   Fiabilité 15 pts · PDF 15 pts = 100 pts
 *
 * Chaque carte produit affiche sa propre formule de conversion
 * (facteur issu de conversionFactors.js côté serveur).
 */

import { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Sparkles, ArrowLeft, Loader2, Plus,
  ChevronDown, ChevronUp, FileText, AlertTriangle, Star,
  Package, Clock, Banknote, ShieldCheck, Layers,
  Settings2, Info, SlidersHorizontal, Ruler, AlertCircle,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

// ── Données de configuration (miroir de conversionService.js) ─────────────────

const CATEGORIES = [
  'Béton', 'Carrelage', 'Couverture', 'EPI', 'Électricité',
  'Ferraillage', 'Isolation', 'Maçonnerie', 'Menuiserie',
  'Outillage', 'Peinture', 'Plomberie',
];

const INPUT_UNITS = ['m²', 'm³', 'm', 'pièce'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Scores {
  total: number;
  compatibilite: number;
  budget: number;
  contrainte: number;
  fiabilite: number;
  pdf: number;
}

interface ConversionInfo {
  factor: number;
  matchedKey: string | null;
  quantity: number;
  outputUnit: string;
  formula: string;
  note: string;
  isNonStandard: boolean;
  warning: string | null;
}

interface RefConversion {
  surface: number;
  unit: string;
  category: string;
  applyMargin: boolean;
  margeSecurite?: boolean;
  calculatedQuantity: number;
  formula: string;
  conversionLabel: string;
}

interface ExplainableAI {
  justification: string;
  pdfBadges: string[];
  withinBudget: boolean;
  stockSufficient: boolean;
}

interface PricingSummary {
  unitPrice: number; quantity: number; estimatedCost: number; currency: string; withinBudget: boolean | null;
}

interface StockSummary {
  available: number; needed: number; sufficient: boolean; estimatedDeliveryDays: number;
}

interface PdfInsights {
  hasTechSheet: boolean; analysisSuccess: boolean; confidence: number; profile: any; error: string | null;
}

interface Recommendation {
  productId: string;
  productName: string;
  category: string;
  totalPrice: number;
  unitPrice: number;
  image: string;
  rating: number;
  numReviews: number;
  stock: number;
  techSheetUrl?: string;
  conversionInfo: ConversionInfo;
  scores: Scores;
  explainableAI: ExplainableAI;
  pdfInsights: PdfInsights;
  pricingSummary: PricingSummary;
  stockSummary: StockSummary;
}

interface Props {
  project: { _id: string; title: string; materials?: any[] };
  onBack: () => void;
  onAddToProject: (productId: string) => Promise<void>;
}

// ── Scoring criteria config ───────────────────────────────────────────────────

const CRITERIA = [
  { key: 'compatibilite', label: 'Compat. surface',  maxPts: 25, color: '#1F3A8A', icon: <Layers    size={14} /> },
  { key: 'budget',        label: 'Budget',            maxPts: 25, color: '#16a34a', icon: <Banknote  size={14} /> },
  { key: 'contrainte',    label: 'Contrainte tech.',  maxPts: 20, color: '#7c3aed', icon: <Settings2 size={14} /> },
  { key: 'fiabilite',     label: 'Fiabilité & avis',  maxPts: 15, color: '#d97706', icon: <Star      size={14} /> },
  { key: 'pdf',           label: 'Fiche PDF',         maxPts: 15, color: '#0891b2', icon: <FileText  size={14} /> },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const getToken = () => {
  const d = localStorage.getItem('token');
  if (d) return d;
  try { return JSON.parse(localStorage.getItem('user') || '{}').token; } catch { return null; }
};

const scoreColor = (pts: number, maxPts: number) => {
  const r = pts / maxPts;
  return r >= 0.75 ? '#16a34a' : r >= 0.45 ? '#d97706' : '#dc2626';
};

// ── ScoreBar ──────────────────────────────────────────────────────────────────

function ScoreBar({ pts, maxPts, color, height = 6 }: { pts: number; maxPts: number; color: string; height?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, backgroundColor: '#e2e8f0' }}>
      <div
        className="rounded-full transition-all duration-700"
        style={{ width: `${Math.round((pts / maxPts) * 100)}%`, height, backgroundColor: color }}
      />
    </div>
  );
}

// ── StarSelector ─────────────────────────────────────────────────────────────

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(value === s ? 0 : s)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={22}
            fill={(hover || value) >= s ? '#f59e0b' : 'none'}
            stroke={(hover || value) >= s ? '#f59e0b' : '#94a3b8'}
            strokeWidth={1.5}
          />
        </button>
      ))}
      {value > 0 && (
        <button type="button" onClick={() => onChange(0)} className="ml-1 text-xs text-muted-foreground hover:text-foreground underline">
          Effacer
        </button>
      )}
    </div>
  );
}

// ── ScoringLegend ─────────────────────────────────────────────────────────────

function ScoringLegend() {
  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', border: '1px solid #e2e8f0' }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#1F3A8A,#3b82f6)' }}>
          <ShieldCheck size={14} />
        </div>
        <p className="text-sm font-bold text-foreground">Comment le système note les produits</p>
        <Info size={13} className="ml-auto text-muted-foreground" />
      </div>

      <div className="space-y-2.5">
        {CRITERIA.map((c) => (
          <div key={c.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span style={{ color: c.color }}>{c.icon}</span>
                <span className="text-xs font-semibold text-foreground">{c.label}</span>
              </div>
              <span className="text-xs font-black" style={{ color: c.color }}>+{c.maxPts} pts</span>
            </div>
            <div className="w-full rounded-full" style={{ height: 7, backgroundColor: '#e2e8f0' }}>
              <div className="rounded-full" style={{ width: `${c.maxPts}%`, height: 7, backgroundColor: c.color, opacity: 0.8 }} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
        La quantité est calculée automatiquement à partir de la surface, par type de produit.
        Les produits hors stock ou hors catégorie sont exclus avant le scoring.
      </p>
    </div>
  );
}

// ── ProductConversionTag ──────────────────────────────────────────────────────

function ProductConversionTag({ info }: { info: ConversionInfo }) {
  return (
    <div className="mx-4 mb-3 space-y-1">
      <div
        className="rounded-xl px-3 py-2 flex flex-wrap items-center gap-2"
        style={{
          backgroundColor: info.isNonStandard ? '#fefce8' : '#f0fdf4',
          border:          `1px solid ${info.isNonStandard ? '#fde68a' : '#bbf7d0'}`,
        }}
      >
        <Ruler size={12} style={{ color: info.isNonStandard ? '#ca8a04' : '#16a34a', flexShrink: 0 }} />
        <span className="text-[11px] font-mono text-foreground flex-1 min-w-0 truncate">{info.formula}</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
          style={{ backgroundColor: info.isNonStandard ? '#ca8a04' : '#16a34a' }}
        >
          {info.quantity} {info.outputUnit}
        </span>
      </div>

      {/* Avertissement produit non standard */}
      {info.isNonStandard && info.warning && (
        <div className="flex items-start gap-1.5 px-1">
          <AlertCircle size={11} style={{ color: '#ca8a04', marginTop: 1, flexShrink: 0 }} />
          <p className="text-[10px]" style={{ color: '#92400e' }}>{info.warning}</p>
        </div>
      )}

      {/* Note du facteur (si produit standard) */}
      {!info.isNonStandard && info.note && (
        <p className="text-[10px] text-muted-foreground px-1">{info.note}</p>
      )}
    </div>
  );
}

// ── RecoCard ──────────────────────────────────────────────────────────────────

function RecoCard({
  rec, idx, adding, onAdd,
}: { rec: Recommendation; idx: number; adding: boolean; onAdd: () => void }) {
  const [expanded, setExpanded] = useState(idx === 0);
  const total     = rec.scores.total;
  const rankColor = idx === 0 ? '#1F3A8A' : idx === 1 ? '#475569' : '#94a3b8';
  const medalEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
  const ringColor  = total >= 75 ? '#16a34a' : total >= 50 ? '#d97706' : '#dc2626';

  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-sm bg-card">
      {/* Top stripe */}
      <div className="h-1" style={{ background: `linear-gradient(to right, ${ringColor}, ${ringColor}66)` }} />

      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Rank */}
        <div
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white shrink-0 mt-0.5"
          style={{ backgroundColor: rankColor }}
        >
          {medalEmoji
            ? <span className="text-base leading-none">{medalEmoji}</span>
            : <span className="text-sm font-black">#{idx + 1}</span>
          }
        </div>

        {/* Image + info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <img
            src={rec.image || 'https://placehold.co/60x60?text=img'}
            alt={rec.productName}
            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-border"
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm leading-tight line-clamp-1">{rec.productName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">{rec.category}</span>
              {rec.conversionInfo.isNonStandard && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: '#ca8a04' }}>
                  <AlertCircle size={8} /> Estimation
                </span>
              )}
              {rec.pdfInsights.hasTechSheet && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white"
                  style={{ backgroundColor: rec.pdfInsights.analysisSuccess ? '#0891b2' : '#94a3b8' }}
                >
                  <FileText size={8} />
                  {rec.pdfInsights.analysisSuccess ? 'PDF analysé' : 'PDF non analysé'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-sm font-bold text-foreground">{rec.unitPrice} TND/{rec.conversionInfo.outputUnit}</span>
              <span className="text-xs text-muted-foreground">
                × {rec.conversionInfo.quantity} = <strong>{rec.totalPrice} TND</strong>
              </span>
              {rec.explainableAI.withinBudget
                ? <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>✓ Dans le budget</span>
                : <span className="text-xs font-semibold" style={{ color: '#d97706' }}>⚠ Hors budget</span>
              }
            </div>
          </div>
        </div>

        {/* Score ring */}
        <div
          className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2"
          style={{ borderColor: ringColor }}
        >
          <span className="text-xl font-black leading-none" style={{ color: ringColor }}>{total}</span>
          <span className="text-[9px] text-muted-foreground font-medium">/100</span>
        </div>
      </div>

      {/* Per-product conversion formula */}
      <ProductConversionTag info={rec.conversionInfo} />

      {/* Justification IA */}
      <div className="mx-4 mb-3 px-3 py-2 rounded-xl text-xs leading-relaxed" style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}>
        <span className="font-semibold">IA : </span>{rec.explainableAI.justification}
      </div>

      {/* PDF badges */}
      {rec.explainableAI.pdfBadges?.length > 0 && (
        <div className="px-4 mb-3 flex flex-wrap gap-1.5">
          {rec.explainableAI.pdfBadges.slice(0, 6).map((badge, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: '#0891b2' }}
            >
              <ShieldCheck size={9} />{badge}
            </span>
          ))}
        </div>
      )}

      {/* Mini score bars (5 critères) */}
      <div className="px-4 pb-3 grid grid-cols-5 gap-1.5">
        {CRITERIA.map((c) => {
          const pts = rec.scores[c.key as keyof Scores] as number;
          return (
            <div key={c.key} className="space-y-1">
              <ScoreBar pts={pts} maxPts={c.maxPts} color={scoreColor(pts, c.maxPts)} height={6} />
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground truncate">{c.label.split(' ')[0]}</span>
                <span className="text-[9px] font-bold" style={{ color: scoreColor(pts, c.maxPts) }}>{pts}/{c.maxPts}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors border-t border-border"
      >
        <span>{expanded ? 'Masquer les détails' : 'Voir détails complets'}</span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Score breakdown */}
          <div className="space-y-2 mt-2">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Détail des scores</p>
            {CRITERIA.map((c) => {
              const pts   = rec.scores[c.key as keyof Scores] as number;
              const color = scoreColor(pts, c.maxPts);
              return (
                <div key={c.key} className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 w-36 shrink-0">
                    <span style={{ color: c.color }}>{c.icon}</span>
                    <span className="text-xs text-muted-foreground">{c.label}</span>
                  </div>
                  <div className="flex-1">
                    <ScoreBar pts={pts} maxPts={c.maxPts} color={color} height={7} />
                  </div>
                  <span className="text-xs font-black w-12 text-right" style={{ color }}>
                    {pts} / {c.maxPts}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Conversion detail */}
          <div className="rounded-xl p-3" style={{ backgroundColor: rec.conversionInfo.isNonStandard ? '#fefce8' : '#f0fdf4', border: `1px solid ${rec.conversionInfo.isNonStandard ? '#fde68a' : '#bbf7d0'}` }}>
            <p className="text-[11px] font-bold mb-1" style={{ color: rec.conversionInfo.isNonStandard ? '#92400e' : '#15803d' }}>
              Facteur de conversion : {rec.conversionInfo.matchedKey || 'Non défini (estimation)'}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground">{rec.conversionInfo.formula}</p>
          </div>

          {/* Stock + livraison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                <Package size={12} /> Stock disponible
              </div>
              <p className="font-bold text-sm">{rec.stockSummary.available} / {rec.stockSummary.needed} u.</p>
              <p className="text-xs mt-0.5" style={{ color: rec.stockSummary.sufficient ? '#16a34a' : '#d97706' }}>
                {rec.stockSummary.sufficient ? '✓ Stock suffisant' : '⚠ Stock partiel'}
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                <Clock size={12} /> Livraison estimée
              </div>
              <p className="font-bold text-sm">~{rec.stockSummary.estimatedDeliveryDays} jour{rec.stockSummary.estimatedDeliveryDays !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* PDF insights */}
          <div className="rounded-xl p-3" style={{ border: '1px solid #e2e8f0', backgroundColor: rec.pdfInsights.hasTechSheet ? '#f0f9ff' : '#f8fafc' }}>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} style={{ color: rec.pdfInsights.hasTechSheet ? '#0891b2' : '#94a3b8' }} />
              <p className="text-xs font-semibold">
                Fiche technique — {rec.pdfInsights.hasTechSheet ? 'disponible' : 'non disponible'}
              </p>
              {rec.pdfInsights.hasTechSheet && rec.pdfInsights.analysisSuccess && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Confiance : {Math.round(rec.pdfInsights.confidence * 100)}%
                </span>
              )}
            </div>
            {rec.pdfInsights.hasTechSheet && rec.pdfInsights.analysisSuccess && rec.pdfInsights.profile && (
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {(['norms', 'certifications', 'safety', 'resistance', 'environment', 'materials'] as const).map((k) => {
                  const items: string[] = rec.pdfInsights.profile?.[k] || [];
                  if (!items.length) return null;
                  return (
                    <div key={k}>
                      <span className="font-semibold text-foreground capitalize">{k} : </span>
                      <span className="text-muted-foreground">{items.slice(0, 3).join(', ')}{items.length > 3 ? '…' : ''}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {rec.pdfInsights.hasTechSheet && !rec.pdfInsights.analysisSuccess && (
              <p className="text-xs flex items-center gap-1" style={{ color: '#d97706' }}>
                <AlertTriangle size={11} /> {rec.pdfInsights.error || 'Analyse échouée'}
              </p>
            )}
            {!rec.pdfInsights.hasTechSheet && (
              <p className="text-xs text-muted-foreground">Aucune fiche technique PDF pour ce produit.</p>
            )}
          </div>

          {/* Notes + lien PDF */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={13} fill={rec.rating >= s ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth={1.5} />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{rec.rating?.toFixed(1)} ({rec.numReviews} avis)</span>
            {rec.techSheetUrl && (
              <a
                href={rec.techSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto flex items-center gap-1 text-xs hover:underline"
                style={{ color: '#0891b2' }}
              >
                <FileText size={11} /> Voir fiche PDF
              </a>
            )}
          </div>
        </div>
      )}

      {/* Add button */}
      <div className="px-4 pb-4">
        <button
          type="button"
          disabled={adding}
          onClick={onAdd}
          className="w-full rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all"
          style={{
            height: 44,
            background: adding ? '#6b7280' : 'linear-gradient(135deg, #1F3A8A, #2563eb)',
            opacity: adding ? 0.7 : 1,
            cursor: adding ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => { if (!adding) e.currentTarget.style.background = 'linear-gradient(135deg,#172c6e,#1d4ed8)'; }}
          onMouseLeave={(e) => { if (!adding) e.currentTarget.style.background = 'linear-gradient(135deg,#1F3A8A,#2563eb)'; }}
        >
          {adding
            ? <><Loader2 size={16} className="animate-spin" /> Ajout en cours…</>
            : <><Plus size={16} /> Ajouter au projet</>
          }
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MaterialRecommendation({ project, onBack, onAddToProject }: Props) {
  const [form, setForm] = useState({
    surface: '', unit: 'm²', category: '', budget: '',
    applyMargin: true, minRating: 0, constraint: '',
  });
  const [showOptional, setShowOptional] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [results,      setResults]      = useState<Recommendation[] | null>(null);
  const [refConv,      setRefConv]      = useState<RefConversion | null>(null);
  const [noResultMsg,  setNoResultMsg]  = useState<string | null>(null);
  const [addingId,     setAddingId]     = useState<string | null>(null);

  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const availableUnits = INPUT_UNITS;

  const handleCategoryChange = (cat: string) => {
    setForm((f) => ({ ...f, category: cat }));
  };

  const handleSearch = async () => {
    if (!form.surface  || +form.surface <= 0)  return toast.error('Veuillez entrer une surface valide.');
    if (!form.category)                         return toast.error('Veuillez sélectionner une catégorie.');
    if (!form.budget   || +form.budget <= 0)   return toast.error('Veuillez entrer un budget valide.');

    setLoading(true);
    setResults(null);
    setRefConv(null);
    setNoResultMsg(null);

    try {
      const { data } = await axios.post(
        `${API}/projects/${project._id}/material-recommendations`,
        {
          surface:     Number(form.surface),
          unit:        form.unit,
          category:    form.category,
          budget:      Number(form.budget),
          margeSecurite: form.applyMargin,
          applyMargin: form.applyMargin,
          minRating:   form.minRating > 0 ? form.minRating : undefined,
          constraint:  form.constraint.trim() || undefined,
          maxResults:  5,
        },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      setRefConv(data.refConversion || null);
      setResults(data.recommendations || []);
      if (!data.recommendations?.length) {
        setNoResultMsg(data.meta?.message || 'Aucun produit éligible. Essayez d\'élargir vos critères.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du chargement des recommandations.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (rec: Recommendation) => {
    setAddingId(rec.productId);
    try {
      await onAddToProject(rec.productId);
      setResults((prev) => prev?.filter((r) => r.productId !== rec.productId) ?? null);
      toast.success(`${rec.productName} ajouté au projet !`);
    } catch {
      toast.error('Erreur lors de l\'ajout du produit.');
    } finally {
      setAddingId(null);
    }
  };

  const optionalActiveCount = [form.minRating > 0, form.constraint].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-background overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 shrink-0 border-b border-border bg-card" style={{ height: 64 }}>
        <button
          type="button" onClick={onBack}
          className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1F3A8A,#3b82f6)' }}>
            <Sparkles size={17} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground leading-tight">Recommandations intelligentes</p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{project.title}</p>
          </div>
        </div>
        {results !== null && (
          <button
            type="button"
            onClick={() => { setResults(null); setRefConv(null); setNoResultMsg(null); }}
            className="ml-auto text-sm font-semibold hover:underline"
            style={{ color: '#1F3A8A' }}
          >
            ← Nouvelle recherche
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── FORM ──────────────────────────────────────────────────────────── */}
        {results === null && (
          <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

            {/* Hero */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg,#1F3A8A18,#3b82f618)' }}>
                <Sparkles size={30} style={{ color: '#1F3A8A' }} />
              </div>
              <h2 className="text-2xl font-black text-foreground">Entrez vos mesures</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Renseignez votre surface, catégorie et budget. La quantité à commander est calculée automatiquement selon le type de produit.
              </p>
            </div>

            {/* Required fields */}
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', border: '1px solid #e2e8f0' }}
            >
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Champs requis</p>

              {/* Catégorie */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers size={12} style={{ color: '#1F3A8A' }} /> Catégorie de matériau *
                </Label>
                <select
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background text-sm px-3 h-11"
                  style={{ outline: 'none' }}
                >
                  <option value="">— Sélectionner une catégorie —</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Surface + Unité */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Ruler size={12} style={{ color: '#7c3aed' }} />
                    Surface *
                  </Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="ex: 25"
                    value={form.surface}
                    onChange={(e) => setForm((f) => ({ ...f, surface: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Unité *</Label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background text-sm px-3 h-11"
                    style={{ outline: 'none' }}
                  >
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Budget */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Banknote size={12} style={{ color: '#16a34a' }} /> Budget total (TND) *
                </Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="ex: 5000"
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Marge de sécurité */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={form.applyMargin}
                    onChange={(e) => setForm((f) => ({ ...f, applyMargin: e.target.checked }))}
                    className="sr-only"
                  />
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center border-2 transition-all"
                    style={{
                      backgroundColor: form.applyMargin ? '#1F3A8A' : 'transparent',
                      borderColor:     form.applyMargin ? '#1F3A8A' : '#cbd5e1',
                    }}
                  >
                    {form.applyMargin && (
                      <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                        <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground group-hover:text-foreground/80 transition-colors">
                    Appliquer marge de sécurité (+10 %)
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Recommandé — ajoute 10 % à la quantité calculée pour compenser les pertes et imprévus.
                  </p>
                </div>
              </label>
            </div>

            {/* Optional fields toggle */}
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="w-full flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/50 border border-border bg-card"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} style={{ color: '#1F3A8A' }} />
                <span>Filtres avancés</span>
                {optionalActiveCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-white"
                    style={{ backgroundColor: '#1F3A8A' }}
                  >
                    {optionalActiveCount}
                  </span>
                )}
              </div>
              {showOptional ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showOptional && (
              <div
                className="rounded-2xl p-5 space-y-4"
                style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', border: '1px solid #e2e8f0' }}
              >
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filtres optionnels</p>

                {/* Note minimale */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Star size={12} style={{ color: '#f59e0b' }} /> Note minimale du produit
                  </Label>
                  <StarSelector value={form.minRating} onChange={(v) => setForm((f) => ({ ...f, minRating: v }))} />
                </div>

                {/* Contrainte technique */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Settings2 size={12} style={{ color: '#7c3aed' }} /> Contrainte technique
                  </Label>
                  <Input
                    type="text"
                    placeholder="ex: résistance gel, CE, NF EN 1338…"
                    value={form.constraint}
                    onChange={(e) => setForm((f) => ({ ...f, constraint: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Le moteur vérifiera la fiche PDF de chaque produit pour cette contrainte.
                  </p>
                </div>
              </div>
            )}

            {/* Scoring legend */}
            <ScoringLegend />

            {/* Submit */}
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="w-full rounded-2xl font-bold text-white flex items-center justify-center gap-2.5 transition-all"
              style={{
                height: 52,
                background: loading ? '#6b7280' : 'linear-gradient(135deg,#1F3A8A,#2563eb)',
                opacity: loading ? 0.8 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 15,
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg,#172c6e,#1d4ed8)'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg,#1F3A8A,#2563eb)'; }}
            >
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> Analyse en cours…</>
                : <><Sparkles size={18} /> Trouver les meilleurs matériaux</>
              }
            </button>
          </div>
        )}

        {/* ── RESULTS ───────────────────────────────────────────────────────── */}
        {results !== null && (
          <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

            {/* Context banner */}
            {refConv && (
              <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Ruler size={14} style={{ color: '#1F3A8A' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    {refConv.surface} {refConv.unit} · {refConv.category}
                    {(refConv.applyMargin || refConv.margeSecurite) && <span className="ml-1 text-muted-foreground font-normal">+10 % marge</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Quantité calculée par produit selon son facteur propre</p>
                </div>
                <span className="text-xs font-black shrink-0" style={{ color: '#1F3A8A' }}>Budget {refConv ? '' : ''}max</span>
              </div>
            )}

            {/* No results */}
            {results.length === 0 && noResultMsg && (
              <div className="rounded-2xl p-8 text-center space-y-3" style={{ backgroundColor: '#fef9c3', border: '1px solid #fde68a' }}>
                <AlertTriangle size={32} className="mx-auto" style={{ color: '#d97706' }} />
                <p className="font-bold text-foreground">Aucun résultat</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{noResultMsg}</p>
              </div>
            )}

            {/* Results list */}
            {results.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#1F3A8A,#3b82f6)' }}>
                    <Sparkles size={12} />
                  </div>
                  <p className="font-bold text-sm text-foreground">
                    {results.length} produit{results.length > 1 ? 's' : ''} recommandé{results.length > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-4">
                  {results.map((rec, idx) => (
                    <RecoCard
                      key={rec.productId}
                      rec={rec}
                      idx={idx}
                      adding={addingId === rec.productId}
                      onAdd={() => handleAdd(rec)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
