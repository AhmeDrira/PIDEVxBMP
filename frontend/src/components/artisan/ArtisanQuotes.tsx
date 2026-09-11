import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, FileText, Download, Eye, Clock, CheckCircle, X, XCircle, ArrowRight, ShoppingCart, FolderKanban, Trash2, Search, Filter, Mic, MicOff, Sparkles, Gauge, AlertTriangle, Wand2, Loader2, Package } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import axios from 'axios';
import { toast } from 'sonner';
import { useSubscriptionGuard } from './SubscriptionGuard';
import QuoteMethodChoice, { QuoteMethod } from './QuoteMethodChoice';
import QuoteTemplateGallery from './QuoteTemplateGallery';
import QuoteTemplateParams from './QuoteTemplateParams';
import AutoGrowTextarea from './AutoGrowTextarea';
import MarketplaceMaterialPicker from './MarketplaceMaterialPicker';
import type { MarketplaceProduct } from './MarketplaceMaterialPicker';
import PlanImport from './PlanImport';
import PlanRoomPicker from './PlanRoomPicker';
import type { PlanRoomCandidate } from './PlanRoomPicker';

/**
 * Estimation de surface de murs renvoyee par map-reading.
 *
 * Ce n'est PAS une valeur lue : elle vient de 2 x (longueur + largeur) x
 * hauteur, a partir de deux cotes que le modele a rattachees a la piece. Elle
 * suppose la piece rectangulaire et ignore les ouvertures, d'ou la `mention`
 * qui ne doit jamais etre separee du chiffre.
 */
interface PlanEstimation {
  champ_cible: string;
  unite: string;
  mention: string;
  hauteur_utilisee: number | null;
  candidats: Array<{
    piece_index: number;
    libelle: string;
    valeur: number;
    longueur_m?: number;
    largeur_m?: number;
    texte_source: string;
  }>;
}

/** Deux decimales, virgule francaise. */
const formatNombre = (valeur: number) =>
  String(Math.round(valeur * 100) / 100).replace('.', ',');

/** Cote de plan : toujours deux decimales, « 2,90 » et non « 2,9 ». */
const formatCote = (valeur: number) => valeur.toFixed(2).replace('.', ',');

/**
 * Projette une estimation sur les pieces retenues par l'artisan.
 *
 * Deux issues volontairement distinctes :
 *   - en m², l'estimation pre-remplit le champ, editable comme le reste ;
 *   - en `ml`, elle ne le pre-remplit PAS. Sans hauteur lue sur le plan, le
 *     calcul ne donne qu'un perimetre ; le verser dans un champ qui attend des
 *     m² produirait un devis faux d'un facteur egal a la hauteur, sans que rien
 *     ne le signale. On l'affiche donc a cote, a charge pour l'artisan de
 *     multiplier par la hauteur qu'il constate sur place.
 */
/** Une piece retenue, avec les cotes que le plan en donne. */
type PieceRetenue = PlanEstimation['candidats'][number];

/**
 * Batit les quatre murs d'une piece rectangulaire.
 *
 * Sortie par piece : 2 murs a la longueur, 2 a la largeur, paires groupees,
 * nommes d'apres la cote LUE et jamais d'apres une orientation — seul
 * l'artisan sur place sait ce qui est a gauche.
 *
 * Une seule implementation, empruntee aussi bien par la hauteur lue sur le
 * plan que par celle saisie a la main : c'est le meme calcul, il n'a aucune
 * raison d'exister en deux exemplaires qui pourraient diverger.
 */
const construireMurs = (retenues: PieceRetenue[], hauteurM: number) =>
  retenues.flatMap((candidat) => {
    const longueur = Number(candidat.longueur_m);
    const largeur = Number(candidat.largeur_m);
    if (!Number.isFinite(longueur) || !Number.isFinite(largeur) || hauteurM <= 0) {
      // Sans les deux cotes, on retombe sur le total de la piece.
      return [{
        nom: candidat.libelle || 'Mur 1',
        mode: 'surface',
        surfaceM2: candidat.valeur,
        longueurM: 0,
        hauteurM: 2.5,
      }];
    }
    // Paires groupees : les deux murs de meme cote se suivent, comme dans
    // l'esprit de l'artisan qui les regarde.
    return [longueur, longueur, largeur, largeur].map((cote, rang) => ({
      nom: `Mur ${formatCote(cote)} m (${(rang % 2) + 1}/2)`,
      mode: 'longueur',
      surfaceM2: 0,
      longueurM: cote,
      hauteurM,
    }));
  });

const projeterEstimation = (
  estimation: PlanEstimation | null,
  indices: number[]
): {
  prefill?: PrefilledField;
  note?: string;
  /**
   * Le plan donne les cotes de la piece mais pas sa hauteur : on ne peut pas
   * calculer les murs, mais il suffit d'une valeur pour y arriver. On remonte
   * donc les pieces retenues afin que le formulaire la reclame.
   */
  demandeHauteur?: { candidats: PieceRetenue[]; mention: string };
} => {
  if (!estimation) return {};

  const retenues = estimation.candidats.filter((c) => indices.includes(c.piece_index));
  if (retenues.length === 0) return {};

  const total = Math.round(retenues.reduce((somme, c) => somme + Number(c.valeur), 0) * 100) / 100;
  const detail = retenues.map((c) => `${c.libelle} ${formatNombre(c.valeur)}`).join(' + ');

  if (estimation.unite === 'm²') {
    /**
     * Quatre murs par piece, pas un bloc : l'hypothese rectangulaire devient
     * visible dans la liste et chaque mur se corrige separement. Un total
     * unique aurait force l'artisan a refaire l'addition entiere pour retirer
     * une baie vitree.
     */
    const murs = construireMurs(retenues, estimation.hauteur_utilisee || 0);

    return {
      prefill: {
        value: murs,
        hint: `${estimation.mention} (${detail} — total ${formatNombre(total)} m²)`,
      },
    };
  }

  /**
   * Le plan porte les cotes de la piece mais aucune hauteur — c'est le cas
   * normal d'une vue de dessus, qui ne montre jamais la hauteur. Plutot que
   * de s'arreter la, on demande la seule donnee qui manque.
   */
  const cotees = retenues.filter(
    (c) => Number.isFinite(Number(c.longueur_m)) && Number.isFinite(Number(c.largeur_m))
  );
  if (cotees.length > 0) {
    return { demandeHauteur: { candidats: cotees, mention: estimation.mention } };
  }

  return {
    note: `Périmètre estimé d'après le plan : ${formatNombre(total)} m de mur (${detail}). `
      + `Aucune hauteur sous plafond n'est indiquée sur le plan : multipliez par la vôtre. `
      + estimation.mention,
  };
};
// `import type` obligatoire : SWC transpile fichier par fichier, sans acces au
// systeme de types. Un type importe comme une valeur reste dans le JS emis et
// echoue au chargement, le module ne l'exportant pas a l'execution.
import type {
  QuoteTemplate,
  QuoteTemplateLine,
  PrefilledField,
} from './quoteTemplateTypes';
import type { PlanReading } from './PlanImport';
import { QUOTE_UNITS } from '../../lib/quoteUnits';
import {
  computePaymentSchedule,
  defaultPaymentSchedule,
  PaymentTranche,
  TrancheType,
} from '../../lib/paymentSchedule';
import { useLanguage } from '../../context/LanguageContext';

type SpeechField = 'clientName' | 'description' | 'validUntil' | 'invoiceDueDate';

type AiRiskLevel = 'low' | 'medium' | 'high';

type AiQuoteDraft = {
  generatedAt: string;
  projectSnapshot: {
    projectId: string;
    title: string;
    location: string;
    priority: string;
    durationDays: number;
    daysToDeadline: number;
    taskCount: number;
    completionRatio: number;
    materialsCount: number;
    materialsAmount: number;
    totalEstimated: number;
  };
  inference?: {
    source: 'ml-rag' | 'heuristic-fallback';
    model: string;
    method: string;
    confidence: number;
    historyCount: number;
    neighborsUsed: number;
    averageSimilarity: number | null;
    fallbackReason: string | null;
    neighbors: Array<{
      quoteId: string;
      quoteNumber: string;
      similarity: number;
      laborHand: number;
      amount: number;
      upfrontPercent: number;
      paymentMode: 'percentage' | 'fixed';
      projectTitle: string;
    }>;
  };
  recommendations: {
    description: {
      value: string;
      confidence: number;
      reasoning: string[];
    };
    laborHand: {
      value: number;
      ratioApplied: number;
      confidence: number;
      reasoning: string[];
    };
    paymentType: {
      value: 'percentage' | 'fixed';
      confidence: number;
      reasoning: string[];
    };
    upfront: {
      value: number;
      mode: 'percentage' | 'fixed';
      percent: number;
      fixedAmount: number;
      confidence: number;
      reasoning: string[];
      risk: {
        overall: number;
        level: AiRiskLevel;
        client: number;
        delay: number;
        technical: number;
        price: number;
      };
    };
    validUntil: {
      value: string;
      validityDays: number;
      confidence: number;
      reasoning: string[];
    };
  };
  warnings: string[];
  assumptions: string[];
};

type QuoteFormData = {
  project: string;
  clientName: string;
  description: string;
  validUntil: string;

};

/**
 * Un brouillon de devis, tel qu'il survit a un rechargement de page.
 *
 * ⚠ `formData` ne porte que l'EN-TETE (projet, client, description, echeance).
 * Tout le reste du devis vivait uniquement en memoire : recharger la page
 * effacait les lignes, l'echeancier et les cles de dedoublonnage sans le dire.
 * Ces champs sont donc optionnels a la lecture — les brouillons ecrits avant
 * ce correctif n'en ont pas — mais toujours ecrits desormais.
 */
type QuoteDraftItem = {
  id: string;
  timestamp: number;
  title: string;
  formData: QuoteFormData;
  quoteLines?: QuoteTemplateLine[];
  paymentSchedule?: Array<Pick<PaymentTranche, 'label' | 'type' | 'value'>>;
  importedMaterialKeys?: string[];
  marketplaceProductKeys?: string[];
};

/**
 * Cle de transport de la selection faite sur le Marketplace.
 *
 * `sessionStorage` plutot que l'URL : quinze identifiants Mongo feraient une
 * adresse de 400 caracteres, et il faudrait de toute facon transporter nom,
 * prix et categorie. La cle est bornee a l'onglet et effacee des consommation.
 */
const MARKETPLACE_SELECTION_KEY = 'bmp:quote-marketplace-selection';

const DRAFT_QUOTES_STORAGE_KEY = 'all_draft_quotes';
const LEGACY_DRAFT_QUOTE_STORAGE_KEY = 'draft_quote_data';
const AUTO_SAVE_DELAY_MS = 2500;

const initialFormData: QuoteFormData = {
  project: '',
  clientName: '',
  description: '',
  validUntil: '',
};

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

