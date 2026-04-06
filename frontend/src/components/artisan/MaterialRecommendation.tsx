import { useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, ClipboardList, ExternalLink, Loader2, MapPin, Plus, Search, Sparkles, Target, Wand2 } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';

type RangeValue = 'economique' | 'standard' | 'premium';

interface ProjectSummary {
  _id: string;
  title?: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
}

interface BmpMaterial {
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantite_recommandee: number;
  unite_mesure: string;
  category: string;
  ai_justification: string;
}

interface ExternalMaterial {
  generic_name: string;
  estimated_price: number;
  quantite_recommandee: number;
  unite_mesure: string;
  suggested_brand: string;
  search_keyword: string;
}

interface BudgetCheckMeta {
  provided_budget: number;
  estimated_total: number;
  estimated_bmp_total: number;
  estimated_external_total: number;
  threshold_15_percent: number;
  is_over_budget_15_percent: boolean;
  warning_message?: string | null;
}

interface AiShopperResponse {
  bmp_materials: BmpMaterial[];
  external_materials: ExternalMaterial[];
  meta?: {
    model?: string;
    api_version?: string;
    local_candidates?: number;
    inferred_categories?: string[];
    semantic_terms?: string[];
    budget_check?: BudgetCheckMeta;
  };
}

interface Props {
  project: ProjectSummary;
  onBack: () => void;
  onAddToProject: (productId: string, quantity?: number) => Promise<void>;
}

const getToken = () => {
  const direct = localStorage.getItem('token');
  if (direct) return direct;

  try {
    return JSON.parse(localStorage.getItem('user') || '{}').token;
  } catch {
    return null;
  }
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const formatMoney = (value: number) => `${Number(value || 0).toFixed(2)} TND`;
const formatQuantity = (value?: number) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Number(num.toFixed(2));
};

