import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, FileText, Download, Eye, Clock, CheckCircle, X, XCircle, ArrowRight, ShoppingCart, FolderKanban, Trash2, Search, Filter, Mic, MicOff, Sparkles, Gauge, AlertTriangle, Wand2, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import axios from 'axios';
import { toast } from 'sonner';
import { useSubscriptionGuard } from './SubscriptionGuard';
import { useLanguage } from '../../context/LanguageContext';

type SpeechField = 'clientName' | 'laborHand' | 'description' | 'validUntil' | 'upfrontValue' | 'invoiceDueDate';

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
  laborHand: string;
  description: string;
  validUntil: string;
  paymentType: 'percentage' | 'fixed';
  upfrontValue: string;
};

type QuoteDraftItem = {
  id: string;
  timestamp: number;
  title: string;
  formData: QuoteFormData;
};

const DRAFT_QUOTES_STORAGE_KEY = 'all_draft_quotes';
const LEGACY_DRAFT_QUOTE_STORAGE_KEY = 'draft_quote_data';
const AUTO_SAVE_DELAY_MS = 2500;

const initialFormData: QuoteFormData = {
  project: '',
  clientName: '',
  laborHand: '',
  description: '',
  validUntil: '',
  paymentType: 'percentage',
  upfrontValue: ''
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
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
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

  const parseSpokenNumber = (raw: string) => {
    const normalized = normalizeSpeechText(raw).replace(',', '.');
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const value = Number(match[0]);
    return Number.isFinite(value) ? String(value) : null;
  };

  const parsePaymentTypeFromSpeech = (raw: string): 'percentage' | 'fixed' | null => {
    const normalized = normalizeSpeechText(raw);
    if (!normalized) return null;

    const compact = normalized.replace(/\s+/g, '');

    const percentageKeywords = [
      'percent',
      'percentage',
      'pourcent',
      'pourcentage',
      'pourcenta',
      'pourcentag',
      'pour cent',
      '%',
      'نسبة',
      'مئوية',
      'بالمئة',
      'بالمائة',
    ];

    const fixedKeywords = [
      'fixed',
      'fixe',
      'fix',
      'montant fixe',
      'fixed amount',
      'amount',
      'montant',
      'ثابت',
      'مبلغ',
      'قيمة ثابتة',
    ];

    const hasKeyword = (keywords: string[]) =>
      keywords.some((kw) => normalized.includes(kw) || compact.includes(kw.replace(/\s+/g, '')));

    if (hasKeyword(percentageKeywords)) return 'percentage';
    if (hasKeyword(fixedKeywords)) return 'fixed';

    // Last-resort fuzzy stems for imperfect transcripts.
    if (/(percen|pourc|pourcen|percenta)/.test(compact)) return 'percentage';
    if (/(fix|montan|amoun)/.test(compact)) return 'fixed';

    return null;
  };

  const hasDraftContent = (data: QuoteFormData) => Boolean(
    data.project
    || data.clientName.trim()
    || data.laborHand.trim()
    || data.description.trim()
    || data.validUntil
    || data.upfrontValue.trim()
  );

  const sanitizeDraftFormData = (draftData: Partial<QuoteFormData>, fallback: QuoteFormData): QuoteFormData => ({
    ...fallback,
    project: typeof draftData.project === 'string' ? draftData.project : fallback.project,
    clientName: typeof draftData.clientName === 'string' ? draftData.clientName : fallback.clientName,
    laborHand: typeof draftData.laborHand === 'string' ? draftData.laborHand : fallback.laborHand,
    description: typeof draftData.description === 'string' ? draftData.description : fallback.description,
    validUntil: typeof draftData.validUntil === 'string' ? draftData.validUntil : fallback.validUntil,
    paymentType:
      draftData.paymentType === 'fixed' || draftData.paymentType === 'percentage'
        ? draftData.paymentType
        : fallback.paymentType,
    upfrontValue: typeof draftData.upfrontValue === 'string' ? draftData.upfrontValue : fallback.upfrontValue,
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
      setView('create');
    });
  };

  const handleExitCreateQuote = () => {
    if (hasDraftContent(formData)) {
      upsertDraft(formData, activeDraftId || undefined);
    } else if (activeDraftId) {
      removeDraftById(activeDraftId);
    }
    setIsDraftMenuOpen(false);
    setView('list');
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
            if (!hasDraftContent(nextFormData)) return;

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

    if (!hasDraftContent(formData)) {
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
  }, [formData, view, isSubmitting, activeDraftId, isDraftsLoaded]);

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

    if (field === 'upfrontValue') {
      const typedValue = String(value);
      setFormData((prev) => ({ ...prev, upfrontValue: typedValue }));
      if (touched.upfrontValue) {
        setErrors((prev) => ({ ...prev, upfrontValue: validateField('upfrontValue', typedValue) }));
      }
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
    const isNumericField = field === 'laborHand';
    const isPaymentTermsField = field === 'upfrontValue';
    let recognizedAnyValue = false;

    speechBaseRef.current = (isDateField || isNumericField || isPaymentTermsField)
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
          recognizedAnyValue = true;
          applyFieldValue('validUntil', parsedDate);
        }
        return;
      }

      if (isNumericField) {
        const parsedNumber = parseSpokenNumber(combined);
        if (parsedNumber !== null) {
          recognizedAnyValue = true;
          applyFieldValue('laborHand', parsedNumber);
        }
        return;
      }

      if (isPaymentTermsField) {
        const parsedPaymentType = parsePaymentTypeFromSpeech(combined);
        const parsedNumber = parseSpokenNumber(combined);

        if (parsedPaymentType) {
          recognizedAnyValue = true;
          setFormData((prev) => ({ ...prev, paymentType: parsedPaymentType }));
          if (touched.paymentType) {
            setErrors((prev) => ({ ...prev, paymentType: validateField('paymentType', parsedPaymentType) }));
          }
        }

        if (parsedNumber !== null) {
          recognizedAnyValue = true;
          applyFieldValue('upfrontValue', parsedNumber);
        }

        return;
      }

      recognizedAnyValue = true;
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
      if (isPaymentTermsField && !recognizedAnyValue) {
        const latePaymentType = parsePaymentTypeFromSpeech(speechFinalRef.current);
        const lateNumber = parseSpokenNumber(speechFinalRef.current);

        if (latePaymentType) {
          setFormData((prev) => ({ ...prev, paymentType: latePaymentType }));
          if (touched.paymentType) {
            setErrors((prev) => ({ ...prev, paymentType: validateField('paymentType', latePaymentType) }));
          }
          recognizedAnyValue = true;
        }

        if (lateNumber !== null) {
          applyFieldValue('upfrontValue', lateNumber);
          recognizedAnyValue = true;
        }
      }
      if (isPaymentTermsField && !recognizedAnyValue) {
        toast.info(
          tr(
            'Payment terms not recognized. Say: 30 percent or 500 fixed amount.',
            'Conditions de paiement non reconnues. Dites: 30 pourcent ou 500 montant fixe.',
            'Payment terms not recognized. Say: 30 percent or 500 fixed amount.'
          )
        );
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
  const materialsAmount = groupedMaterials.reduce((sum: number, entry: any) => {
    const price = Number(entry?.item?.price);
    const quantity = Number(entry?.quantity);
    const safePrice = Number.isFinite(price) ? price : 0;
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    return sum + (safePrice * safeQuantity);
  }, 0);
  const laborHandAmount = Number(formData.laborHand || 0);
  const totalAmount = (Number.isFinite(laborHandAmount) ? laborHandAmount : 0) + materialsAmount;
  const upfrontRaw = Number(formData.upfrontValue || 0);
  const upfrontAmount = formData.paymentType === 'percentage'
    ? (Number.isFinite(upfrontRaw) ? (totalAmount * upfrontRaw) / 100 : 0)
    : (Number.isFinite(upfrontRaw) ? upfrontRaw : 0);
  const safeUpfrontAmount = Math.min(Math.max(upfrontAmount, 0), totalAmount);
  const uponCompletionAmount = Math.max(totalAmount - safeUpfrontAmount, 0);
  const upfrontPercentage = totalAmount > 0 ? (safeUpfrontAmount / totalAmount) * 100 : 0;
  const uponCompletionPercentage = Math.max(100 - upfrontPercentage, 0);

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
    const nextPaymentType = draft.recommendations.paymentType.value;
    const nextUpfrontValue = nextPaymentType === 'percentage'
      ? String(draft.recommendations.upfront.percent)
      : String(draft.recommendations.upfront.fixedAmount);

    setFormData((prev) => ({
      ...prev,
      laborHand: String(draft.recommendations.laborHand.value),
      description: draft.recommendations.description.value,
      validUntil: draft.recommendations.validUntil.value,
      paymentType: nextPaymentType,
      upfrontValue: nextUpfrontValue,
    }));
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
        const projForQuote = projects.find((proj) => proj._id === value);
        const marketplaceCount = Array.isArray(projForQuote?.materials) ? projForQuote.materials.length : 0;
        const personalCount = Array.isArray(projForQuote?.personalMaterials) ? projForQuote.personalMaterials.length : 0;
        if (marketplaceCount + personalCount <= 0) return 'The selected project must have at least one material before creating a quote';
        return '';
      }
      case 'clientName':
        return !value ? 'Client name is required' : '';
      case 'laborHand':
        if (value === '' || value === null || value === undefined) return 'Labor hand is required';
        if (isNaN(Number(value)) || Number(value) < 0) return 'Labor hand must be a non-negative number';
        return '';
      case 'paymentType':
        if (!['percentage', 'fixed'].includes(String(value))) return 'Payment mode is required';
        return '';
      case 'upfrontValue': {
        if (value === '' || value === null || value === undefined) return 'Upfront value is required';
        const upfront = Number(value);
        if (!Number.isFinite(upfront) || upfront <= 0) return 'Upfront must be a positive number';
        if (formData.paymentType === 'percentage' && upfront > 100) return 'Upfront percentage cannot exceed 100%';
        if (formData.paymentType === 'fixed' && upfront > totalAmount) return 'Upfront amount cannot exceed total amount';
        return '';
      }
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
    const fields = ['project', 'clientName', 'laborHand', 'description', 'validUntil', 'paymentType', 'upfrontValue'];
    for (const field of fields) {
      if (validateField(field, formData[field as keyof typeof formData])) return false;
    }
    if (totalAmount <= 0) return false;
    // PaymentTerms est optionnel, on ne le valide pas pour le form valide
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
      const paymentTermsSummary =
        `Mode: ${formData.paymentType === 'percentage' ? 'Percentage (%)' : 'Fixed Amount'} | ` +
        `Upfront: ${upfrontPercentage.toFixed(2)}% (${safeUpfrontAmount.toFixed(2)} TND) | ` +
        `Upon Completion: ${uponCompletionPercentage.toFixed(2)}% (${uponCompletionAmount.toFixed(2)} TND)`;

      await axios.post(`${API_URL}/quotes`, {
        ...formData,
        laborHand: Number(formData.laborHand || 0),
        materialsAmount,
        paymentTerms: paymentTermsSummary,
        upfrontPercent: upfrontPercentage,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Quote generated successfully!');
      clearCurrentDraft();
      setFormData({ ...initialFormData });
      setErrors({});
      setTouched({});
      setAiDraft(null);
      setAiDraftError('');
      setView('list');
    } catch (error) {
      console.error("Error creating quote:", error);
      alert('Failed to create quote.');
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
  // VUE 1 : CRÉATION
  // ==========================================
  if (view === 'create') {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-8">
        <Button variant="outline" onClick={handleExitCreateQuote} className="mb-6 rounded-lg border border-gray-300 shadow-sm">
          <ArrowRight size={20} className="mr-2 rotate-180" /> {tr('Back to Quotes', 'Retour aux devis', 'العودة إلى العروض')}
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

              {/* Finance */}
              <section className="space-y-6 rounded-xl border border-gray-200 bg-gray-50 p-6">
                <h3 className="text-lg font-semibold text-foreground">Finance Overview</h3>

                <div className="grid grid-cols-1 gap-6 w-full md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="laborHand" className="text-base font-semibold whitespace-nowrap">
                        Labor hand (TND) <span style={{ color: 'red' }}>*</span>
                      </Label>
                      {renderSpeechButton('laborHand')}
                    </div>
                    <Input
                      id="laborHand"
                      type="number"
                      step="any"
                      min={0}
                      value={formData.laborHand}
                      onChange={(e) => {
                        applyFieldValue('laborHand', e.target.value);
                      }}
                      onBlur={() => handleBlur('laborHand')}
                      placeholder="0.00"
                      className={`h-12 w-full rounded-lg border bg-card shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        touched.laborHand && errors.laborHand ? 'border-red-500' : 'border-border'
                      }`}
                    />
                    {touched.laborHand && errors.laborHand && (
                      <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.laborHand}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold whitespace-nowrap">Materials from project (TND)</Label>
                    <div className="flex h-12 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 shadow-sm">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-lg border border-border"
                        disabled={!selectedProject}
                        onClick={() => setShowAllMaterials((prev) => !prev)}
                      >
                        <FolderKanban size={14} className="mr-2" />
                        {showAllMaterials ? 'Hide materials' : 'View All materials'}
                      </Button>
                      <span className="text-lg font-bold text-primary">{formatAmount(materialsAmount)}</span>
                    </div>
                    {showAllMaterials && (
                      <div className="max-h-48 overflow-auto rounded-lg border border-border bg-card p-3">
                        {groupedMaterials.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No materials added to this project yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {groupedMaterials.map((entry: any, index: number) => (
                              <div key={String(entry.key || entry.item?._id || index)} className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2">
                                <p className="truncate pr-2 text-sm font-medium text-foreground">
                                  {entry.item?.name || 'Material'}
                                  <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {entry.source === 'personal' ? 'Personal' : 'Marketplace'}
                                  </span>
                                </p>
                                <p className="whitespace-nowrap text-sm text-muted-foreground">
                                  x{entry.quantity} • {formatAmount(Number(entry.item?.price || 0) * entry.quantity)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {selectedProject && materialsAmount <= 0 && (
                  <Card className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <p className="mb-3 text-sm text-amber-800">
                      This project has no materials yet. Use the same project flow to add materials, then come back to generate the quote.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        className="rounded-lg bg-secondary text-white shadow-sm hover:bg-secondary/90"
                        onClick={() => {
                          if (!selectedProject?._id) return;
                          window.location.href = '/?artisanView=marketplace&projectId=' + selectedProject._id;
                        }}
                      >
                        <ShoppingCart size={16} className="mr-2" /> Add Material
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-lg border border-border shadow-sm"
                        onClick={() => {
                          if (!selectedProject?._id) return;
                          window.location.href = '/?artisanView=projects';
                        }}
                      >
                        <FolderKanban size={16} className="mr-2" /> View Materials
                      </Button>
                    </div>
                  </Card>
                )}

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-sm text-muted-foreground">Total amount preview</p>
                  <div className="grid w-full gap-4 text-sm md:grid-cols-3">
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-muted-foreground">Labor hand</p>
                      <p className="font-semibold text-foreground">{formatAmount(Number.isFinite(laborHandAmount) ? laborHandAmount : 0)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-muted-foreground">Materials</p>
                      <p className="font-semibold text-foreground">{formatAmount(materialsAmount)}</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900">
                      <p className="font-medium">Total</p>
                      <p className="text-lg font-bold">{formatAmount(totalAmount)}</p>
                    </div>
                  </div>
                </div>
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

                {/* Payment Terms (calculated) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-base font-semibold">Payment Terms <span style={{ color: 'red' }}>*</span></Label>
                    {renderSpeechButton('upfrontValue')}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm shadow-sm ${formData.paymentType === 'percentage' ? 'border-blue-500 bg-blue-50/60' : 'border-border bg-card'}`}>
                      <input
                        type="radio"
                        name="paymentType"
                        checked={formData.paymentType === 'percentage'}
                        onChange={() => {
                          setFormData({ ...formData, paymentType: 'percentage' });
                          if (touched.paymentType) setErrors(prev => ({ ...prev, paymentType: validateField('paymentType', 'percentage') }));
                          if (touched.upfrontValue) setErrors(prev => ({ ...prev, upfrontValue: validateField('upfrontValue', formData.upfrontValue) }));
                        }}
                        onBlur={() => handleBlur('paymentType')}
                      />
                      Percentage (%)
                    </label>
                    <label className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm shadow-sm ${formData.paymentType === 'fixed' ? 'border-blue-500 bg-blue-50/60' : 'border-border bg-card'}`}>
                      <input
                        type="radio"
                        name="paymentType"
                        checked={formData.paymentType === 'fixed'}
                        onChange={() => {
                          setFormData({ ...formData, paymentType: 'fixed' });
                          if (touched.paymentType) setErrors(prev => ({ ...prev, paymentType: validateField('paymentType', 'fixed') }));
                          if (touched.upfrontValue) setErrors(prev => ({ ...prev, upfrontValue: validateField('upfrontValue', formData.upfrontValue) }));
                        }}
                        onBlur={() => handleBlur('paymentType')}
                      />
                      Fixed Amount
                    </label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upfrontValue" className="text-sm font-medium text-muted-foreground">
                      Upfront ({formData.paymentType === 'percentage' ? '%' : 'TND'})
                    </Label>
                    <Input
                      id="upfrontValue"
                      type="number"
                      step="any"
                      min={0}
                      max={formData.paymentType === 'percentage' ? 100 : undefined}
                      value={formData.upfrontValue}
                      onChange={(e) => {
                        setFormData({ ...formData, upfrontValue: e.target.value });
                        if (touched.upfrontValue) setErrors(prev => ({ ...prev, upfrontValue: validateField('upfrontValue', e.target.value) }));
                      }}
                      onBlur={() => handleBlur('upfrontValue')}
                      placeholder={formData.paymentType === 'percentage' ? 'e.g. 30' : 'e.g. 500'}
                      className={`h-10 w-full rounded-lg border bg-card shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        touched.upfrontValue && errors.upfrontValue ? 'border-red-500' : 'border-border'
                      }`}
                    />
                    {touched.upfrontValue && errors.upfrontValue && (
                      <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.upfrontValue}</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm space-y-2">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Upfront</span>
                      <span className="font-semibold text-foreground">
                        {upfrontPercentage.toFixed(2)}% ({safeUpfrontAmount.toFixed(2)} TND)
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Upon Completion</span>
                      <span className="font-semibold text-foreground">
                        {uponCompletionPercentage.toFixed(2)}% ({uponCompletionAmount.toFixed(2)} TND)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Boutons */}
              <div className="mt-8 flex flex-wrap justify-start gap-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || !validateForm()}
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

          {selectedQuote.paymentTerms && (
            <div className="mb-10 bg-muted/50 p-6 rounded-xl border">
              <h4 className="font-bold text-foreground mb-4">Payment Terms:</h4>
              <p className="whitespace-pre-wrap text-muted-foreground">{selectedQuote.paymentTerms}</p>
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