export default function ArtisanQuotes() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const isSpeechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const { guard, PopupElement } = useSubscriptionGuard();
  const [view, setView] = useState<'list' | 'choice' | 'planImport' | 'planTemplates' | 'planRooms' | 'templateParams' | 'templates' | 'create' | 'details'>('list');
  // Modele auto-calcule en cours de parametrage. Null pour un modele fige.
  const [pendingTemplate, setPendingTemplate] = useState<QuoteTemplate | null>(null);
  /**
   * Parcours « depuis un plan ». La lecture est faite une seule fois a l'import
   * puis conservee ici : changer de metier reprojette la meme lecture sans
   * jamais rappeler le modele.
   */
  const [planReading, setPlanReading] = useState<PlanReading | null>(null);
  const [planPrefill, setPlanPrefill] = useState<Record<string, PrefilledField>>({});
  /**
   * Renseignements affiches a cote d'un champ sans le remplir — la hauteur
   * sous plafond lue, dont on ne peut pas deduire la surface des murs.
   */
  const [planNotes, setPlanNotes] = useState<Record<string, string>>({});
  /**
   * Pieces lues quand il y en a plusieurs : l'artisan choisit celles que son
   * devis couvre avant d'arriver au formulaire.
   */
  const [planRooms, setPlanRooms] = useState<{ champ: string; unite: string; candidats: PlanRoomCandidate[] } | null>(null);
  /** Estimation de murs en attente de la selection de pieces. */
  const [planEstimation, setPlanEstimation] = useState<PlanEstimation | null>(null);
  /**
   * Metier retenu dans le parcours « depuis un plan ».
   *
   * Conserve apres la generation des lignes, alors que `pendingTemplate` est
   * remis a null : c'est lui qui permet de revenir aux mesures puis de
   * regagner le formulaire de parametres sans redemander le metier.
   */
  const [planTemplate, setPlanTemplate] = useState<QuoteTemplate | null>(null);
  /**
   * Pieces dont le plan donne longueur et largeur, mais pas la hauteur.
   * Renseigne, le formulaire reclame la hauteur pour calculer les murs.
   */
  const [planMursPrompt, setPlanMursPrompt] = useState<
    { champ: string; candidats: PlanEstimation['candidats']; mention: string } | null
  >(null);
  // Lignes du devis : unique source du montant, en mode libre comme en mode
  // modele metier. Un devis ne peut pas etre genere sans au moins une ligne.
  const [quoteLines, setQuoteLines] = useState<QuoteTemplateLine[]>([]);
  const [artisanDomain, setArtisanDomain] = useState<string>('');
  // Cles des materiaux du projet deja inseres dans le tableau : un second clic
  // sur « Depuis les materiaux du projet » n'ajoute que ce qui manque encore.
  const [importedMaterialKeys, setImportedMaterialKeys] = useState<string[]>([]);
  /**
   * Produits du marketplace deja ajoutes au devis.
   *
   * Etat distinct d'`importedMaterialKeys`, pour deux raisons :
   *   - les deux stockent des `Product._id`, donc les partager ferait qu'un
   *     produit ajoute depuis le projet bloquerait son ajout depuis le
   *     marketplace, alors que ce sont deux gestes differents ;
   *   - `importedMaterialKeys` est vide au changement de projet, ce qui n'a
   *     aucun sens pour un ajout marketplace, sans rapport avec le projet.
   */
  const [marketplaceProductKeys, setMarketplaceProductKeys] = useState<string[]>([]);
  const [showMarketplacePicker, setShowMarketplacePicker] = useState(false);
  // Echeancier de paiement a N tranches. Initialise avec les 2 tranches par
  // defaut, qui reproduisent l'ancien comportement Acompte / Solde.
  const [paymentSchedule, setPaymentSchedule] = useState<
    Array<Pick<PaymentTranche, 'label' | 'type' | 'value'>>
  >(defaultPaymentSchedule());
  const [selectedQuote, setSelectedQuote] = useState<any>(null);

  const [quotes, setQuotes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectFromQuery, setProjectFromQuery] = useState<string | null>(null);
  const [showAllMaterials, setShowAllMaterials] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showDeleteQuoteModal, setShowDeleteQuoteModal] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<any>(null);
  const [isDeletingQuote, setIsDeletingQuote] = useState(false);
  const [deleteQuoteError, setDeleteQuoteError] = useState<string | null>(null);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceTargetQuote, setInvoiceTargetQuote] = useState<any>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'withInvoice' | 'withoutInvoice'>('all');
  const [aiDraft, setAiDraft] = useState<AiQuoteDraft | null>(null);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [aiDraftError, setAiDraftError] = useState('');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<QuoteDraftItem[]>([]);
  const [isDraftMenuOpen, setIsDraftMenuOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isDraftsLoaded, setIsDraftsLoaded] = useState(false);

  const todayLocalDate = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();

  const [formData, setFormData] = useState<QuoteFormData>({ ...initialFormData });

  // États pour la validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [activeSpeechField, setActiveSpeechField] = useState<SpeechField | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isDueDateListening, setIsDueDateListening] = useState(false);
  const invoiceSectionRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const dueDateRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechBaseRef = useRef('');
  const speechFinalRef = useRef('');
  const formDataRef = useRef(formData);
  const draftMenuRef = useRef<HTMLDivElement | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const normalizeSpeechText = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\u0600-\u06ff\s.,/%-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const monthMap: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
    janvier: 1,
    fevrier: 2,
    mars: 3,
    avril: 4,
    mai: 5,
    juin: 6,
    juillet: 7,
    aout: 8,
    septembre: 9,
    octobre: 10,
    novembre: 11,
    decembre: 12,
  };

  const toIsoDate = (day: number, month: number, year: number) => {
    const yyyy = year < 100 ? 2000 + year : year;
    if (yyyy < 1900 || yyyy > 2100) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    const date = new Date(Date.UTC(yyyy, month - 1, day));
    const isValid = date.getUTCFullYear() === yyyy && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    if (!isValid) return null;

    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseSpokenDateToIso = (raw: string) => {
    const normalized = normalizeSpeechText(raw)
      .replace(/\b(du|de|le)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return null;

    const ymdMatch = normalized.match(/\b(\d{4})[\/\-. ](\d{1,2})[\/\-. ](\d{1,2})\b/);
    if (ymdMatch) {
      const iso = toIsoDate(Number(ymdMatch[3]), Number(ymdMatch[2]), Number(ymdMatch[1]));
      if (iso) return iso;
    }

    const dmyMatch = normalized.match(/\b(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})\b/);
    if (dmyMatch) {
      const iso = toIsoDate(Number(dmyMatch[1]), Number(dmyMatch[2]), Number(dmyMatch[3]));
      if (iso) return iso;
    }

    const parts = normalized.split(' ');
    if (parts.length >= 3) {
      const day = Number(parts[0]);
      const month = monthMap[parts[1]];
      const year = Number(parts[2]);
      if (Number.isFinite(day) && Number.isFinite(year) && month) {
        const iso = toIsoDate(day, month, year);
        if (iso) return iso;
      }
    }

    return null;
  };

  /**
   * Des lignes suffisent a faire un brouillon.
   *
   * L'en-tete seul ne suffisait pas : un artisan qui commence par batir son
   * tableau, sans encore nommer son client, n'avait rien de sauvegarde.
   */
  const hasDraftContent = (data: QuoteFormData, lines: QuoteTemplateLine[] = quoteLines) => Boolean(
    data.project
    || data.clientName.trim()
    || data.description.trim()
    || data.validUntil
    || (Array.isArray(lines) && lines.length > 0)
  );

  const sanitizeDraftFormData = (draftData: Partial<QuoteFormData>, fallback: QuoteFormData): QuoteFormData => ({
    ...fallback,
    project: typeof draftData.project === 'string' ? draftData.project : fallback.project,
    clientName: typeof draftData.clientName === 'string' ? draftData.clientName : fallback.clientName,
    description: typeof draftData.description === 'string' ? draftData.description : fallback.description,
    validUntil: typeof draftData.validUntil === 'string' ? draftData.validUntil : fallback.validUntil,
  });

  const createDraftId = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const buildDraftTitle = (draftData: QuoteFormData) => {
    const clientName = draftData.clientName.trim();
    return clientName || 'Brouillon sans nom';
  };

  const upsertDraft = (draftData: QuoteFormData, preferredDraftId?: string) => {
    const draftId = preferredDraftId || activeDraftId || createDraftId();
    const timestamp = Date.now();

    const nextDraft: QuoteDraftItem = {
      id: draftId,
      timestamp,
      title: buildDraftTitle(draftData),
      formData: { ...draftData },
      // Le devis entier, pas seulement son en-tete.
      quoteLines: quoteLines.map((line) => ({ ...line })),
      paymentSchedule: paymentSchedule.map((tranche) => ({ ...tranche })),
      importedMaterialKeys: [...importedMaterialKeys],
      marketplaceProductKeys: [...marketplaceProductKeys],
    };

    setDrafts((prev) => {
      const withoutCurrent = prev.filter((draft) => draft.id !== draftId);
      return [nextDraft, ...withoutCurrent].sort((a, b) => b.timestamp - a.timestamp);
    });

    setActiveDraftId(draftId);
    setLastSavedAt(new Date(timestamp).toISOString());
    return draftId;
  };

  const removeDraftById = (draftId: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
      setLastSavedAt(null);
    }
  };

  const clearCurrentDraft = () => {
    if (activeDraftId) {
      setDrafts((prev) => prev.filter((draft) => draft.id !== activeDraftId));
    }
    setActiveDraftId(null);
    setLastSavedAt(null);
    setIsSaving(false);
  };

  const handleResumeDraft = (draft: QuoteDraftItem) => {
    guard(() => {
      setFormData({ ...draft.formData });
      // Un brouillon anterieur au correctif n'a pas ces champs : on repart
      // alors des valeurs neuves plutot que de laisser celles du devis
      // precedent, qui n'ont rien a voir avec celui qu'on reprend.
      setQuoteLines(Array.isArray(draft.quoteLines) ? draft.quoteLines.map((l) => ({ ...l })) : []);
      setPaymentSchedule(
        Array.isArray(draft.paymentSchedule) && draft.paymentSchedule.length > 0
          ? draft.paymentSchedule.map((t) => ({ ...t }))
          : defaultPaymentSchedule()
      );
      setImportedMaterialKeys(
        Array.isArray(draft.importedMaterialKeys) ? [...draft.importedMaterialKeys] : []
      );
      setMarketplaceProductKeys(
        Array.isArray(draft.marketplaceProductKeys) ? [...draft.marketplaceProductKeys] : []
      );
      setActiveDraftId(draft.id);
      setLastSavedAt(new Date(draft.timestamp).toISOString());
      setErrors({});
      setTouched({});
      setAiDraft(null);
      setAiDraftError('');
      setIsDraftMenuOpen(false);
      setView('create');
    });
  };

  const handleDeleteDraft = (event: React.MouseEvent, draftId: string) => {
    event.stopPropagation();
    removeDraftById(draftId);
  };

  const handleStartNewQuote = () => {
    guard(() => {
      setFormData({ ...initialFormData });
      setActiveDraftId(null);
      setLastSavedAt(null);
      setErrors({});
      setTouched({});
      setAiDraft(null);
      setAiDraftError('');
      setIsDraftMenuOpen(false);
      setPendingTemplate(null);
      setMarketplaceProductKeys([]);
      setShowMarketplacePicker(false);
      setPlanReading(null);
      setPlanPrefill({});
      setPlanNotes({});
      setPlanRooms(null);
      setPlanEstimation(null);
      setPlanTemplate(null);
      setPlanMursPrompt(null);
      // Etape intermediaire : l'artisan choisit d'abord sa methode. La reprise
      // d'un brouillon et l'arrivee depuis un projet (?projectId=) continuent
      // d'ouvrir le formulaire directement, leur intention etant deja explicite.
      setView('choice');
    });
  };

  const handleSelectQuoteMethod = (method: QuoteMethod) => {
    if (method === 'template') {
      setView('templates');
      return;
    }
    if (method === 'plan') {
      setPlanReading(null);
      setPlanPrefill({});
      setPlanNotes({});
      setPlanRooms(null);
      setPlanEstimation(null);
      setPlanTemplate(null);
      setPlanMursPrompt(null);
      setView('planImport');
      return;
    }
    // Devis libre : on part d'un tableau vide, l'artisan ajoute ses lignes.
    setQuoteLines([]);
    setImportedMaterialKeys([]);
    setView('create');
  };

  /** Applique un modele au formulaire, quelle que soit l'origine des lignes. */
  const applyTemplateLines = (template: QuoteTemplate, lines: QuoteTemplateLine[]) => {
    setQuoteLines(lines.map((line) => ({ ...line })));
    setImportedMaterialKeys([]);
    // Les lignes sont remplacees, donc celles venues du marketplace ont
    // disparu : garder leurs cles ferait afficher « Deja ajoute » sur des
    // produits qui ne sont plus dans le devis.
    setMarketplaceProductKeys([]);
    setFormData((prev) => ({ ...prev, description: template.title }));
    setPendingTemplate(null);
    setView('create');
  };

  /**
   * Projette la lecture du plan sur le metier choisi.
   *
   * Aucun appel au modele : le backend refait le mapping et le garde-fou de
   * source, ce qui est instantane et gratuit. Un echec n'est pas bloquant —
   * l'artisan continue avec un formulaire vide.
   */
  const handleSelectTemplateForPlan = async (
    template: QuoteTemplate,
    lectureExplicite?: PlanReading
  ) => {
    const prefill: Record<string, PrefilledField> = {};
    const notes: Record<string, string> = {};
    /**
     * Mesures lues, telles que l'ecran de selection les montre.
     *
     * Renseignees des qu'il y a au moins une piece, meme quand on ne s'arrete
     * pas dessus : c'est l'ecran vers lequel le bouton « Retour » ramene
     * depuis le formulaire, et l'artisan doit pouvoir y revoir ce qui a ete lu
     * meme si le parcours l'avait saute.
     */
    let mesures: { champ: string; unite: string; candidats: PlanRoomCandidate[] } | null = null;
    /** Vrai quand plusieurs pieces obligent a demander laquelle est concernee. */
    let doitChoisir = false;
    let estimation: PlanEstimation | null = null;
    let demandeHauteur: { champ: string; candidats: PlanEstimation['candidats']; mention: string } | null = null;
    // Pieces retenues d'office : une seule surface lue, donc rien a demander.
    let indicesRetenus: number[] = [];

    // La lecture peut arriver en argument : quand le metier est reconnu des
    // l'import, `planReading` n'est pas encore a jour dans ce meme rendu.
    const lecture = lectureExplicite || planReading;

    if (lecture) {
      try {
        const token = getToken();
        const { data } = await axios.post(
          `${API_URL}/quotes/templates/${template.id}/map-reading`,
          { lecture },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        (data.propositions || []).forEach((proposition: any) => {
          const candidats = proposition.candidats || [];
          if (candidats.length > 0 && !mesures) {
            mesures = {
              champ: proposition.champ_cible,
              unite: proposition.unite || 'm²',
              candidats,
            };
          }

          if (candidats.length === 1) {
            // Une seule piece lue : il n'y a rien a choisir.
            prefill[proposition.champ_cible] = {
              value: candidats[0].valeur,
              hint: `${candidats[0].libelle} — « ${String(candidats[0].texte_source).replace(/\s+/g, ' ')} »`,
            };
            indicesRetenus = [candidats[0].piece_index];
          } else if (candidats.length > 1) {
            // Plusieurs pieces : le plan couvre le logement entier, le devis
            // non. On passe par l'ecran de selection plutot que de trancher.
            doitChoisir = true;
          }
        });

        // Renseignements qui ne remplissent rien : hauteur sous plafond lue,
        // cotations brutes faute de cotes rattachees a une piece. Plusieurs
        // peuvent viser le meme champ, on les accumule au lieu de les ecraser.
        (data.indications || []).forEach((indication: any) => {
          if (indication && indication.champ_cible) {
            const existant = notes[indication.champ_cible];
            notes[indication.champ_cible] = existant
              ? `${existant} · ${indication.texte}`
              : String(indication.texte);
          }
        });

        estimation = (data.estimations || [])[0] || null;

        if ((data.avertissements || []).length > 0) {
          toast.info(data.avertissements.join(' '));
        }
      } catch {
        toast.error(tr(
          'The plan reading could not be applied.',
          "La lecture du plan n'a pas pu être appliquée.",
          'تعذر تطبيق قراءة المخطط.'
        ));
      }
    }

    // Sans ecran de selection, l'estimation s'applique tout de suite.
    if (!doitChoisir && estimation) {
      const projection = projeterEstimation(estimation, indicesRetenus);
      if (projection.prefill) prefill[estimation.champ_cible] = projection.prefill;
      demandeHauteur = projection.demandeHauteur
        ? { champ: estimation.champ_cible, ...projection.demandeHauteur }
        : null;
      if (projection.note) {
        notes[estimation.champ_cible] = notes[estimation.champ_cible]
          ? `${notes[estimation.champ_cible]} · ${projection.note}`
          : projection.note;
      }
    }

    setPlanPrefill(prefill);
    setPlanNotes(notes);
    setPendingTemplate(template);
    setPlanRooms(mesures);
    setPlanEstimation(estimation);
    setPlanMursPrompt(demandeHauteur);
    setPlanTemplate(template);
    setView(doitChoisir ? 'planRooms' : 'templateParams');
  };

  /**
   * Somme des pieces cochees : elle devient la surface de depart du modele, et
   * sert aussi de base a l'estimation des murs, calculee sur la meme selection.
   */
  const handleConfirmPlanRooms = (total: number, detail: string, indices: number[]) => {
    if (planRooms) {
      setPlanPrefill((prev) => ({
        ...prev,
        [planRooms.champ]: { value: total, hint: detail },
      }));
    }

    const projection = projeterEstimation(planEstimation, indices);
    setPlanMursPrompt(
      planEstimation && projection.demandeHauteur
        ? { champ: planEstimation.champ_cible, ...projection.demandeHauteur }
        : null
    );
    if (planEstimation && projection.prefill) {
      setPlanPrefill((prev) => ({ ...prev, [planEstimation.champ_cible]: projection.prefill! }));
    }
    if (planEstimation && projection.note) {
      setPlanNotes((prev) => ({
        ...prev,
        [planEstimation.champ_cible]: prev[planEstimation.champ_cible]
          ? `${prev[planEstimation.champ_cible]} · ${projection.note}`
          : projection.note!,
      }));
    }

    setView('templateParams');
  };

  const handleSelectTemplate = (template: QuoteTemplate) => {
    // Modele auto-calcule : on demande d'abord ses parametres. Les modeles
    // figes gardent le chemin d'origine, selection -> formulaire.
    if (Array.isArray(template.parameters) && template.parameters.length > 0) {
      setPendingTemplate(template);
      setView('templateParams');
      return;
    }
    applyTemplateLines(template, template.lines);
  };

  /** Recalcule le total d'une ligne des qu'une quantite ou un prix change. */
  const updateQuoteLine = (index: number, patch: Partial<QuoteTemplateLine>) => {
    setQuoteLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        const quantity = Number(next.quantity) || 0;
        const unitPrice = Number(next.unitPrice) || 0;
        return { ...next, total: quantity * unitPrice };
      })
    );
  };

  const removeQuoteLine = (index: number) => {
    setQuoteLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTranche = (
    index: number,
    patch: Partial<Pick<PaymentTranche, 'label' | 'type' | 'value'>>
  ) => {
    setPaymentSchedule((prev) =>
      prev.map((tranche, i) => (i === index ? { ...tranche, ...patch } : tranche))
    );
  };

  const removeTranche = (index: number) => {
    setPaymentSchedule((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Ajoute une tranche deja nommee.
   *
   * Le libelle vide etait la cause du 400 « Tranche 3: label is required » :
   * une tranche a 0 % ne desequilibre pas l'echeancier, donc le bouton
   * restait actif et le refus n'arrivait qu'au serveur. Un nom par defaut
   * fait que l'echeancier est valide des l'ajout ; l'artisan le renomme.
   */
  const addTranche = () => {
    setPaymentSchedule((prev) => [
      ...prev,
      { label: `${tr('Instalment', 'Tranche', 'قسط')} ${prev.length + 1}`, type: 'percent', value: 0 },
    ]);
  };

  const addQuoteLine = () => {
    setQuoteLines((prev) => [
      ...prev,
      { designation: '', quantity: 1, unit: 'unité', unitPrice: 0, lineType: 'material', total: 0 },
    ]);
  };

  /** Met le brouillon a jour avant de quitter l'ecran de saisie. */
  const persistDraftBeforeLeaving = () => {
    if (hasDraftContent(formData, quoteLines)) {
      upsertDraft(formData, activeDraftId || undefined);
    } else if (activeDraftId) {
      removeDraftById(activeDraftId);
    }
    setIsDraftMenuOpen(false);
  };

  /** Abandon du devis en cours : retour a la liste. */
  const handleExitCreateQuote = () => {
    persistDraftBeforeLeaving();
    setPendingTemplate(null);
    setView('list');
  };

  /**
   * Retour depuis l'ecran de saisie, contextuel au parcours.
   *
   * Un devis bati depuis un plan ramene aux mesures lues : l'artisan qui
   * recule veut corriger une piece mal cochee, pas abandonner son devis. Il
   * faut alors rendre son metier a `pendingTemplate`, que la generation des
   * lignes avait remis a null — sans quoi l'ecran de parametres ne se
   * reafficherait pas apres correction.
   *
   * A ne pas confondre avec le bouton « Annuler » en bas du formulaire, qui
   * exprime bien un abandon et continue de ramener a la liste.
   */
  const handleBackFromCreateQuote = () => {
    if (planReading && planRooms) {
      persistDraftBeforeLeaving();
      setPendingTemplate(planTemplate);
      setView('planRooms');
      return;
    }
    handleExitCreateQuote();
  };

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    try {
      const hydratedDrafts: QuoteDraftItem[] = [];
      const rawDrafts = localStorage.getItem(DRAFT_QUOTES_STORAGE_KEY);

      if (rawDrafts) {
        const parsedDrafts = JSON.parse(rawDrafts);
        if (Array.isArray(parsedDrafts)) {
          parsedDrafts.forEach((draft) => {
            const candidate = draft as Partial<QuoteDraftItem> & { lastSavedAt?: string };
            const nextFormData = sanitizeDraftFormData(candidate.formData || {}, initialFormData);
            const nextLines = Array.isArray(candidate.quoteLines) ? candidate.quoteLines : [];
            if (!hasDraftContent(nextFormData, nextLines)) return;

            const parsedTimestamp =
              typeof candidate.timestamp === 'number'
                ? candidate.timestamp
                : typeof candidate.lastSavedAt === 'string'
                  ? new Date(candidate.lastSavedAt).getTime()
                  : Date.now();

            hydratedDrafts.push({
              id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : createDraftId(),
              timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now(),
              title:
                typeof candidate.title === 'string' && candidate.title.trim()
                  ? candidate.title.trim()
                  : buildDraftTitle(nextFormData),
              formData: nextFormData,
              // Absents des brouillons ecrits avant ce correctif : on les
              // laisse vides plutot que de les inventer.
              quoteLines: nextLines,
              paymentSchedule: Array.isArray(candidate.paymentSchedule) ? candidate.paymentSchedule : undefined,
              importedMaterialKeys: Array.isArray(candidate.importedMaterialKeys)
                ? candidate.importedMaterialKeys : [],
              marketplaceProductKeys: Array.isArray(candidate.marketplaceProductKeys)
                ? candidate.marketplaceProductKeys : [],
            });
          });
        }
      }

      if (hydratedDrafts.length === 0) {
        const legacyRawDraft = localStorage.getItem(LEGACY_DRAFT_QUOTE_STORAGE_KEY);
        if (legacyRawDraft) {
          const legacyDraft = JSON.parse(legacyRawDraft) as {
            formData?: Partial<QuoteFormData>;
            lastSavedAt?: string;
          };

          const legacyFormData = sanitizeDraftFormData(legacyDraft.formData || {}, initialFormData);
          if (hasDraftContent(legacyFormData)) {
            const legacyTimestamp =
              typeof legacyDraft.lastSavedAt === 'string'
                ? new Date(legacyDraft.lastSavedAt).getTime()
                : Date.now();

            hydratedDrafts.push({
              id: createDraftId(),
              timestamp: Number.isFinite(legacyTimestamp) ? legacyTimestamp : Date.now(),
              title: buildDraftTitle(legacyFormData),
              formData: legacyFormData,
            });
          }
          localStorage.removeItem(LEGACY_DRAFT_QUOTE_STORAGE_KEY);
        }
      }

      const uniqueDrafts = Array.from(
        new Map(hydratedDrafts.map((draft) => [draft.id, draft])).values()
      ).sort((a, b) => b.timestamp - a.timestamp);

      setDrafts(uniqueDrafts);
    } catch (error) {
      console.error('Failed to hydrate quote drafts:', error);
      localStorage.removeItem(DRAFT_QUOTES_STORAGE_KEY);
      localStorage.removeItem(LEGACY_DRAFT_QUOTE_STORAGE_KEY);
      setDrafts([]);
    } finally {
      setIsDraftsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isDraftsLoaded) return;
    try {
      localStorage.setItem(DRAFT_QUOTES_STORAGE_KEY, JSON.stringify(drafts));
    } catch (error) {
      console.error('Failed to persist quote drafts:', error);
    }
  }, [drafts, isDraftsLoaded]);

  useEffect(() => {
    if (!isDraftMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (draftMenuRef.current && !draftMenuRef.current.contains(event.target as Node)) {
        setIsDraftMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDraftMenuOpen]);

  useEffect(() => {
    if (!isDraftsLoaded) return;
    if (view !== 'create' || isSubmitting) {
      setIsSaving(false);
      return;
    }

    if (!hasDraftContent(formData, quoteLines)) {
      setIsSaving(false);
      if (activeDraftId) {
        setDrafts((prev) => prev.filter((draft) => draft.id !== activeDraftId));
        setActiveDraftId(null);
      }
      setLastSavedAt(null);
      return;
    }

    setIsSaving(true);
    const timeoutId = window.setTimeout(() => {
      upsertDraft(formData, activeDraftId || undefined);
      setIsSaving(false);
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // `quoteLines` et l'echeancier font partie des dependances : sans eux,
    // batir un tableau de dix lignes ne declenchait aucune sauvegarde et
    // n'affichait meme pas « Sauvegarde en cours… ».
  }, [
    formData,
    quoteLines,
    paymentSchedule,
    importedMaterialKeys,
    marketplaceProductKeys,
    view,
    isSubmitting,
    activeDraftId,
    isDraftsLoaded,
  ]);

  useEffect(() => {
    if (!aiDraft) return;
    if (aiDraft.projectSnapshot.projectId !== formData.project) {
      setAiDraft(null);
      setAiDraftError('');
    }
  }, [aiDraft, formData.project]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      dueDateRecognitionRef.current?.stop();
    };
  }, []);

  const getSpeechLanguage = () => {
    if (language === 'fr') return 'fr-FR';
    if (language === 'ar') return 'ar-TN';
    return 'en-US';
  };

  const applyFieldValue = (field: SpeechField, value: string | 'percentage' | 'fixed') => {
    if (field === 'invoiceDueDate') {
      const typedValue = String(value);
      setInvoiceDueDate(typedValue);
      return;
    }

    const typedValue = String(value);
    setFormData((prev) => ({ ...prev, [field]: typedValue }));
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, typedValue) }));
    }
  };

  const stopSpeechToText = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setActiveSpeechField(null);
  };

  const startSpeechToText = (field: SpeechField) => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      toast.error(tr('Speech-to-text is not supported on this browser.', 'La dictee vocale n est pas supportee sur ce navigateur.', 'Speech-to-text is not supported on this browser.'));
      return;
    }

    if (activeSpeechField === field) {
      stopSpeechToText();
      return;
    }

    recognitionRef.current?.stop();

    const recognition = new SpeechRecognitionClass();
    recognition.lang = getSpeechLanguage();
    recognition.continuous = true;
    recognition.interimResults = true;

    const isDateField = field === 'validUntil' || field === 'invoiceDueDate';

    speechBaseRef.current = isDateField
      ? ''
      : String(formDataRef.current[field] || '').trim();
    speechFinalRef.current = '';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript?.trim();
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          speechFinalRef.current = `${speechFinalRef.current} ${transcript}`.trim();
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }

      const combined = [speechBaseRef.current, speechFinalRef.current, interim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

      if (isDateField) {
        const parsedDate = parseSpokenDateToIso(combined);
        if (parsedDate) {
          applyFieldValue('validUntil', parsedDate);
        }
        return;
      }

      applyFieldValue(field, combined);
    };

    recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        toast.error(tr('Voice capture failed. Please retry.', 'La capture vocale a echoue. Veuillez reessayer.', 'Voice capture failed. Please retry.'));
      }
      setIsListening(false);
      setActiveSpeechField(null);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      if (field === 'validUntil' && !formDataRef.current.validUntil) {
        toast.info(tr('Date not recognized. Try format 12/04/2026.', 'Date non reconnue. Essayez le format 12/04/2026.', 'Date not recognized. Try format 12/04/2026.'));
      }
      if (field === 'invoiceDueDate' && !invoiceDueDate) {
        toast.info(tr('Due date not recognized. Try format 12/04/2026.', 'Date d echeance non reconnue. Essayez le format 12/04/2026.', 'Due date not recognized. Try format 12/04/2026.'));
      }
      setIsListening(false);
      setActiveSpeechField(null);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setActiveSpeechField(field);
    setIsListening(false);
    recognition.start();
  };

  const renderSpeechButton = (field: SpeechField) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => startSpeechToText(field)}
      disabled={!isSpeechSupported}
      aria-pressed={activeSpeechField === field}
      aria-label={
        activeSpeechField === field
          ? tr('Stop voice input', 'Arreter la dictee vocale', 'Stop voice input')
          : tr('Start voice input', 'Demarrer la dictee vocale', 'Start voice input')
      }
      className={`h-9 rounded-lg border ${activeSpeechField === field ? 'border-red-500 text-red-600' : 'border-border text-muted-foreground'}`}
    >
      {activeSpeechField === field ? <MicOff size={16} className="mr-2" /> : <Mic size={16} className="mr-2" />}
      {activeSpeechField === field && isListening
        ? tr('Listening...', 'Ecoute...', 'Listening...')
        : activeSpeechField === field
          ? tr('Stop', 'Arreter', 'Stop')
          : tr('Dictee', 'Dictee', 'Dictee')}
      {activeSpeechField === field && isListening && <span className="ml-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />}
    </Button>
  );

  const toggleInvoiceDueDateSpeech = () => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      toast.error(tr('Speech-to-text is not supported on this browser.', 'La dictee vocale n est pas supportee sur ce navigateur.', 'Speech-to-text is not supported on this browser.'));
      return;
    }

    if (isDueDateListening) {
      dueDateRecognitionRef.current?.stop();
      dueDateRecognitionRef.current = null;
      setIsDueDateListening(false);
      return;
    }

    dueDateRecognitionRef.current?.stop();
    const recognition = new SpeechRecognitionClass();
    recognition.lang = getSpeechLanguage();
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';
    let recognized = false;

    recognition.onstart = () => {
      setIsDueDateListening(true);
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript?.trim();
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      const combined = `${finalTranscript} ${interimTranscript}`.trim();
      const parsedDate = parseSpokenDateToIso(combined);
      if (parsedDate) {
        recognized = true;
        setInvoiceDueDate(parsedDate);
      }
    };

    recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        toast.error(tr('Voice capture failed. Please retry.', 'La capture vocale a echoue. Veuillez reessayer.', 'Voice capture failed. Please retry.'));
      }
      setIsDueDateListening(false);
      dueDateRecognitionRef.current = null;
    };

    recognition.onend = () => {
      if (!recognized) {
        toast.info(tr('Due date not recognized. Try format 12/04/2026.', 'Date d echeance non reconnue. Essayez le format 12/04/2026.', 'Due date not recognized. Try format 12/04/2026.'));
      }
      setIsDueDateListening(false);
      dueDateRecognitionRef.current = null;
    };

    dueDateRecognitionRef.current = recognition;
    recognition.start();
  };

  const isProjectEligibleForQuote = (project: any) => {
    const numericProgress = Number(project?.progress ?? 0);
    const isCompletedByStatus = String(project?.status || '').toLowerCase() === 'completed';
    const isCompletedByProgress = Number.isFinite(numericProgress) && numericProgress >= 100;
    return !isCompletedByStatus && !isCompletedByProgress;
  };

  const availableProjects = projects.filter(isProjectEligibleForQuote);

  const selectedProject = projects.find((proj) => proj._id === formData.project);
  const groupedMarketplaceMaterials = Array.isArray(selectedProject?.materials)
    ? Object.values(
        selectedProject.materials.reduce((acc: Record<string, { item: any; quantity: number; source: 'marketplace' }>, mat: any) => {
          const matId = String((mat && (mat._id || mat)) || '');
          if (!matId) return acc;
          if (!acc[matId]) {
            acc[matId] = { item: mat, quantity: 0, source: 'marketplace' };
          }
          acc[matId].quantity += 1;
          return acc;
        }, {})
      )
    : [];
  const personalMaterialEntries = Array.isArray(selectedProject?.personalMaterials)
    ? selectedProject.personalMaterials
        .filter((item: any) => item && item.name)
        .map((item: any, index: number) => {
          const qty = Number(item?.stock);
          return {
            item,
            quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
            source: 'personal' as const,
            key: String(item?._id || `personal-${index}`),
          };
        })
    : [];
  const groupedMaterials = [
    ...groupedMarketplaceMaterials.map((entry: any) => ({
      ...entry,
      key: String(entry?.item?._id || ''),
    })),
    ...personalMaterialEntries,
  ];
  // Totaux issus des lignes du modele ; ignores quand il n'y en a pas.
  /** Materiaux du projet pas encore presents dans le tableau. */
  const pendingProjectMaterials = groupedMaterials.filter(
    (entry: any) => !importedMaterialKeys.includes(String(entry?.key || ''))
  );

  const addLinesFromProjectMaterials = () => {
    if (pendingProjectMaterials.length === 0) return;

    const newLines = pendingProjectMaterials.map((entry: any) => {
      const quantity = Number(entry?.quantity) || 1;
      const unitPrice = Number(entry?.item?.price) || 0;
      return {
        designation: String(entry?.item?.name || ''),
        quantity,
        // Ni Product ni personalMaterials ne portent d'unite : l'artisan ajuste.
        unit: 'unité',
        unitPrice,
        lineType: 'material' as const,
        total: quantity * unitPrice,
      };
    });

    setQuoteLines((prev) => [...prev, ...newLines]);
    setImportedMaterialKeys((prev) => [
      ...prev,
      ...pendingProjectMaterials.map((entry: any) => String(entry?.key || '')),
    ]);
  };

  /**
   * Transforme les produits choisis en lignes de devis ordinaires.
   *
   * `unit` vaut 'unité' faute de mieux : le modele Product ne porte aucune
   * unite, et la deduire de la categorie — texte libre, en francais comme en
   * anglais — donnerait un resultat plausible mais faux, que l'artisan ne
   * penserait pas a corriger. Un defaut visiblement approximatif appelle la
   * correction ; un defaut credible la fait oublier.
   */
  /**
   * Part choisir des materiaux sur la vraie page Marketplace.
   *
   * La sauvegarde est FORCEE avant de naviguer : l'autosauvegarde attend
   * 2500 ms, et un rechargement de page qui part avant elle emporterait les
   * lignes tout juste saisies. `upsertDraft` est synchrone et rend l'id du
   * brouillon, qui accompagne l'artisan a l'aller comme au retour.
   */
  const handleGoToMarketplace = () => {
    const draftId = upsertDraft(formData, activeDraftId || undefined);
    setIsDraftMenuOpen(false);
    window.location.href = `/?artisanView=marketplace&quoteDraftId=${encodeURIComponent(draftId)}`;
  };

  const addLinesFromMarketplace = (produits: MarketplaceProduct[]) => {
    const newLines = produits.map((produit) => {
      const unitPrice = Number(produit?.price) || 0;
      return {
        designation: String(produit?.name || ''),
        // Modifiable ensuite sur la ligne, comme pour les materiaux du projet.
        quantity: 1,
        unit: 'unité',
        unitPrice,
        lineType: 'material' as const,
        total: unitPrice,
      };
    });

    setQuoteLines((prev) => [...prev, ...newLines]);
    setMarketplaceProductKeys((prev) => Array.from(new Set([
      ...prev,
      ...produits.map((produit) => String(produit?._id || '')),
    ])));
    setShowMarketplacePicker(false);
  };

  const linesLaborTotal = quoteLines
    .filter((line) => line.lineType === 'labor')
    .reduce((sum, line) => sum + (Number(line.total) || 0), 0);
  const linesMaterialsTotal = quoteLines
    .filter((line) => line.lineType === 'material')
    .reduce((sum, line) => sum + (Number(line.total) || 0), 0);

  // Les lignes sont l'unique source du devis : plus de saisie globale.
  const laborHandAmount = linesLaborTotal;
  const totalAmount = linesLaborTotal + linesMaterialsTotal;

  const {
    tranches: computedTranches,
    sum: scheduleSum,
    isBalanced: isScheduleBalanced,
  } = computePaymentSchedule(paymentSchedule, totalAmount);
  // Une tranche « Solde restant » absorbe l'ecart : l'echeancier ne peut alors
  // jamais etre desequilibre, sauf si les tranches precedentes depassent le total.
  const hasRemainingTranche = paymentSchedule.some((t) => t.type === 'remaining');
  /**
   * Le serveur exige un libelle par tranche : le verifier ici evite de
   * decouvrir le refus apres coup. L'equilibre seul ne suffisait pas — une
   * tranche a 0 % sans nom laissait l'echeancier equilibre et le bouton actif.
   */
  const allTranchesNamed = paymentSchedule.every((t) => String(t.label || '').trim().length > 0);
  const canSubmitSchedule = paymentSchedule.length > 0 && isScheduleBalanced && allTranchesNamed;

  const normalizeRisk = (value: number) => Math.min(Math.max(Number(value) || 0, 0), 100);
  const feasibilityBadgeClass = (level: AiRiskLevel) => {
    if (level === 'high') return 'border-red-200 bg-red-50 text-red-700';
    if (level === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  };
  const feasibilityFillColor = (level: AiRiskLevel) => {
    if (level === 'high') return '#ef4444';
    if (level === 'medium') return '#f59e0b';
    return '#10b981';
  };
  const feasibilityLabel = (level: AiRiskLevel) => {
    if (level === 'high') return tr('High vigilance', 'Vigilance elevee', 'High vigilance');
    if (level === 'medium') return tr('Moderate vigilance', 'Vigilance moderee', 'Moderate vigilance');
    return tr('Comfortable', 'Confortable', 'Comfortable');
  };

  const applyAiDraftToForm = (draft: AiQuoteDraft, showSuccessToast = true) => {
    setFormData((prev) => ({
      ...prev,
      description: draft.recommendations.description.value,
      validUntil: draft.recommendations.validUntil.value,
    }));

    // Il n'y a plus de champ « Labor hand » : la recommandation de l'IA devient
    // une ligne « Main d'œuvre », modifiable comme les autres.
    const suggestedLabor = Number(draft.recommendations.laborHand.value) || 0;
    if (suggestedLabor > 0) {
      setQuoteLines((prev) => [
        ...prev,
        {
          designation: tr('Labor (AI suggestion)', "Main d'œuvre (suggestion IA)", 'يد عاملة (اقتراح الذكاء الاصطناعي)'),
          quantity: 1,
          unit: 'aucun',
          unitPrice: suggestedLabor,
          lineType: 'labor' as const,
          total: suggestedLabor,
        },
      ]);
    }
    setErrors({});
    setTouched({});

    if (showSuccessToast) {
      toast.success(
        tr(
          'AI recommendations applied. Review and edit if needed.',
          'Recommandations IA appliquees. Verifiez et ajustez si necessaire.',
          'AI recommendations applied. Review and edit if needed.'
        )
      );
    }
  };

  const handleGenerateAiDraft = async () => {
    if (!formData.project) {
      const projectError = validateField('project', '');
      setTouched((prev) => ({ ...prev, project: true }));
      setErrors((prev) => ({ ...prev, project: projectError }));
      toast.warning(tr('Please select a project first.', 'Veuillez d abord selectionner un projet.', 'Please select a project first.'));
      return;
    }

    const token = getToken();
    if (!token) {
      toast.error(tr('Authentication required.', 'Authentification requise.', 'Authentication required.'));
      return;
    }

    if (!selectedProject) {
      toast.warning(tr('Selected project was not found.', 'Le projet selectionne est introuvable.', 'Selected project was not found.'));
      return;
    }

    const marketplaceCount = Array.isArray(selectedProject.materials) ? selectedProject.materials.length : 0;
    const personalCount = Array.isArray(selectedProject.personalMaterials) ? selectedProject.personalMaterials.length : 0;
    if (marketplaceCount + personalCount <= 0) {
      toast.warning(
        tr(
          'Add at least one material before generating AI quote recommendations.',
          'Ajoutez au moins un materiau avant de generer les recommandations IA.',
          'Add at least one material before generating AI quote recommendations.'
        )
      );
      return;
    }

    setIsGeneratingAiDraft(true);
    setAiDraftError('');

    try {
      const response = await axios.post<AiQuoteDraft>(
        `${API_URL}/quotes/ai-draft`,
        {
          projectId: formData.project,
          clientName: formData.clientName,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setAiDraft(response.data);
      applyAiDraftToForm(response.data, false);
      toast.success(
        tr(
          'AI draft generated and prefilled. Review the explanations before submitting.',
          'Brouillon IA genere et pre-rempli. Verifiez les explications avant validation.',
          'AI draft generated and prefilled. Review the explanations before submitting.'
        )
      );
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      const fallbackMessage = tr(
        'Unable to generate AI draft right now.',
        'Impossible de generer le brouillon IA pour le moment.',
        'Unable to generate AI draft right now.'
      );
      setAiDraftError(backendMessage || fallbackMessage);
      toast.error(backendMessage || fallbackMessage);
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  // Metier de l'artisan : sert uniquement a mettre le bon modele en avant.
  // Chargement non bloquant, la galerie fonctionne sans.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    axios
      .get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setArtisanDomain((data?.user ?? data)?.domain || ''))
      .catch(() => {});
  }, []);

  const showOverlayToast = (msg: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const persistRedirectToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    sessionStorage.setItem(
      'artisan:redirect-toast',
      JSON.stringify({ message, type })
    );
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingProjectId = params.get('projectId');
    if (incomingProjectId) {
      setProjectFromQuery(incomingProjectId);
      setActiveDraftId(null);
      setView('create');
    }
  }, []);

  /**
   * Retour du Marketplace : on rouvre le bon brouillon, puis on y verse la
   * selection.
   *
   * L'ordre compte. Les brouillons sont hydrates depuis `localStorage` par un
   * autre effet ; lire `drafts` avant qu'il ait tourne donnerait un tableau
   * vide et le brouillon serait introuvable. D'ou l'attente de
   * `isDraftsLoaded`.
   */
  useEffect(() => {
    if (!isDraftsLoaded) return;

    const params = new URLSearchParams(window.location.search);
    const draftId = params.get('quoteDraftId');
    if (!draftId) return;

    const brouillon = drafts.find((draft) => draft.id === draftId);
    if (!brouillon) return;

    handleResumeDraft(brouillon);

    // Nettoyage de l'adresse, comme le fait le tableau de bord pour
    // `artisanView` : le parametre a fait son office.
    params.delete('quoteDraftId');
    params.delete('artisanView');
    const reste = params.toString();
    window.history.replaceState({}, '', reste ? `/?${reste}` : '/');
  }, [isDraftsLoaded, drafts]);

  /**
   * Verse la selection dans le devis une fois celui-ci rouvert.
   *
   * Separe de l'effet precedent a dessein : `handleResumeDraft` passe par
   * `guard()`, qui n'ouvre rien si l'abonnement a expire. On attend donc de
   * CONSTATER que le brouillon est actif avant de consommer la selection ; en
   * cas de blocage, elle reste en attente au lieu d'etre perdue.
   */
  useEffect(() => {
    if (!activeDraftId || view !== 'create') return;

    let charge: { draftId?: string; produits?: MarketplaceProduct[] } | null = null;
    try {
      const brut = sessionStorage.getItem(MARKETPLACE_SELECTION_KEY);
      if (!brut) return;
      charge = JSON.parse(brut);
    } catch {
      sessionStorage.removeItem(MARKETPLACE_SELECTION_KEY);
      return;
    }

    if (!charge || charge.draftId !== activeDraftId) {
      // Selection destinee a un autre devis : on l'ecarte plutot que de
      // risquer d'inserer des lignes dans le mauvais.
      if (charge && charge.draftId) sessionStorage.removeItem(MARKETPLACE_SELECTION_KEY);
      return;
    }

    sessionStorage.removeItem(MARKETPLACE_SELECTION_KEY);
    if (Array.isArray(charge.produits) && charge.produits.length > 0) {
      addLinesFromMarketplace(charge.produits);
    }
  }, [activeDraftId, view]);

  // --- CHARGEMENT DES DONNÉES ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const token = getToken();
        if (!token) return;

        if (view === 'list') {
          const resQuotes = await axios.get(`${API_URL}/quotes`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setQuotes(resQuotes.data);
        }

        if (view === 'create') {
          const resProjects = await axios.get(`${API_URL}/projects`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setProjects(resProjects.data);

          if (projectFromQuery) {
            const exists = resProjects.data.some((proj: any) => proj._id === projectFromQuery && isProjectEligibleForQuote(proj));
            if (exists) {
              setFormData((prev) => ({ ...prev, project: prev.project || projectFromQuery }));
            }
          }
        }
      } catch (error) {
        console.error("Erreur de chargement:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [view, API_URL, projectFromQuery]);

  // After the main useEffect for data fetching
  useEffect(() => {
    if (selectedQuote) {
      document.title = `Quote ${selectedQuote.quoteNumber} - BMP Marketplace`;
    }
    return () => {
      document.title = 'BMP Marketplace'; // Reset to default
    };
  }, [selectedQuote]);  

  // --- FONCTIONS DE VALIDATION ---
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'project': {
        if (!value) return 'Project is required';
        if (!availableProjects.some((proj) => proj._id === value)) return 'Selected project is already completed';
        /**
         * Un devis n'a jamais eu besoin de porter un materiau.
         *
         * Une regle exigeait ici au moins un materiau — marketplace ou
         * personnel — sur le projet. Elle interdisait des devis parfaitement
         * legitimes : nettoyage, diagnostic, petite reparation, ou peinture
         * dont le client fournit deja le produit. Elle n'existait qu'ici :
         * `createQuote` cote serveur n'a jamais rien verifie de tel.
         */
        return '';
      }
      case 'clientName':
        return !value ? 'Client name is required' : '';
      case 'description':
        if (!value) return 'Description is required';
        if (value.length < 10) return 'Description must be at least 10 characters';
        return '';
      case 'validUntil':
        if (!value) return 'Valid until date is required';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const validDate = new Date(value);
        if (validDate <= today) return 'Valid until must be a future date';
        return '';
      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    // laborHand / paymentType / upfrontValue ont disparu du formulaire : le devis
    // se construit desormais entierement depuis les lignes et l'echeancier.
    const fields = ['project', 'clientName', 'description', 'validUntil'];
    for (const field of fields) {
      if (validateField(field, formData[field as keyof typeof formData])) return false;
    }
    // Le devis se construit uniquement depuis le tableau : au moins une ligne,
    // et un montant strictement positif une fois les prix unitaires saisis.
    if (quoteLines.length === 0) return false;
    if (totalAmount <= 0) return false;
    return true;
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof typeof formData]);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  // --- CRÉATION DE DEVIS ---
  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const token = getToken();
      // Le resume textuel reprend desormais l'echeancier a N tranches.
      const paymentTermsSummary = computedTranches
        .map((tranche) => `${tranche.label}: ${tranche.percentage.toFixed(2)}% (${tranche.amount.toFixed(2)} TND)`)
        .join(' | ');

      await axios.post(`${API_URL}/quotes`, {
        ...formData,
        // Repli pour les integrations historiques : le backend recalcule ces
        // deux montants depuis quoteLines des qu'elles sont presentes.
        laborHand: linesLaborTotal,
        materialsAmount: linesMaterialsTotal,
        paymentTerms: paymentTermsSummary,
        upfrontPercent: computedTranches.length > 0 ? computedTranches[0].percentage : 0,
        quoteLines,
        paymentSchedule: computedTranches,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Quote generated successfully!');
      clearCurrentDraft();
      setFormData({ ...initialFormData });
      setQuoteLines([]);
      setImportedMaterialKeys([]);
      setMarketplaceProductKeys([]);
      setPaymentSchedule(defaultPaymentSchedule());
      setErrors({});
      setTouched({});
      setAiDraft(null);
      setAiDraftError('');
      setView('list');
    } catch (error: any) {
      console.error('Error creating quote:', error);
      // Le serveur nomme la tranche fautive et la regle violee : un « Failed
      // to create quote » generique obligeait a deviner ce qui n'allait pas.
      const backendMessage = error?.response?.data?.message;
      toast.error(backendMessage || tr(
        'Failed to create quote.',
        'La création du devis a échoué.',
        'فشل إنشاء العرض.'
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- METTRE À JOUR LE STATUT (Approved / Rejected) ---
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const token = getToken();
      const response = await axios.put(`${API_URL}/quotes/${id}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuotes((prev) => prev.map((quote) => (quote._id === id ? { ...quote, status: newStatus } : quote)));
      if (selectedQuote?._id === id) {
        setSelectedQuote({ ...selectedQuote, ...response.data, status: newStatus });
      }
      toast.success(`Quote marked as ${newStatus}!`);

      if (newStatus === 'approved' && selectedQuote?._id === id) {
        setTimeout(() => {
          invoiceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    } catch (error: any) {
      console.error("Error updating status:", error);
      const backendMessage = error?.response?.data?.message;
      toast.error(backendMessage || 'Failed to update quote status');
    }
  };

  const handleDownloadQuotePdf = async (quote: any) => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await axios.get(`${API_URL}/quotes/${quote._id}/pdf`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileURL;
      link.download = `${quote.quoteNumber || 'quote'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(fileURL);
    } catch (error) {
      console.error('Error downloading quote PDF:', error);
      toast.error('Failed to generate quote PDF');
    }
  };

  const handleGenerateInvoiceFromQuote = async () => {
    const targetQuote = invoiceTargetQuote || selectedQuote;
    if (!targetQuote?._id) return;
    if (!invoiceDueDate) {
      showOverlayToast('Please choose a due date', 'warning');
      return;
    }

    setIsGeneratingInvoice(true);
    try {
      const token = getToken();
      await axios.post(
        `${API_URL}/invoices/from-quote/${targetQuote._id}`,
        { dueDate: invoiceDueDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowInvoiceModal(false);
      setInvoiceDueDate('');
      setInvoiceTargetQuote(null);
      showOverlayToast('Invoice generated successfully', 'success');
      persistRedirectToast('Invoice generated successfully', 'success');
      setTimeout(() => {
        window.location.href = '/?artisanView=invoices';
      }, 1200);
    } catch (error: any) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.message;

      // Fallback for environments still running an older backend without from-quote route.
      if (status === 404) {
        try {
          const token = getToken();
          const issueDate = new Date().toISOString().split('T')[0];
          await axios.post(
            `${API_URL}/invoices`,
            {
              project: targetQuote.project?._id || targetQuote.project,
              clientName: targetQuote.clientName || 'Client',
              amount: Number(targetQuote.amount || 0),
              description: `Invoice generated from quote ${targetQuote.quoteNumber}.\n\n${targetQuote.description || ''}`,
              issueDate,
              dueDate: invoiceDueDate,
              upfrontPercent: Number(targetQuote.upfrontPercent) || 50,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          setShowInvoiceModal(false);
          setInvoiceDueDate('');
          setInvoiceTargetQuote(null);
          showOverlayToast('Invoice generated successfully', 'success');
          persistRedirectToast('Invoice generated successfully', 'success');
          setTimeout(() => {
            window.location.href = '/?artisanView=invoices';
          }, 1200);
          return;
        } catch (fallbackError: any) {
          const fallbackMessage = fallbackError?.response?.data?.message;
          showOverlayToast(fallbackMessage || 'Failed to generate invoice', 'error');
          return;
        }
      }

      if (status === 409) {
        showOverlayToast('Invoice already exists for this quote', 'warning');
      } else {
        showOverlayToast(backendMessage || 'Failed to generate invoice from quote', 'error');
      }
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const openGenerateInvoiceModal = (quote: any) => {
    setInvoiceTargetQuote(quote);
    setInvoiceDueDate('');
    setShowInvoiceModal(true);
  };

  const openDeleteQuoteModal = (quote: any) => {
    setQuoteToDelete(quote);
    setDeleteQuoteError(null);
    setShowDeleteQuoteModal(true);
  };

  const handleDeleteQuote = async () => {
    if (!quoteToDelete?._id) return;

    setIsDeletingQuote(true);
    try {
      const token = getToken();
      await axios.delete(`${API_URL}/quotes/${quoteToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const deletedNumber = quoteToDelete.quoteNumber;
      setQuotes((prev) => prev.filter((item) => item._id !== quoteToDelete._id));
      if (selectedQuote?._id === quoteToDelete._id) {
        setSelectedQuote(null);
        setView('list');
      }

      setShowDeleteQuoteModal(false);
      setQuoteToDelete(null);
      showOverlayToast(`Quote ${deletedNumber} deleted successfully.`, 'success');
    } catch (error: any) {
      console.error('Error deleting quote:', error);
      const message = error?.response?.data?.message || 'Failed to delete quote';
      setDeleteQuoteError(message);
    } finally {
      setIsDeletingQuote(false);
    }
  };

  const renderToast = () => {
    if (!toastMessage) return null;

    const styleByType = {
      success: 'bg-black text-white border border-zinc-900',
      warning: 'bg-amber-700 text-white border border-amber-800',
      error: 'bg-red-700 text-white border border-red-800',
    } as const;

    return (
      <div className="w-full px-3 md:px-6 flex justify-center pointer-events-none">
        <div className={`w-full max-w-md text-center px-5 py-3 rounded-xl shadow-2xl flex items-center justify-center gap-2 font-semibold ${styleByType[toastType]} transition-transform duration-200`}>
          <CheckCircle size={18} className="shrink-0 text-white" />
          <span>{toastMessage}</span>
        </div>
      </div>
    );
  };

  const renderInvoiceConfirmBar = () => (
    showInvoiceModal ? (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] pointer-events-auto">
        <div className="mx-4 w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={32} className="text-muted-foreground" />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-2">{tr('Generate Invoice?', 'Generer une facture ?', 'Generate Invoice?')}</h3>
              <p className="text-muted-foreground font-medium">{invoiceTargetQuote?.quoteNumber || selectedQuote?.quoteNumber}</p>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="dueDateOverlay" className="text-base">{tr('Due Date', 'Date d\'echeance')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleInvoiceDueDateSpeech}
                  disabled={!isSpeechSupported}
                  aria-pressed={isDueDateListening}
                  aria-label={
                    isDueDateListening
                      ? tr('Stop voice input', 'Arreter la dictee vocale', 'Stop voice input')
                      : tr('Start voice input', 'Demarrer la dictee vocale', 'Start voice input')
                  }
                  className={`h-9 rounded-lg border ${isDueDateListening ? 'border-red-500 text-red-600' : 'border-border text-muted-foreground'}`}
                >
                  {isDueDateListening ? <MicOff size={16} className="mr-2" /> : <Mic size={16} className="mr-2" />}
                  {isDueDateListening ? tr('Listening...', 'Ecoute...', 'Listening...') : tr('Dictee', 'Dictee', 'Dictee')}
                  {isDueDateListening && <span className="ml-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />}
                </Button>
              </div>
              <Input
                id="dueDateOverlay"
                type="date"
                min={todayLocalDate}
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                className="h-12 rounded-xl border-2 border-border"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 border-border bg-card text-foreground font-semibold hover:bg-muted/50 hover:border-gray-400 transition-all"
                onClick={() => {
                  setShowInvoiceModal(false);
                  setInvoiceDueDate('');
                  setInvoiceTargetQuote(null);
                }}
                disabled={isGeneratingInvoice}
              >
                {tr('No', 'Non', 'No')}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 border-border bg-card text-foreground font-semibold hover:bg-muted/50 hover:border-gray-400 transition-all"
                onClick={handleGenerateInvoiceFromQuote}
                disabled={isGeneratingInvoice}
              >
                {isGeneratingInvoice ? tr('Yes...', 'Oui...', 'Yes...') : tr('Yes', 'Oui', 'Yes')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    ) : null
  );

  const renderDeleteQuoteConfirmBar = () => (
    showDeleteQuoteModal ? (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] pointer-events-auto">
        <div className="mx-4 w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${deleteQuoteError ? 'bg-amber-50' : 'bg-red-50'}`}>
                <Trash2 size={32} className={deleteQuoteError ? 'text-amber-600' : 'text-red-600'} />
              </div>
              <h3 className="text-3xl font-bold text-foreground mb-2">{tr('Delete Quote?', 'Supprimer le devis ?', 'Delete Quote?')}</h3>
              <p className="text-muted-foreground font-medium">{quoteToDelete?.quoteNumber || ''}</p>
              {deleteQuoteError ? (
                <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium text-left">
                  ⚠️ {deleteQuoteError}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">{tr('Are you sure you want to delete this quote?', 'Voulez-vous vraiment supprimer ce devis ?', 'Are you sure you want to delete this quote?')}</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 border-border bg-card text-foreground font-semibold hover:bg-muted/50 hover:border-gray-400 transition-all"
                onClick={() => {
                  setShowDeleteQuoteModal(false);
                  setQuoteToDelete(null);
                  setDeleteQuoteError(null);
                }}
                disabled={isDeletingQuote}
              >
                {deleteQuoteError ? tr('Close', 'Fermer', 'Close') : tr('Cancel', 'Annuler', 'إلغاء')}
              </Button>
              {!deleteQuoteError && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-2 border-red-200 bg-card text-red-600 font-semibold hover:bg-red-50 hover:border-red-300 transition-all !bg-destructive !border-destructive !text-white hover:!bg-destructive/90"
                  onClick={handleDeleteQuote}
                  disabled={isDeletingQuote}
                >
                  {isDeletingQuote ? tr('Deleting...', 'Suppression...', 'Deleting...') : tr('Delete', 'Supprimer', 'حذف')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : null
  );

  const renderGlobalOverlay = () => {
    if (typeof document === 'undefined') return null;
    if (!toastMessage && !showInvoiceModal && !showDeleteQuoteModal) return null;

    return createPortal(
      <>
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none">
            {renderToast()}
          </div>
        )}
        {renderInvoiceConfirmBar()}
        {renderDeleteQuoteConfirmBar()}
      </>,
      document.body
    );
  };

  // --- DESIGN & UTILITAIRES ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-100 dark:text-emerald-700 dark:border-emerald-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-100 dark:text-amber-700 dark:border-amber-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-100 dark:text-red-700 dark:border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-100 dark:text-slate-700 dark:border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle size={20} />;
      case 'pending': return <Clock size={20} />;
      case 'rejected': return <XCircle size={20} />;
      default: return null;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatAmount = (value: number) => `${value.toLocaleString()} TND`;

  const formatSavedTime = (isoDate: string) => {
    const parsedDate = new Date(isoDate);
    if (Number.isNaN(parsedDate.getTime())) return '--:--';
    return parsedDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDraftTimestamp = (timestamp: number) => {
    const parsedDate = new Date(timestamp);
    if (Number.isNaN(parsedDate.getTime())) return '--';
    return parsedDate.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderDraftMenuButton = (buttonClassName: string) => (
    <div ref={draftMenuRef} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsDraftMenuOpen((prev) => !prev)}
        className={`relative ${buttonClassName}`}
      >
        <FileText size={18} className="mr-2" />
        {tr('Drafts', 'Brouillons', 'مسودات')}
        {drafts.length > 0 && (
          <span
            className="absolute -top-2 -right-2 z-20 flex items-center justify-center w-6 h-6 !bg-red-600 !text-white text-sm font-bold rounded-full border-2 border-white shadow-sm ring-1 ring-white"
            style={{ backgroundColor: '#dc2626', color: '#ffffff', opacity: 1 }}
          >
            {drafts.length}
          </span>
        )}
      </Button>

      {isDraftMenuOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          {drafts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center p-4">Aucun brouillon sauvegardé</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex justify-between items-center p-3 hover:bg-gray-50 border-b border-gray-50 cursor-pointer"
                  onClick={() => handleResumeDraft(draft)}
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{draft.title === 'Brouillon sans nom' ? 'Devis sans nom' : draft.title || 'Devis sans nom'}</p>
                    <p className="text-xs text-gray-400">{formatDraftTimestamp(draft.timestamp)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => handleDeleteDraft(event, draft.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    aria-label={tr('Delete draft', 'Supprimer le brouillon', 'Delete draft')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const filteredQuotes = quotes.filter((quote) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const quoteNumber = String(quote?.quoteNumber || '').toLowerCase();
    const projectTitle = String(quote?.project?.title || '').toLowerCase();
    const clientName = String(quote?.clientName || '').toLowerCase();

    const matchesSearch = !normalizedQuery
      || quoteNumber.includes(normalizedQuery)
      || projectTitle.includes(normalizedQuery)
      || clientName.includes(normalizedQuery);

    const quoteStatus = String(quote?.status || 'pending').toLowerCase();
    const matchesStatus = statusFilter === 'all' || quoteStatus === statusFilter;

    const hasInvoice = Boolean(quote?.hasInvoice);
    const matchesInvoiceFilter =
      invoiceFilter === 'all'
      || (invoiceFilter === 'withInvoice' && hasInvoice)
      || (invoiceFilter === 'withoutInvoice' && !hasInvoice);

    return matchesSearch && matchesStatus && matchesInvoiceFilter;
  });

  // ==========================================
  // VUE 0 : CHOIX DE LA METHODE
  // ==========================================
  if (view === 'choice') {
    return (
      <QuoteMethodChoice
        onSelect={handleSelectQuoteMethod}
        onBack={() => setView('list')}
      />
    );
  }

  // ==========================================
  // VUE 0 bis : GALERIE DES MODELES METIER
  // ==========================================
  if (view === 'templates') {
    return (
      <QuoteTemplateGallery
        artisanDomain={artisanDomain}
        onSelect={handleSelectTemplate}
        onBack={() => setView('choice')}
      />
    );
  }

  // ==========================================
  // VUE 0 bis-2 : IMPORT ET LECTURE D'UN PLAN
  // ==========================================
  if (view === 'planImport') {
    return (
      <PlanImport
        onRead={(lecture, template) => {
          setPlanReading(lecture);
          // Metier reconnu dans la description : on saute la galerie. Sinon
          // l'artisan choisit lui-meme, ce qui reste un parcours normal.
          if (template) {
            handleSelectTemplateForPlan(template, lecture);
            return;
          }
          setView('planTemplates');
        }}
        onBack={() => setView('choice')}
      />
    );
  }

  // ==========================================
  // VUE 0 bis-3 : CHOIX DU METIER, DEPUIS UN PLAN
  // ==========================================
  if (view === 'planTemplates') {
    return (
      <QuoteTemplateGallery
        artisanDomain={artisanDomain}
        // Seuls metiers dont les champs se lisent sur un plan. Plomberie et
        // Electricite en sont exclus : leurs listes de points ne s'y ecrivent
        // pas, les proposer reviendrait a deviner.
        allowedIds={['carreleur-salle-de-bain-8m2', 'peintre-piece-25m2']}
        onSelect={handleSelectTemplateForPlan}
        onBack={() => setView('planImport')}
      />
    );
  }

  // ==========================================
  // VUE 0 ter : PARAMETRES D'UN MODELE AUTO-CALCULE
  // ==========================================
  if (view === 'planRooms' && planRooms) {
    return (
      <PlanRoomPicker
        candidats={planRooms.candidats}
        unite={planRooms.unite}
        onConfirm={handleConfirmPlanRooms}
        onSkip={() => setView('templateParams')}
        onBack={() => setView('planTemplates')}
      />
    );
  }

  if (view === 'templateParams' && pendingTemplate) {
    return (
      <QuoteTemplateParams
        template={pendingTemplate}
        prefill={Object.keys(planPrefill).length > 0 ? planPrefill : undefined}
        notes={Object.keys(planNotes).length > 0 ? planNotes : undefined}
        missingInput={planMursPrompt ? {
          champ: planMursPrompt.champ,
          message: tr(
            'No ceiling height found on this plan. Enter it to compute the wall surfaces automatically from the room dimensions.',
            'Hauteur sous plafond non trouvée sur ce plan. Indiquez-la pour calculer automatiquement la surface des murs à partir des dimensions de la pièce.',
            'لم يتم العثور على ارتفاع السقف في هذا المخطط.'
          ),
          label: tr('Ceiling height', 'Hauteur sous plafond', 'ارتفاع السقف'),
          unit: 'm',
          // Un exemple, pas un defaut : rien n'est saisi a la place de l'artisan.
          placeholder: tr('e.g. 2.50', 'ex : 2,50', '2,50'),
          caveat: planMursPrompt.mention,
          buildItems: (valeur: number) => construireMurs(planMursPrompt.candidats, valeur),
        } : undefined}
        onGenerated={applyTemplateLines}
        backLabel={
          planReading && planRooms
            ? tr('Back to the plan measurements', 'Retour aux mesures du plan', 'العودة إلى قياسات المخطط')
            : undefined
        }
        onBack={() => {
          /**
           * On revient sur ses pas, pas sur le choix du metier. Depuis un
           * plan, l'artisan qui recule veut le plus souvent corriger sa
           * selection de pieces ou revoir ce qui a ete lu — pas changer de
           * metier. La galerie ne reste la destination que faute de mesures
           * a revoir.
           *
           * Le modele n'est oublie QUE si l'on repart vers une galerie : en
           * revenant aux mesures, le metier reste choisi, et l'effacer
           * empecherait de revenir au formulaire apres correction.
           */
          if (planReading && planRooms) {
            setView('planRooms');
            return;
          }
          setPendingTemplate(null);
          setView(planReading ? 'planTemplates' : 'templates');
        }}
      />
    );
  }

  // ==========================================
  // VUE 1 : CRÉATION
  // ==========================================
  if (view === 'create') {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-8">
        <Button variant="outline" onClick={handleBackFromCreateQuote} className="mb-6 rounded-lg border border-gray-300 shadow-sm">
          <ArrowRight size={20} className="mr-2 rotate-180" />{' '}
          {planReading && planRooms
            ? tr('Back to the plan measurements', 'Retour aux mesures du plan', 'العودة إلى قياسات المخطط')
            : tr('Back to Quotes', 'Retour aux devis', 'العودة إلى العروض')}
        </Button>
        <Card className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <h2 className="text-3xl font-bold text-foreground">{tr('Generate New Quote', 'Generer un nouveau devis', 'إنشاء عرض أسعار جديد')}</h2>
            <button
              type="button"
              onClick={() => setIsAIOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2 font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
              aria-expanded={isAIOpen}
              aria-controls="ai-assistant-sidebar"
            >
              {isAIOpen ? <X size={16} /> : <Sparkles size={16} />}
              <span>{isAIOpen ? tr('Close AI Assistant', 'Fermer l\'Assistant IA', 'Fermer l\'Assistant IA') : tr('AI Assistant', 'Assistant IA', 'Assistant IA')}</span>
            </button>
          </div>

          {(isSaving || lastSavedAt) && (
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full w-fit">
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sauvegarde en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={14} className="text-emerald-600" />
                  <span>Brouillon sauvegardé à {formatSavedTime(lastSavedAt || '')}</span>
                </>
              )}
            </div>
          )}

          <form
            className="flex flex-col lg:flex-row gap-8 w-full max-w-7xl mx-auto items-start"
            onSubmit={handleCreateQuote}
            noValidate
          >
            <div className="flex-1 min-w-0 transition-all duration-300 space-y-6">
              {/* Projet */}
              <div className="space-y-2">
                <Label htmlFor="project" className="text-base font-semibold">
                  Select Project <span style={{ color: 'red' }}>*</span>
                </Label>
                <select
                  id="project"
                  value={formData.project}
                  onChange={(e) => {
                    setFormData({ ...formData, project: e.target.value });
                    // Les cles memorisees appartiennent au projet precedent.
                    setImportedMaterialKeys([]);
                    if (touched.project) setErrors(prev => ({ ...prev, project: validateField('project', e.target.value) }));
                  }}
                  onBlur={() => handleBlur('project')}
                  className={`h-12 w-full rounded-lg border bg-card px-4 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    touched.project && errors.project ? 'border-red-500' : 'border-border'
                  }`}
                >
                  <option value="">Choose a project...</option>
                  {availableProjects.map((proj) => (
                    <option key={proj._id} value={proj._id}>{proj.title}</option>
                  ))}
                </select>
                {availableProjects.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active projects available for quotes.</p>
                )}
                {touched.project && errors.project && (
                  <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.project}</p>
                )}
              </div>

              {/* Client */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="clientName" className="text-base font-semibold">
                    Client Name <span style={{ color: 'red' }}>*</span>
                  </Label>
                  {renderSpeechButton('clientName')}
                </div>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => {
                    applyFieldValue('clientName', e.target.value);
                  }}
                  onBlur={() => handleBlur('clientName')}
                  placeholder="Client full name"
                  className={`h-12 w-full rounded-lg border bg-card shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    touched.clientName && errors.clientName ? 'border-red-500' : 'border-border'
                  }`}
                />
                {touched.clientName && errors.clientName && (
                  <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.clientName}</p>
                )}
              </div>

              {/* Lignes du devis : unique mode de saisie, en devis libre comme
                  depuis un modele metier. Toujours affichee, meme vide. */}
              <section className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold text-foreground">
                      {tr('Quote lines', 'Lignes du devis', 'سطور العرض')} <span style={{ color: 'red' }}>*</span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {pendingProjectMaterials.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={addLinesFromProjectMaterials}
                        >
                          <Package size={14} className="mr-1" />
                          {tr(
                            `From project materials (${pendingProjectMaterials.length} left)`,
                            `Depuis les matériaux du projet (${pendingProjectMaterials.length} restants)`,
                            `من مواد المشروع (${pendingProjectMaterials.length})`
                          )}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg bg-secondary text-white hover:bg-secondary/90"
                        onClick={handleGoToMarketplace}
                      >
                        <ShoppingCart size={14} className="mr-1" />
                        {tr('Add from marketplace', 'Ajouter depuis le marketplace', 'إضافة من السوق')}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={addQuoteLine}>
                        <Plus size={14} className="mr-1" />
                        {tr('Add a line', 'Ajouter une ligne', 'أضف سطرًا')}
                      </Button>
                    </div>
                  </div>

                  {showMarketplacePicker && (
                    <MarketplaceMaterialPicker
                      alreadyAddedIds={marketplaceProductKeys}
                      onAdd={addLinesFromMarketplace}
                      onClose={() => setShowMarketplacePicker(false)}
                    />
                  )}

                  {quoteLines.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                      {tr(
                        'Add at least one line to build the quote.',
                        'Ajoutez au moins une ligne pour construire le devis.',
                        'أضف سطرًا واحدًا على الأقل لإنشاء العرض.'
                      )}
                    </p>
                  )}

                  <div className="overflow-x-auto">
                    {/*
                      Les colonnes de droite portent des controles de largeur
                      fixe ; `w-full` sur la designation lui fait absorber tout
                      l'espace restant, et `min-w-[15rem]` garantit qu'elle ne
                      soit jamais ecrasee.
                      Le tableau n'a plus de `min-w` propre : la somme des
                      minimums de colonnes (~817 px) le contraint deja. Deux
                      nombres pour une seule regle finissaient par diverger,
                      et celui du tableau declenchait le defilement horizontal
                      60 px trop tot.
                      Mesures relevees dans un navigateur : la designation
                      recoit 677 px a 1280, 421 px a 1024, 297 px a 900, et ne
                      descend jamais sous 240 px. La plus longue designation
                      produite par les modeles tient sur une ligne des 1024 px,
                      sur deux en dessous. Jamais tronquee.
                    */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="w-full min-w-[15rem] pb-2 pr-3 font-semibold">
                            {tr('Designation', 'Désignation', 'التسمية')}
                          </th>
                          <th className="pb-2 pr-3 font-semibold">{tr('Qty', 'Qté', 'الكمية')}</th>
                          <th className="pb-2 pr-3 font-semibold">{tr('Unit', 'Unité', 'الوحدة')}</th>
                          <th className="pb-2 pr-3 font-semibold">{tr('Unit price', 'Prix unitaire', 'سعر الوحدة')}</th>
                          <th className="pb-2 pr-3 font-semibold">{tr('Type', 'Type', 'النوع')}</th>
                          <th className="pb-2 pr-3 font-semibold text-right">{tr('Total', 'Total', 'المجموع')}</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {quoteLines.map((line, index) => (
                          <tr key={index} className="border-t border-border">
                            <td className="w-full min-w-[15rem] py-2 pr-3 align-top">
                              {/*
                                Un `<input>` ne revient jamais a la ligne : la
                                designation « Peinture de finition mat (2
                                couches) — ≈ 1 bidon de 10 L » se coupait apres
                                le tiret et la quantite disparaissait. Elle fait
                                partie de ce que l'artisan doit lire.
                              */}
                              <AutoGrowTextarea
                                aria-label={tr('Designation', 'Désignation', 'التسمية')}
                                value={line.designation}
                                onChange={(e) => updateQuoteLine(index, { designation: e.target.value })}
                              />
                            </td>
                            <td className="py-2 pr-3 align-top">
                              <Input
                                aria-label={tr('Quantity', 'Quantité', 'الكمية')}
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.quantity}
                                onChange={(e) => updateQuoteLine(index, { quantity: Number(e.target.value) })}
                                className="h-10 w-20 rounded-lg"
                              />
                            </td>
                            <td className="py-2 pr-3 align-top">
                              <select
                                aria-label={tr('Unit', 'Unité', 'الوحدة')}
                                value={line.unit}
                                onChange={(e) => updateQuoteLine(index, { unit: e.target.value })}
                                className="h-10 w-24 rounded-lg border border-border bg-card px-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {QUOTE_UNITS.map((unit) => (
                                  <option key={unit} value={unit}>{unit}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 pr-3 align-top">
                              <Input
                                aria-label={tr('Unit price', 'Prix unitaire', 'سعر الوحدة')}
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.unitPrice}
                                onChange={(e) => updateQuoteLine(index, { unitPrice: Number(e.target.value) })}
                                className="h-10 w-28 rounded-lg"
                              />
                            </td>
                            <td className="py-2 pr-3 align-top">
                              <select
                                aria-label={tr('Line type', 'Type de ligne', 'نوع السطر')}
                                value={line.lineType}
                                onChange={(e) =>
                                  updateQuoteLine(index, {
                                    lineType: e.target.value as QuoteTemplateLine['lineType'],
                                  })
                                }
                                className="h-10 w-32 rounded-lg border border-border bg-card px-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="material">{tr('Material', 'Matériau', 'مادة')}</option>
                                <option value="labor">{tr('Labor', "Main d'œuvre", 'يد عاملة')}</option>
                              </select>
                            </td>
                            <td className="py-2 pr-3 text-right align-top font-semibold whitespace-nowrap">
                              {formatAmount(line.total)}
                            </td>
                            <td className="py-2 align-top">
                              <button
                                type="button"
                                aria-label={tr('Remove line', 'Supprimer la ligne', 'حذف السطر')}
                                onClick={() => removeQuoteLine(index)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap justify-end gap-6 border-t border-border pt-3 text-sm">
                    <p>
                      <span className="text-muted-foreground mr-2">{tr('Labor', "Main d'œuvre", 'يد عاملة')}</span>
                      <span className="font-semibold">{formatAmount(linesLaborTotal)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground mr-2">{tr('Materials', 'Matériaux', 'مواد')}</span>
                      <span className="font-semibold">{formatAmount(linesMaterialsTotal)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground mr-2">{tr('Total', 'Total', 'المجموع')}</span>
                      <span className="font-bold text-primary">{formatAmount(linesLaborTotal + linesMaterialsTotal)}</span>
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {tr(
                      'Labor and materials totals are computed from these lines.',
                      "La main d'œuvre et les matériaux sont calculés à partir de ces lignes.",
                      'يتم احتساب اليد العاملة والمواد من هذه السطور.'
                    )}
                  </p>
              </section>


              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="description" className="text-base font-semibold">
                    Description <span style={{ color: 'red' }}>*</span>
                  </Label>
                  {renderSpeechButton('description')}
                </div>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => {
                    applyFieldValue('description', e.target.value);
                  }}
                  onBlur={() => handleBlur('description')}
                  placeholder="Describe the work, materials, and services included..."
                  rows={6}
                  className={`w-full rounded-lg border bg-card shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    touched.description && errors.description ? 'border-red-500' : 'border-border'
                  }`}
                />
                {touched.description && errors.description && (
                  <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.description}</p>
                )}
              </div>

              {/* Valid Until et Payment Terms */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Valid Until */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="validUntil" className="text-base font-semibold">
                      Valid Until <span style={{ color: 'red' }}>*</span>
                    </Label>
                    {renderSpeechButton('validUntil')}
                  </div>
                  <Input
                    id="validUntil"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => {
                      applyFieldValue('validUntil', e.target.value);
                    }}
                    onBlur={() => handleBlur('validUntil')}
                    className={`h-12 w-full rounded-lg border bg-card shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      touched.validUntil && errors.validUntil ? 'border-red-500' : 'border-border'
                    }`}
                  />
                  {touched.validUntil && errors.validUntil && (
                    <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.validUntil}</p>
                  )}
                </div>
              </div>

              {/* Payment Schedule : N tranches librement definies */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <Label className="text-base font-semibold">
                    {tr('Payment Schedule', 'Échéancier de paiement', 'جدول الدفع')}{' '}
                    <span style={{ color: 'red' }}>*</span>
                  </Label>
                  <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={addTranche}>
                    <Plus size={14} className="mr-1" />
                    {tr('Add a tranche', 'Ajouter une tranche', 'أضف قسطًا')}
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-3 font-semibold">{tr('Label', 'Libellé', 'التسمية')}</th>
                        <th className="p-3 font-semibold">{tr('Type', 'Type', 'النوع')}</th>
                        <th className="p-3 font-semibold">{tr('Value', 'Valeur', 'القيمة')}</th>
                        <th className="p-3 font-semibold text-right">{tr('Amount', 'Montant', 'المبلغ')}</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {paymentSchedule.map((tranche, index) => {
                        const computed = computedTranches[index];
                        const isRemaining = tranche.type === 'remaining';
                        return (
                          <tr key={index} className="border-b last:border-0">
                            <td className="p-3">
                              <Input
                                aria-label={tr('Tranche label', 'Libellé de la tranche', 'تسمية القسط')}
                                value={tranche.label}
                                onChange={(e) => updateTranche(index, { label: e.target.value })}
                                placeholder={tr('Deposit', 'Acompte', 'دفعة')}
                                className="h-10 rounded-lg"
                              />
                            </td>
                            <td className="p-3">
                              <select
                                aria-label={tr('Tranche type', 'Type de tranche', 'نوع القسط')}
                                value={tranche.type}
                                onChange={(e) => updateTranche(index, { type: e.target.value as TrancheType })}
                                className="h-10 w-48 rounded-lg border border-border bg-card px-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="fixed">{tr('Fixed amount (TND)', 'Montant fixe (TND)', 'مبلغ ثابت')}</option>
                                <option value="percent">{tr('Percentage (%)', 'Pourcentage (%)', 'نسبة مئوية')}</option>
                                <option value="percentOfRemaining">{tr('% of remaining', '% du restant', '% من المتبقي')}</option>
                                <option value="remaining">{tr('Remaining balance', 'Solde restant', 'الرصيد المتبقي')}</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <Input
                                aria-label={tr('Tranche value', 'Valeur de la tranche', 'قيمة القسط')}
                                type="number"
                                min="0"
                                step="0.01"
                                disabled={isRemaining}
                                value={isRemaining ? '' : tranche.value}
                                onChange={(e) => updateTranche(index, { value: Number(e.target.value) })}
                                className="h-10 w-28 rounded-lg disabled:bg-muted disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="p-3 text-right font-semibold whitespace-nowrap">
                              {formatAmount(computed?.amount || 0)}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {(computed?.percentage || 0).toFixed(2)}%
                              </span>
                            </td>
                            <td className="p-3">
                              <button
                                type="button"
                                aria-label={tr('Remove tranche', 'Supprimer la tranche', 'حذف القسط')}
                                onClick={() => removeTranche(index)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                    isScheduleBalanced
                      ? 'border-border bg-muted/50'
                      : 'border-destructive/40 bg-destructive/5'
                  }`}
                >
                  <span className="text-muted-foreground">
                    {tr('Scheduled total', 'Total des tranches', 'مجموع الأقساط')}
                  </span>
                  <span className={isScheduleBalanced ? 'font-semibold text-foreground' : 'font-semibold text-destructive'}>
                    {formatAmount(scheduleSum)} / {formatAmount(totalAmount)}
                  </span>
                </div>

                {!isScheduleBalanced && (
                  <p className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle size={14} />
                    {tr(
                      'The tranches must add up to the quote total.',
                      'La somme des tranches doit correspondre au total du devis.',
                      'يجب أن يساوي مجموع الأقساط إجمالي العرض.'
                    )}
                  </p>
                )}

                {isScheduleBalanced && hasRemainingTranche && (
                  <p className="text-xs text-muted-foreground">
                    {tr(
                      'The "Remaining balance" tranche absorbs any difference automatically.',
                      'La tranche « Solde restant » absorbe automatiquement tout écart.',
                      'يمتص قسط « الرصيد المتبقي » أي فرق تلقائيًا.'
                    )}
                  </p>
                )}
              </div>

              {/* Boutons */}
              <div className="mt-8 flex flex-wrap justify-start gap-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || !validateForm() || !canSubmitSchedule}
                  className="rounded-lg !border-[#1E40AF] !bg-[#1E40AF] px-6 py-2.5 font-medium !text-white shadow-sm transition-colors hover:!bg-[#1B3A99] disabled:cursor-not-allowed disabled:!border-[#1E40AF] disabled:!bg-[#1E40AF] disabled:!text-white disabled:!opacity-100"
                >
                  {isSubmitting ? 'Generating...' : 'Generate Quote'}
                </Button>
                <Button
                  type="button"
                  onClick={handleExitCreateQuote}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                  Cancel
                </Button>
              </div>
            </div>

            {isAIOpen && (
              <aside
                id="ai-assistant-sidebar"
                className="w-full lg:w-96 shrink-0 sticky top-6 transition-all duration-300"
              >
              <Card className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-md border border-indigo-100 bg-white px-3 py-1 text-sm font-semibold text-indigo-800">
                    <Sparkles size={14} />
                    AI Assistant
                  </div>

                  <p className="text-sm leading-relaxed text-slate-600">
                    {tr(
                      'Generate clear and editable suggestions for your quote.',
                      'Generez des suggestions claires et modifiables pour votre devis.',
                      'Generate clear and editable suggestions for your quote.'
                    )}
                  </p>

                  <Button
                    type="button"
                    onClick={handleGenerateAiDraft}
                    disabled={isGeneratingAiDraft || isSubmitting}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGeneratingAiDraft ? <Gauge size={16} className="animate-pulse" /> : <Wand2 size={16} />}
                    {isGeneratingAiDraft
                      ? tr('Analyzing project...', 'Analyse du projet...', 'Analyzing project...')
                      : tr('Generate suggestions', 'Generer les suggestions', 'Generate suggestions')}
                  </Button>

                  {aiDraftError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle size={16} />
                        {tr('Unable to generate suggestions', 'Impossible de generer les suggestions', 'Unable to generate suggestions')}
                      </div>
                      <p className="mt-2">{aiDraftError}</p>
                    </div>
                  )}

                  {aiDraft && (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {tr('Risk score', 'Score de risque', 'Risk score')}
                          </p>
                          <Badge className={`border ${feasibilityBadgeClass(aiDraft.recommendations.upfront.risk.level)}`}>
                            {feasibilityLabel(aiDraft.recommendations.upfront.risk.level)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-2xl font-light tracking-tight text-slate-900">
                          {normalizeRisk(aiDraft.recommendations.upfront.risk.overall).toFixed(0)} / 100
                        </p>
                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(4, 100 - normalizeRisk(aiDraft.recommendations.upfront.risk.overall))}%`,
                              backgroundColor: feasibilityFillColor(aiDraft.recommendations.upfront.risk.level),
                            }}
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {tr('Estimated labor', 'Main-d oeuvre estimee', 'Estimated labor')}
                        </p>
                        <p className="mt-2 text-2xl font-light tracking-tight text-slate-900">
                          {formatAmount(aiDraft.recommendations.laborHand.value)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {tr(
                            'Based on duration and difficulty.',
                            'Basee sur la duree et la difficulte.',
                            'Based on duration and difficulty.'
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {tr('Recommended terms', 'Conditions recommandees', 'Recommended terms')}
                        </p>
                        <div className="mt-2 space-y-2 text-sm text-slate-700">
                          <p>
                            <strong className="text-slate-900">{tr('Recommended upfront:', 'Acompte conseille :', 'Recommended upfront:')}</strong>{' '}
                            {aiDraft.recommendations.upfront.percent.toFixed(2)}% ({tr('to secure cash flow', 'pour securiser la tresorerie', 'to secure cash flow')})
                          </p>
                          <p>
                            <strong className="text-slate-900">{tr('Recommended payment mode:', 'Mode de paiement conseille :', 'Recommended payment mode:')}</strong>{' '}
                            {aiDraft.recommendations.paymentType.value === 'percentage'
                              ? tr('Percentage', 'Pourcentage', 'Percentage')
                              : tr('Fixed amount', 'Montant fixe', 'Fixed amount')}
                          </p>
                          <p>
                            <strong className="text-slate-900">{tr('Quote validity:', 'Validite proposee :', 'Quote validity:')}</strong>{' '}
                            {formatDate(aiDraft.recommendations.validUntil.value)}
                          </p>
                          <p className="pt-1 text-xs text-slate-500">
                            {aiDraft.inference?.neighborsUsed
                              ? tr(
                                  `Based on your project context and ${aiDraft.inference.neighborsUsed} similar approved quote(s).`,
                                  `Base sur votre contexte projet et ${aiDraft.inference.neighborsUsed} devis approuve(s) similaires.`,
                                  `Based on your project context and ${aiDraft.inference.neighborsUsed} similar approved quote(s).`
                                )
                              : tr('Based on your project context.', 'Base sur votre contexte projet.', 'Based on your project context.')}
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={() => applyAiDraftToForm(aiDraft)}
                        className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-white transition-colors hover:bg-indigo-700"
                      >
                        ✨ Appliquer les suggestions de l'IA
                      </Button>

                      {(aiDraft.warnings.length > 0 || aiDraft.assumptions.length > 0) && (
                        <div className="grid gap-3 sm:grid-cols-1">
                          <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                            <p className="text-sm font-semibold text-slate-900">{tr('Points to review', 'Points a verifier', 'Points to review')}</p>
                            {aiDraft.warnings.length === 0 ? (
                              <p className="mt-1 text-xs text-slate-500">{tr('No blocking alert.', 'Aucune alerte bloquante.', 'No blocking alert.')}</p>
                            ) : (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
                                {aiDraft.warnings.slice(0, 3).map((warning, idx) => (
                                  <li key={`warning-clean-${idx}`}>{warning}</li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                            <p className="text-sm font-semibold text-slate-900">{tr('Assumptions used', 'Hypotheses utilisees', 'Assumptions used')}</p>
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
                              {aiDraft.assumptions.slice(0, 3).map((assumption, idx) => (
                                <li key={`assumption-clean-${idx}`}>{assumption}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
              </aside>
            )}
          </form>
        </Card>
      </div>
    );
  }

  // ==========================================
  // VUE 2 : DÉTAILS DU DEVIS (PDF)
  // ==========================================
  if (view === 'details' && selectedQuote) {
    // Changer le titre pour le PDF
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center print:hidden">
          <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" /> {tr('Back to Quotes', 'Retour aux devis', 'العودة إلى العروض')}
          </Button>
          <div className="flex gap-3">
            {selectedQuote.status === 'pending' && (
              <>
                <Button
                  onClick={() => handleStatusChange(selectedQuote._id, 'approved')}
                  className="!bg-emerald-700 hover:!bg-emerald-800 !text-white rounded-xl border border-emerald-800 shadow-sm"
                >
                  <CheckCircle size={18} className="mr-2" /> Mark Approved
                </Button>
                <Button 
                    onClick={() => handleStatusChange(selectedQuote._id, 'rejected')} 
                    style={{ backgroundColor: '#dc2626', color: 'white' }}
                    className="hover:bg-red-700 !text-white rounded-xl shadow-md border-0"
                  >
                    <XCircle size={18} className="mr-2 text-white" /> Mark Rejected
                  </Button>
              </>
            )}
          </div>
        </div>

        <Card className="p-10 bg-card rounded-2xl border border-border shadow-lg print:shadow-none print:m-0 print:border">
          <div className="flex justify-between items-start mb-10 border-b-2 pb-6">
            <div>
              <h1 className="text-4xl font-bold text-primary mb-2">QUOTE</h1>
              <p className="text-muted-foreground font-mono">{selectedQuote.quoteNumber}</p>
            </div>
            <div className="text-right">
              <h3 className="font-bold text-foreground">BMP Marketplace</h3>
              <p className="text-muted-foreground">Digital Construction Platform</p>
              <Badge className={`mt-2 ${getStatusColor(selectedQuote.status)} px-3 py-1`}>
                {selectedQuote.status.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-10 mb-10">
            <div>
              <h4 className="font-bold text-foreground mb-2 border-b pb-2">Project:</h4>
              <p className="font-semibold text-lg">{selectedQuote.project?.title || 'Unknown Project'}</p>
              <h4 className="font-bold text-foreground mb-2 border-b pb-2 mt-6">Client:</h4>
              <p className="font-semibold text-lg">{selectedQuote.clientName || 'N/A'}</p>
            </div>
            <div className="text-right space-y-2">
              <p><span className="text-muted-foreground font-medium mr-2">Created On:</span> <span className="font-semibold">{formatDate(selectedQuote.createdAt)}</span></p>
              <p><span className="text-muted-foreground font-medium mr-2">Valid Until:</span> <span className="font-semibold text-red-600">{formatDate(selectedQuote.validUntil)}</span></p>
            </div>
          </div>

          <div className="mb-6 bg-muted/50 p-6 rounded-xl border">
            <h4 className="font-bold text-foreground mb-4">Description of Work / Items:</h4>
            <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{selectedQuote.description}</p>
          </div>

          {Array.isArray(selectedQuote.paymentSchedule) && selectedQuote.paymentSchedule.length > 0 ? (
            <div className="mb-10 bg-muted/50 p-6 rounded-xl border">
              <h4 className="font-bold text-foreground mb-4">
                {tr('Payment Schedule:', 'Échéancier de paiement :', 'جدول الدفع:')}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">{tr('Tranche', 'Tranche', 'القسط')}</th>
                      <th className="py-2 pr-3 font-semibold text-right">%</th>
                      <th className="py-2 font-semibold text-right">{tr('Amount', 'Montant', 'المبلغ')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuote.paymentSchedule.map((tranche: any, index: number) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-2 pr-3">{tranche.label}</td>
                        <td className="py-2 pr-3 text-right">{Number(tranche.percentage || 0).toFixed(2)}%</td>
                        <td className="py-2 text-right font-semibold">{formatAmount(Number(tranche.amount || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            selectedQuote.paymentTerms && (
              <div className="mb-10 bg-muted/50 p-6 rounded-xl border">
                <h4 className="font-bold text-foreground mb-4">Payment Terms:</h4>
                <p className="whitespace-pre-wrap text-muted-foreground">{selectedQuote.paymentTerms}</p>
              </div>
            )
          )}

          {/* Detail des lignes : uniquement pour un devis issu d'un modele metier.
              Un devis libre n'a pas de quoteLines et garde l'affichage d'origine. */}
          {Array.isArray(selectedQuote.quoteLines) && selectedQuote.quoteLines.length > 0 && (
            <div className="mb-10">
              <h4 className="font-bold text-foreground mb-4">
                {tr('Quote lines', 'Lignes du devis', 'سطور العرض')}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">{tr('Designation', 'Désignation', 'التسمية')}</th>
                      <th className="py-2 pr-3 font-semibold text-right">{tr('Qty', 'Qté', 'الكمية')}</th>
                      <th className="py-2 pr-3 font-semibold">{tr('Unit', 'Unité', 'الوحدة')}</th>
                      <th className="py-2 pr-3 font-semibold text-right">{tr('Unit price', 'Prix unitaire', 'سعر الوحدة')}</th>
                      <th className="py-2 font-semibold text-right">{tr('Total', 'Total', 'المجموع')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuote.quoteLines.map((line: any, index: number) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-2 pr-3">{line.designation}</td>
                        <td className="py-2 pr-3 text-right">{line.quantity}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{line.unit}</td>
                        <td className="py-2 pr-3 text-right">{formatAmount(Number(line.unitPrice || 0))}</td>
                        <td className="py-2 text-right font-semibold">{formatAmount(Number(line.total || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end border-t-2 pt-6">
            <div className="w-full max-w-md space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
                <p className="text-muted-foreground font-medium">Labor hand</p>
                <p className="font-semibold text-foreground">{formatAmount(Number(selectedQuote.laborHand || selectedQuote.amount || 0))}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
                <p className="text-muted-foreground font-medium">Materials</p>
                <p className="font-semibold text-foreground">{formatAmount(Number(selectedQuote.materialsAmount || 0))}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-primary dark:bg-blue-600 px-4 py-3 text-white">
                <p className="font-medium">Total</p>
                <p className="text-2xl font-bold">{formatAmount(Number(selectedQuote.amount || 0))}</p>
              </div>
            </div>
          </div>
        </Card>

        {selectedQuote.status === 'approved' && !selectedQuote.hasInvoice && (
          <div ref={invoiceSectionRef}>
            <Card className="p-5 bg-card rounded-2xl border border-green-200 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-foreground">{tr('Ready to generate invoice', 'Pret a generer la facture', 'Ready to generate invoice')}</h4>
                  <p className="text-sm text-muted-foreground">{tr('Create an invoice linked to this approved quote. Issue date will be generated automatically.', 'Creez une facture liee a ce devis approuve. La date d\'emission sera generee automatiquement.')}</p>
                </div>
                <Button
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl"
                  onClick={() => openGenerateInvoiceModal(selectedQuote)}
                >
                  {tr('Generate Invoice', 'Generer la facture', 'إنشاء فاتورة')}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {renderGlobalOverlay()}
      </div>
    );
  }

  // ==========================================
  // VUE 3 : LISTE PRINCIPALE
  // ==========================================
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-lg text-muted-foreground">{tr('Manage project quotes and estimates', 'Gerez les devis et estimations des projets', 'Manage project quotes and estimates')}</p>
        </div>
        <div className="flex items-center gap-3">
          {renderDraftMenuButton('h-12 px-4 rounded-xl border-2 !border-black !bg-black !text-white hover:!bg-neutral-900 shadow-md')}
          <Button onClick={handleStartNewQuote} className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
            <Plus size={20} className="mr-2" /> {tr('Generate Quote', 'Generer un devis', 'إنشاء عرض أسعار')}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <StatsCard label={tr('Total Quotes', 'Total devis', 'Total Quotes')} value={quotes.length.toString()} icon={<FileText size={28} />} color="#1E40AF" subtitle={tr('All time', 'Depuis toujours', 'All time')} />
        <StatsCard label={tr('Approved', 'Approuve', 'Approved')} value={quotes.filter(q => q.status === 'approved').length.toString()} icon={<CheckCircle size={28} />} color="#10B981" />
        <StatsCard label={tr('Pending', 'En attente', 'Pending')} value={quotes.filter(q => q.status === 'pending').length.toString()} icon={<Clock size={28} />} color="#F59E0B" subtitle={tr('Awaiting response', 'En attente de reponse', 'Awaiting response')} />
      </div>

      <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
          <div className="flex-1 h-12 rounded-xl border-2 border-border bg-card px-3 flex items-center gap-2">
            <Search className="text-muted-foreground shrink-0" size={18} />
            <Input
              placeholder={tr('Search quotes...', 'Rechercher des devis...', 'Search quotes...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-artisan-search="true"
              className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-full px-0"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:w-auto">
            <div className="h-12 rounded-xl border-2 border-border bg-card px-3 flex items-center gap-2 min-w-[170px] overflow-hidden focus-within:border-border transition-colors">
              <Filter className="text-muted-foreground shrink-0" size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'approved' | 'pending' | 'rejected')}
                className="h-full w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0 outline-none cursor-pointer"
                style={{ WebkitAppearance: 'none', appearance: 'none', background: 'transparent' }}
              >
                <option value="all">{tr('All Status', 'Tous les statuts', 'All Status')}</option>
                <option value="approved">{tr('Approved', 'Approuve', 'Approved')}</option>
                <option value="pending">{tr('Pending', 'En attente', 'Pending')}</option>
                <option value="rejected">{tr('Rejected', 'Rejete', 'Rejected')}</option>
              </select>
            </div>
            <div className="h-12 rounded-xl border-2 border-border bg-card px-3 flex items-center min-w-[170px] overflow-hidden focus-within:border-border transition-colors">
              <select
                value={invoiceFilter}
                onChange={(e) => setInvoiceFilter(e.target.value as 'all' | 'withInvoice' | 'withoutInvoice')}
                className="h-full w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0 outline-none cursor-pointer"
                style={{ WebkitAppearance: 'none', appearance: 'none', background: 'transparent' }}
              >
                <option value="all">{tr('All Invoice', 'Toutes les factures', 'All Invoice')}</option>
                <option value="withInvoice">{tr('With Invoice', 'Avec facture', 'With Invoice')}</option>
                <option value="withoutInvoice">{tr('Without Invoice', 'Sans facture', 'Without Invoice')}</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-10">{tr('Loading quotes...', 'Chargement des devis...', 'Loading quotes...')}</div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-10 bg-card rounded-2xl border border-border shadow-lg border border-border">
            <FileText className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-xl font-semibold text-muted-foreground">{tr('No quotes found.', 'Aucun devis trouve.', 'No quotes found.')}</p>
          </div>
        ) : (
          filteredQuotes.map((quote) => (
            <Card key={quote._id} className="p-6 bg-card rounded-2xl border border-border shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xl font-bold text-foreground">{tr('Quote', 'Devis', 'Quote')} {quote.quoteNumber}</h3>
                    <Badge className={`${getStatusColor(quote.status)} px-4 py-1.5 text-sm font-semibold flex items-center gap-2 border-2`}>
                      {getStatusIcon(quote.status)}
                      {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="mb-3 text-muted-foreground">
                    <strong className="text-foreground">{tr('Project:', 'Projet :', 'المشروع:')}</strong> {quote.project?.title || tr('Unknown', 'Inconnu', 'Unknown')}
                  </p>
                  <p className="mb-3 text-muted-foreground">
                    <strong className="text-foreground">{tr('Client:', 'Client :', 'Client:')}</strong> {quote.clientName || 'N/A'}
                  </p>
                  <p className="text-muted-foreground mb-4 leading-relaxed line-clamp-2">
                    {quote.description}
                  </p>
                  <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                    <span>{tr('Created:', 'Cree le :', 'Created:')} <strong className="text-foreground">{formatDate(quote.createdAt)}</strong></span>
                    <span>{tr('Valid until:', 'Valide jusqu\'au :')} <strong className="text-foreground">{formatDate(quote.validUntil)}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground font-medium mb-2">{tr('Total', 'Total', 'Total')}</p>
                    <p className="text-3xl font-bold text-primary">
                      {formatAmount(Number(quote.amount || 0))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tr('Labor', 'Main d\'oeuvre')} {formatAmount(Number(quote.laborHand || quote.amount || 0))} + {tr('Materials', 'Materiaux', 'Materials')} {formatAmount(Number(quote.materialsAmount || 0))}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-2 h-10 bg-card text-foreground hover:bg-muted/50"
                      onClick={() => { setSelectedQuote(quote); setView('details'); }}
                    >
                      <Eye size={16} className="mr-2" /> {tr('View', 'Voir', 'عرض')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-2 h-10 hover:bg-accent hover:text-white dark:!bg-secondary dark:!border-secondary dark:!text-white dark:hover:!bg-secondary/90"
                      onClick={() => handleDownloadQuotePdf(quote)}
                    >
                      <Download size={16} className="mr-2" /> PDF
                    </Button>
                    {quote.status === 'approved' && !quote.hasInvoice && (
                      <Button
                        size="sm"
                        className="rounded-xl h-10 bg-primary hover:bg-primary/90 text-white"
                        onClick={() => openGenerateInvoiceModal(quote)}
                      >
                        {tr('Generate Invoice', 'Generer la facture', 'إنشاء فاتورة')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-2 h-10 hover:bg-red-600 hover:text-white dark:!bg-destructive dark:!border-destructive dark:!text-white dark:hover:!bg-destructive/90"
                      onClick={() => openDeleteQuoteModal(quote)}
                    >
                      <Trash2 size={16} className="mr-2" /> {tr('Delete', 'Supprimer', 'حذف')}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}

        {renderGlobalOverlay()}
        {PopupElement}
      </div>
    </div>
  );
}