export default function MaterialRecommendation({ project, onBack, onAddToProject }: Props) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const [showBriefForm, setShowBriefForm] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());

  const [brief, setBrief] = useState({
    budget: '',
    range: 'standard' as RangeValue,
    specificNeeds: '',
  });

  const [result, setResult] = useState<AiShopperResponse | null>(null);

  const projectDisplay = useMemo(
    () => ({
      title: String(project?.title || 'Projet sans titre'),
      description: String(project?.description || 'Aucune description fournie.'),
      location: String(project?.location || 'Localisation non precisee'),
      startDate: project?.startDate,
      endDate: project?.endDate,
    }),
    [project]
  );

  const handleAnalyze = async () => {
    if (!project?._id) {
      toast.error('Projet invalide.');
      return;
    }

    const budget = Number(brief.budget);
    if (!Number.isFinite(budget) || budget <= 0) {
      toast.error('Veuillez saisir un budget valide en TND.');
      return;
    }

    const token = getToken();
    if (!token) {
      toast.error('Session invalide. Veuillez vous reconnecter.');
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data } = await axios.post(
        `${API_URL}/recommendations/ai-shopper`,
        {
          projectId: project._id,
          budget,
          range: brief.range,
          specificNeeds: brief.specificNeeds,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setResult(data);
      toast.success('Analyse IA terminee.');
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      toast.error(backendMessage || 'Erreur pendant l\'analyse IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddMaterial = async (item: BmpMaterial) => {
    if (!item?.productId) return;
    if (addedProductIds.has(item.productId)) return;

    const recommendedQuantity = Math.max(1, Math.round(formatQuantity(item.quantite_recommandee)));
    setAddingProductId(item.productId);
    try {
      await onAddToProject(item.productId, recommendedQuantity);
      setAddedProductIds((prev) => {
        const next = new Set(prev);
        next.add(item.productId);
        return next;
      });
      toast.success(`${item.name} ajoute au projet (${recommendedQuantity} ${item.unite_mesure || 'pieces'}).`);
    } catch {
      toast.error('Impossible d\'ajouter ce produit au projet.');
    } finally {
      setAddingProductId(null);
    }
  };

  const trackMissingProductClick = (item: ExternalMaterial) => {
    const token = getToken();
    if (!token) return;

    void axios.post(
      `${API_URL}/analytics/missing-product`,
      {
        generic_name: item.generic_name,
        suggested_brand: item.suggested_brand,
        search_keyword: item.search_keyword,
        projectId: project?._id,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    ).catch(() => {
      // Tracking silencieux: on n'interrompt jamais le flux utilisateur.
    });
  };

  const openGoogleSearch = (item: ExternalMaterial) => {
    const query = String(item?.search_keyword || item?.generic_name || '').trim();
    if (!query) return;

    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
    trackMissingProductClick(item);
  };

  const bmpMaterials = result?.bmp_materials || [];
  const externalMaterials = result?.external_materials || [];
  const budgetCheck = result?.meta?.budget_check;
  const showBudgetWarning = Boolean(budgetCheck?.is_over_budget_15_percent);

  return (
    <div className="mx-auto w-full max-w-7xl px-2 py-12 md:px-4">
      <section className="mb-12 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <Button type="button" variant="outline" onClick={onBack} className="h-10 w-10 rounded-lg border border-gray-300 p-0">
              <ArrowLeft size={16} />
            </Button>
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                <Sparkles size={12} /> Personal Shopper IA
              </p>
              <h1 className="mt-2 text-2xl font-black text-foreground">Assistant materiaux de chantier</h1>
              <p className="text-sm text-muted-foreground">Workflow simple: contexte projet - brief IA - liste d'achat exploitable.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <ClipboardList size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">Formulaire projet existant</h2>
        </div>

        <div className="grid grid-cols-2 gap-6 rounded-lg border border-gray-200 bg-gray-50 p-5 md:grid-cols-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wider text-gray-500">Titre</p>
            <p className="text-sm font-medium text-gray-900">{projectDisplay.title}</p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wider text-gray-500">Localisation</p>
            <p className="inline-flex items-center gap-1 text-sm font-medium text-gray-900">
              <MapPin size={13} /> {projectDisplay.location}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wider text-gray-500">Debut</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(projectDisplay.startDate)}</p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wider text-gray-500">Fin</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(projectDisplay.endDate)}</p>
          </div>

          <div className="col-span-2 md:col-span-4">
            <p className="mb-1.5 text-xs font-semibold tracking-wider text-gray-500">Description</p>
            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-gray-900">{projectDisplay.description}</p>
          </div>
        </div>
      </section>

      <section className="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Wand2 size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">Action IA</h2>
        </div>
        <p className="text-sm text-gray-600">
          Activez l'assistant pour generer une liste exploitable de materiaux selon votre contexte chantier.
        </p>

        <div className="mb-2 mt-6 flex justify-start">
          <Button
            type="button"
            onClick={() => setShowBriefForm((prev) => !prev)}
            className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-lg border border-blue-900/20 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5"
            style={{ backgroundColor: '#1E40AF', color: '#ffffff' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1B3A99';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1E40AF';
            }}
          >
            <Wand2 size={15} />
            <span>Demander a l'IA de lister les materiaux</span>
          </Button>
        </div>
      </section>

      {showBriefForm && (
        <section className="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <Target size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Brief IA</h2>
          </div>

          <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="aiBudget" className="text-sm font-semibold text-gray-700">Budget (TND)</Label>
              <Input
                id="aiBudget"
                type="number"
                min="1"
                step="0.01"
                value={brief.budget}
                onChange={(e) => setBrief((prev) => ({ ...prev, budget: e.target.value }))}
                placeholder="Ex: 2500"
                className="h-11 rounded-lg border border-gray-300 bg-white shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aiRange" className="text-sm font-semibold text-gray-700">Gamme</Label>
              <select
                id="aiRange"
                value={brief.range}
                onChange={(e) => setBrief((prev) => ({ ...prev, range: e.target.value as RangeValue }))}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="economique">Economique</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="aiNeeds" className="text-sm font-semibold text-gray-700">Besoins specifiques</Label>
              <Textarea
                id="aiNeeds"
                value={brief.specificNeeds}
                onChange={(e) => setBrief((prev) => ({ ...prev, specificNeeds: e.target.value }))}
                placeholder="Ex: Je veux du carrelage antiderapant et des robinets inox."
                rows={4}
                className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 shadow-sm transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {brief.specificNeeds.trim() && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Apercu des besoins specifiques</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{brief.specificNeeds}</p>
            </div>
          )}

          <div className="mt-8 flex justify-start">
            <Button
              type="button"
              disabled={isAnalyzing}
              onClick={handleAnalyze}
              className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-lg border border-blue-900/20 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              style={{ backgroundColor: '#1E40AF', color: '#ffffff' }}
              onMouseEnter={(e) => {
                if (isAnalyzing) return;
                e.currentTarget.style.backgroundColor = '#1B3A99';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1E40AF';
              }}
            >
              {isAnalyzing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> L'IA analyse vos besoins...
                </span>
              ) : (
                'Lancer l\'analyse IA'
              )}
            </Button>
          </div>
        </section>
      )}

      {(isAnalyzing || result) && (
        <section className="mb-12 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <Sparkles size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Resultats IA</h2>
          </div>

          {!isAnalyzing && showBudgetWarning && (
            <div className="rounded-xl border border-yellow-200 border-l-4 border-l-yellow-500 bg-yellow-50 p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-600" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">
                    {budgetCheck?.warning_message || `Attention, votre budget de ${formatMoney(Number(brief.budget || 0))} semble insuffisant.`}
                  </p>
                  <p className="mt-1 text-xs text-yellow-800">
                    Budget: {formatMoney(budgetCheck?.provided_budget || Number(brief.budget || 0))} • Estimation reelle: <span className="font-bold text-yellow-900">{formatMoney(budgetCheck?.estimated_total || 0)}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {isAnalyzing ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <Skeleton className="h-6 w-52 bg-emerald-100" />
                  <Skeleton className="h-5 w-24 bg-emerald-100" />
                </div>
                <div className="space-y-3">
                  {[0, 1, 2].map((idx) => (
                    <div key={`bmp-skeleton-${idx}`} className="rounded-xl border border-emerald-200 bg-white p-3">
                      <Skeleton className="h-4 w-2/3 bg-emerald-100" />
                      <Skeleton className="mt-2 h-3 w-1/3 bg-emerald-100" />
                      <Skeleton className="mt-3 h-3 w-full bg-emerald-100" />
                      <Skeleton className="mt-2 h-3 w-5/6 bg-emerald-100" />
                      <Skeleton className="mt-3 h-9 w-36 bg-emerald-100" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <Skeleton className="h-6 w-52 bg-slate-200" />
                  <Skeleton className="h-5 w-24 bg-slate-200" />
                </div>
                <div className="space-y-3">
                  {[0, 1, 2].map((idx) => (
                    <div key={`ext-skeleton-${idx}`} className="rounded-xl border border-slate-200 bg-white p-3">
                      <Skeleton className="h-4 w-2/3 bg-slate-200" />
                      <Skeleton className="mt-2 h-3 w-1/3 bg-slate-200" />
                      <Skeleton className="mt-3 h-3 w-full bg-slate-200" />
                      <Skeleton className="mt-2 h-3 w-4/6 bg-slate-200" />
                      <Skeleton className="mt-3 h-9 w-36 bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-300 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black text-emerald-800">✅ Disponibles sur BMP.tn</h2>
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                    Stock BMP verifie
                  </span>
                </div>
                <p className="mt-1 text-xs text-emerald-700">{bmpMaterials.length} produit(s) recommande(s).</p>

                <div className="mt-3 space-y-3">
                  {bmpMaterials.length === 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-white p-3 text-sm text-emerald-800">
                      Aucun produit interne pertinent n'a ete retenu par l'IA.
                    </div>
                  )}

                  {bmpMaterials.map((item) => {
                    const isAdded = addedProductIds.has(item.productId);
                    const isLoading = addingProductId === item.productId;
                    const recommendedQuantity = formatQuantity(item.quantite_recommandee);
                    const estimatedRowTotal = (Number(item.price) || 0) * recommendedQuantity;

                    return (
                      <div key={item.productId} className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-bold text-foreground">{item.name}</p>
                            <p className="text-sm text-gray-600">{item.brand || 'BMP.tn'} • {item.category || 'Categorie'}</p>
                          </div>
                          <p className="text-sm font-black text-emerald-700">{formatMoney(item.price)}</p>
                        </div>

                        <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.ai_justification}</p>
                        <div className="my-3 flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
                          <span className="text-gray-600">
                            Quantite recommandee: <span className="font-semibold text-gray-900">{recommendedQuantity} {item.unite_mesure || 'pieces'}</span>
                          </span>
                          <span className="text-gray-600">
                            Estimation: <span className="font-semibold text-gray-900">{formatMoney(estimatedRowTotal)}</span>
                          </span>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <Button
                            type="button"
                            onClick={() => handleAddMaterial(item)}
                            disabled={isLoading || isAdded}
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
                            style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
                            onMouseEnter={(e) => {
                              if (isLoading || isAdded) return;
                              e.currentTarget.style.backgroundColor = '#15803d';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#16a34a';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            {isLoading ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" /> Ajout...
                              </span>
                            ) : isAdded ? (
                              'Ajoute au projet'
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <Plus size={14} /> Ajouter au projet
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <h2 className="text-lg font-black text-slate-800">🌐 Recommandations Externes</h2>
                <p className="mt-1 text-xs text-slate-600">{externalMaterials.length} suggestion(s) hors catalogue BMP.tn.</p>

                <div className="mt-3 space-y-3">
                  {externalMaterials.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      Aucun achat externe necessaire selon l'analyse IA.
                    </div>
                  )}

                  {externalMaterials.map((item, index) => {
                    const recommendedQuantity = formatQuantity(item.quantite_recommandee);
                    const estimatedRowTotal = (Number(item.estimated_price) || 0) * recommendedQuantity;

                    return (
                      <div key={`${item.generic_name}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-bold text-foreground">{item.generic_name}</p>
                            <p className="text-sm text-gray-600">Marque suggeree: {item.suggested_brand || 'A definir'}</p>
                          </div>
                          <p className="text-sm font-black text-slate-700">{formatMoney(item.estimated_price)}</p>
                        </div>

                        <div className="my-3 flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
                          <span className="text-gray-600">
                            Quantite recommandee: <span className="font-semibold text-gray-900">{recommendedQuantity} {item.unite_mesure || 'pieces'}</span>
                          </span>
                          <span className="text-gray-600">
                            Estimation: <span className="font-semibold text-gray-900">{formatMoney(estimatedRowTotal)}</span>
                          </span>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <Button
                            type="button"
                            onClick={() => openGoogleSearch(item)}
                            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#1d4ed8';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#2563eb';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Search size={14} />
                              Chercher sur Google
                            </span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
