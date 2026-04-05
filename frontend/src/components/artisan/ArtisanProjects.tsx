import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Search, Filter, MapPin, Calendar, DollarSign, Eye, Edit, ShoppingCart, FileText, Receipt, ArrowRight, FolderKanban, X, Upload, CheckCircle, Sparkles, Mic, MicOff } from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';
import { toast } from 'sonner';
import { useSubscriptionGuard } from './SubscriptionGuard';
import { useLanguage } from '../../context/LanguageContext';
import MaterialRecommendation from './MaterialRecommendation';

type SpeechField = 'title' | 'description' | 'location' | 'startDate' | 'endDate';

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

// Composant d'autocomplétion pour la localisation
const LocationInput = ({ value, onChange, onSelect, error, onBlur, allowedStates = [], inputId = 'location'  }: {
  value: string; 
  onChange: (value: string) => void; 
  onSelect: (location: string) => void;
  error?: string;
  onBlur?: () => void;
  allowedStates?: string[];
  inputId?: string;
}) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const isSuggestionInAllowedStates = (displayName: string) => {
    if (!allowedStates.length) return false;

    const normalizedDisplayName = normalizeText(displayName);
    return allowedStates.some((state) => normalizedDisplayName.includes(normalizeText(state)));
  };

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=tn&addressdetails=1&limit=10`
      );

      const filteredSuggestions = response.data.filter((item: any) =>
        isSuggestionInAllowedStates(item.display_name || '')
      );

      setSuggestions(filteredSuggestions.slice(0, 6));
    } catch (error) {
      console.error('Erreur lors de la récupération des suggestions', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value) fetchSuggestions(value);
    }, 500);
    return () => clearTimeout(timer);
  }, [value, allowedStates.join(',')]);

  const handleSelect = (suggestion: any) => {
    const displayName = suggestion.display_name;
    onChange(displayName);
    onSelect(displayName);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <Input
        id={inputId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          onBlur?.();         // <-- appel de la fonction parent
          setTimeout(() => setShowSuggestions(false), 200);
        }}
        placeholder="Entrez une ville ou un lieu en Tunisie"
        className={`h-12 rounded-xl border-2 focus:border-primary ${error ? 'border-red-500' : 'border-border'}`}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.place_id}
              className="px-4 py-2 hover:bg-muted cursor-pointer"
              onClick={() => handleSelect(suggestion)}
            >
              {suggestion.display_name}
            </li>
          ))}
        </ul>
      )}
      {showSuggestions && !loading && value.length >= 3 && suggestions.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg px-4 py-3 text-sm text-muted-foreground">
          Aucune ville trouvee pour vos gouvernorats de profil.
        </div>
      )}
      {loading && <div className="absolute right-3 top-3 text-sm text-muted-foreground">Chargement...</div>}
    </div>
  );
};

export default function ArtisanProjects() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const isSpeechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  // Vues
  const [view, setView] = useState<'list' | 'create' | 'details' | 'edit' | 'materials'>('list');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  // Données
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { guard, PopupElement } = useSubscriptionGuard();

  // --- Quantités locales pour la vue matériaux (avant confirmation) ---
  const [localQuantities, setLocalQuantities] = useState<Record<string, number>>({});
  const [confirmingMaterialId, setConfirmingMaterialId] = useState<string | null>(null);
  const [localPersonalQuantities, setLocalPersonalQuantities] = useState<Record<string, number>>({});
  const [confirmingPersonalMaterialId, setConfirmingPersonalMaterialId] = useState<string | null>(null);

  // --- Redirection depuis marketplace (viewMaterials param) ---
  const [pendingViewMaterialsId, setPendingViewMaterialsId] = useState<string | null>(null);

  // État du formulaire (partagé entre création et édition)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    budget: '',
    startDate: '',
    endDate: '',
    progress: 0,
  });

  // État pour savoir si une localisation valide a été sélectionnée
  const [locationSelected, setLocationSelected] = useState(false);

  // État pour les erreurs de validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [activeSpeechField, setActiveSpeechField] = useState<SpeechField | null>(null);
  const [isListening, setIsListening] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [artisanProfileLocation, setArtisanProfileLocation] = useState('');

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [addingToPortfolio, setAddingToPortfolio] = useState(false);
  const [showAddMaterialOptions, setShowAddMaterialOptions] = useState(false);
  const [materialProjectContext, setMaterialProjectContext] = useState<any>(null);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [showPersonalMaterialForm, setShowPersonalMaterialForm] = useState(false);
  const [isSavingPersonalMaterial, setIsSavingPersonalMaterial] = useState(false);
  const [selectedPersonalImageFile, setSelectedPersonalImageFile] = useState<File | null>(null);
  const personalMaterialImageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechBaseRef = useRef('');
  const speechFinalRef = useRef('');
  const formDataRef = useRef(formData);
  const [personalMaterialForm, setPersonalMaterialForm] = useState({
    name: '',
    category: 'Maçonnerie',
    price: '',
    stock: '1',
    description: '',
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || API_URL.replace(/\/api\/?$/, '') || 'http://localhost:5000';

  const normalizeTextForCompare = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
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
    const normalized = normalizeTextForCompare(raw)
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

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const updateFieldValue = (field: SpeechField, value: string) => {
    if (field === 'location') {
      setFormData((prev) => ({ ...prev, location: value }));
      const allowedLocations = getProfileLocations();
      const normalizedValue = normalizeTextForCompare(value);
      const isAllowed = allowedLocations.some((state) => normalizedValue.includes(normalizeTextForCompare(state)));
      setLocationSelected(isAllowed);
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }

    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
  };

  const getSpeechLanguage = () => {
    if (language === 'fr') return 'fr-FR';
    if (language === 'ar') return 'ar-TN';
    return 'en-US';
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
      toast.error(tr('Speech-to-text is not supported on this browser.', 'La dictee vocale nest pas supportee sur ce navigateur.', 'Speech-to-text is not supported on this browser.'));
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

    recognition.onstart = () => {
      setIsListening(true);
    };

    const isDateField = field === 'startDate' || field === 'endDate';
    speechBaseRef.current = isDateField ? '' : String(formDataRef.current[field] || '').trim();
    speechFinalRef.current = '';

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
          updateFieldValue(field, parsedDate);
        }
      } else {
        updateFieldValue(field, combined);
      }
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
      if (isDateField) {
        const latestValue = String(formDataRef.current[field] || '').trim();
        if (!latestValue) {
          toast.info(tr('Date not recognized. Try format 12/04/2026 or 12 avril 2026.', 'Date non reconnue. Essayez le format 12/04/2026 ou 12 avril 2026.', 'Date not recognized. Try format 12/04/2026 or April 12 2026.'));
        }
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

  const toPublicAssetUrl = (rawPath: string) => {
    const trimmed = String(rawPath || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const normalized = trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
    return `${SERVER_URL}/${normalized}`;
  };

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const token = getToken();
      if (!token) return;

      const response = await axios.get(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des projets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Récupération du token ---
  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) {
      token = JSON.parse(userStorage).token;
    }
    return token;
  };

  // --- Chargement des projets ---
  useEffect(() => {
    if (view !== 'list') return;
    fetchProjects();
  }, [view, API_URL]);

  // --- Lecture du param viewMaterials (depuis la marketplace) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vmId = params.get('viewMaterials');
    if (vmId) {
      setPendingViewMaterialsId(vmId);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // --- Quand les projets chargent + pendingViewMaterialsId défini → aller à la vue matériaux ---
  useEffect(() => {
    if (!pendingViewMaterialsId || projects.length === 0) return;
    const found = projects.find((p: any) => String(p._id) === pendingViewMaterialsId);
    if (found) {
      setSelectedProject(found);
      setView('materials');
      setPendingViewMaterialsId(null);
    }
  }, [projects, pendingViewMaterialsId]);

  // --- Initialisation des quantités locales à l'entrée de la vue matériaux ---
  useEffect(() => {
    if (view === 'materials' && selectedProject) {
      const initial: Record<string, number> = {};
      const mats = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
      mats.forEach((mat: any) => {
        const id = String((mat && (mat._id || mat)) || '');
        if (id) initial[id] = (initial[id] || 0) + 1;
      });
      setLocalQuantities(initial);

      const personalInitial: Record<string, number> = {};
      const personalMats = Array.isArray(selectedProject.personalMaterials) ? selectedProject.personalMaterials : [];
      personalMats.forEach((mat: any, index: number) => {
        const id = String(mat?._id || `personal-${index}`);
        const stock = Number(mat?.stock);
        personalInitial[id] = Number.isFinite(stock) && stock > 0 ? stock : 1;
      });
      setLocalPersonalQuantities(personalInitial);
    }
  }, [view, selectedProject]);

  // --- Chargement de la localisation du profil artisan ---
  useEffect(() => {
    const fetchArtisanProfileLocation = async () => {
      try {
        const token = getToken();
        if (!token) return;

        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const userData = response.data?.user ? response.data.user : response.data;
        const location = (userData?.location || '').trim();
        setArtisanProfileLocation(location);
      } catch (error) {
        console.error('Erreur lors du chargement de la localisation profil:', error);
      }
    };

    fetchArtisanProfileLocation();
  }, [API_URL]);

  // --- Pré-remplissage du formulaire d'édition ---
  useEffect(() => {
    if (view === 'edit' && selectedProject) {
      setFormData({
        title: selectedProject.title,
        description: selectedProject.description,
        location: selectedProject.location,
        budget: selectedProject.budget,
        startDate: selectedProject.startDate?.substring(0, 10),
        endDate: selectedProject.endDate?.substring(0, 10),
        progress: selectedProject.progress || 0,
      });
      setLocationSelected(true); // La localisation existante est considérée valide
    }
  }, [view, selectedProject]);

  // --- Réinitialisation du formulaire quand on passe en création ---
  const handleCreateView = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      budget: '',
      startDate: '',
      endDate: '',
      progress: 0,
    });
    setLocationSelected(false);
    setErrors({});
    setTouched({});
    setView('create');
  };

  const getProfileLocations = () =>
    artisanProfileLocation
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  // --- Validation d'un champ ---
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'title':
        return !value ? 'Le titre est obligatoire' : '';
      case 'description':
        if (!value) return 'La description est obligatoire';
        if (value.length < 10) return 'La description doit contenir au moins 10 caractères';
        return '';
      case 'location':
        if (!value) return 'La localisation est obligatoire';
        const allowedLocations = getProfileLocations();
        if (!allowedLocations.length) {
          return 'Aucune localisation detectee dans votre profil artisan';
        }
        if (!locationSelected) {
          return `Selectionnez une ville valide de: ${allowedLocations.join(', ')}`;
        }
        return '';
      case 'budget':
        if (!value) return 'Le budget est obligatoire';
        if (isNaN(Number(value)) || Number(value) <= 0) return 'Le budget doit être un nombre positif';
        return '';
      case 'startDate':
        return !value ? 'La date de début est obligatoire' : '';
      case 'endDate':
        if (!value) return 'La date de fin est obligatoire';
        if (formData.startDate && new Date(value) <= new Date(formData.startDate)) {
          return 'La date de fin doit être postérieure à la date de début';
        }
        return '';
      default:
        return '';
    }
  };

  // --- Validation globale du formulaire ---
  const validateForm = (): boolean => {
    const fieldsToValidate = ['title', 'description', 'location', 'startDate', 'endDate'];

    for (const field of fieldsToValidate) {
      const error = validateField(field, formData[field as keyof typeof formData]);
      if (error) return false;
    }

    return locationSelected;
  };

  // --- Gestion du blur pour marquer un champ comme touché ---
  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof typeof formData]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  // --- Soumission création ---
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const token = getToken();
      const payload = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        // Keep creation compatible with legacy backend checks that reject 0 via falsy validation.
        budget: 1,
        startDate: formData.startDate,
        endDate: formData.endDate,
        progress: 0,
        tasks: [],
      };

      await axios.post(
        `${API_URL}/projects`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setFormData({ title: '', description: '', location: '', budget: '', startDate: '', endDate: '', progress: 0 });
      setLocationSelected(false);
      toast.success(tr('Project created successfully', 'Projet cree avec succes', 'Project created successfully'));
      setView('list');
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      const backendMessage = error?.response?.data?.message;
      const missingFields = Array.isArray(error?.response?.data?.missingFields)
        ? ` Missing: ${error.response.data.missingFields.join(', ')}`
        : '';
      toast.error(`${backendMessage || 'Erreur lors de la création du projet.'}${missingFields}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Soumission modification ---
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const token = getToken();
      const response = await axios.put(
        `${API_URL}/projects/${selectedProject._id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedProject(response.data);
      setProjects((prev) => prev.map((p) => (p._id === response.data._id ? response.data : p)));
      setView('details');
    } catch (error) {
      console.error('Erreur update:', error);
      alert('Erreur lors de la modification.');
    }
  };

  const normalizeTasks = (tasks: any[] | undefined) => {
    if (!Array.isArray(tasks)) return [];
    return tasks.map((task) => ({
      _id: task._id || `${Date.now()}-${Math.random()}`,
      title: task.title || '',
      status: task.status || 'todo',
    }));
  };

  const computeProgressFromTasks = (tasks: any[]) => {
    if (!tasks.length) return 0;
    const doneCount = tasks.filter((task) => task.status === 'done').length;
    return Math.round((doneCount / tasks.length) * 100);
  };

  const updateProjectLocally = (updatedProject: any) => {
    setSelectedProject(updatedProject);
    setProjects((prev) => prev.map((p) => (p._id === updatedProject._id ? updatedProject : p)));
  };

  const persistProjectUpdate = async (projectId: string, payload: any) => {
    const token = getToken();
    const response = await axios.put(`${API_URL}/projects/${projectId}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    updateProjectLocally(response.data);
    return response.data;
  };

  const handleAddTask = async () => {
    if (!selectedProject || !newTaskTitle.trim()) return;

    const tasks = normalizeTasks(selectedProject.tasks);
    const updatedTasks = [...tasks, { title: newTaskTitle.trim(), status: 'todo' }];
    const updatedProgress = computeProgressFromTasks(updatedTasks);

    try {
      await persistProjectUpdate(selectedProject._id, {
        tasks: updatedTasks,
        progress: updatedProgress,
      });
      setNewTaskTitle('');
    } catch (error) {
      console.error('Erreur lors de lajout de la tache:', error);
      alert('Impossible dajouter la tache.');
    }
  };

  const handleTaskStatusChange = async (taskId: string, status: 'todo' | 'in_progress' | 'done') => {
    if (!selectedProject) return;

    const tasks = normalizeTasks(selectedProject.tasks);
    const updatedTasks = tasks.map((task) => (task._id === taskId ? { ...task, status } : task));
    const updatedProgress = computeProgressFromTasks(updatedTasks);

    try {
      await persistProjectUpdate(selectedProject._id, {
        tasks: updatedTasks,
        progress: updatedProgress,
      });
    } catch (error) {
      console.error('Erreur lors de la mise a jour du statut de la tache:', error);
      alert('Impossible de mettre a jour le statut de la tache.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedProject) return;

    const tasks = normalizeTasks(selectedProject.tasks);
    const updatedTasks = tasks.filter((task) => task._id !== taskId);
    const updatedProgress = computeProgressFromTasks(updatedTasks);

    try {
      await persistProjectUpdate(selectedProject._id, {
        tasks: updatedTasks,
        progress: updatedProgress,
      });
    } catch (error) {
      console.error('Erreur lors de la suppression de la tache:', error);
      alert('Impossible de supprimer la tache.');
    }
  };

  const handleSaveTaskEdit = async (taskId: string) => {
    if (!selectedProject || !editingTaskTitle.trim()) return;

    const tasks = normalizeTasks(selectedProject.tasks);
    const updatedTasks = tasks.map((task) =>
      task._id === taskId ? { ...task, title: editingTaskTitle.trim() } : task
    );
    const updatedProgress = computeProgressFromTasks(updatedTasks);

    try {
      await persistProjectUpdate(selectedProject._id, {
        tasks: updatedTasks,
        progress: updatedProgress,
      });
      setEditingTaskId(null);
      setEditingTaskTitle('');
    } catch (error) {
      console.error('Erreur lors de la modification de la tache:', error);
      alert('Impossible de modifier la tache.');
    }
  };

  const getProjectProgress = (project: any) => {
    const tasks = normalizeTasks(project.tasks);
    return tasks.length ? computeProgressFromTasks(tasks) : project.progress || 0;
  };

  const handleAddProjectToPortfolio = async (projectId: string) => {
    try {
      setAddingToPortfolio(true);
      const token = getToken();
      await axios.post(
        `${API_URL}/artisans/me/portfolio/from-project/${projectId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(tr('Project added to portfolio. You can now enrich it with images and videos in Portfolio.', 'Projet ajoute au portfolio. Vous pouvez maintenant l\'enrichir avec des images et des videos dans Portfolio.'));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || tr('Unable to add this project to portfolio.', 'Impossible d\'ajouter ce projet au portfolio.'));
    } finally {
      setAddingToPortfolio(false);
    }
  };

  const openAddMaterialOptions = (project: any) => {
    setMaterialProjectContext(project);
    setShowAddMaterialOptions(true);
  };

  const handleAddFromMarketplace = () => {
    if (!materialProjectContext?._id) return;
    guard(() => { window.location.href = '/?artisanView=marketplace&projectId=' + materialProjectContext._id; });
    setShowAddMaterialOptions(false);
  };

  const handleOpenSmartRecommendation = () => {
    if (!materialProjectContext) return;
    setShowAddMaterialOptions(false);
    setShowRecommendation(true);
  };

  const handleRecommendationAddToProject = async (productId: string) => {
    if (!materialProjectContext?._id) return;
    const token = getToken();
    const currentMaterials = (materialProjectContext.materials || []).map((m: any) => m._id || m);
    await axios.put(
      `${API_URL}/projects/${materialProjectContext._id}`,
      { materials: [...currentMaterials, productId] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    // Refresh project list and update context reference
    const updated = await axios.get(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } });
    setProjects(updated.data);
    const refreshed = updated.data.find((p: any) => p._id === materialProjectContext._id);
    if (refreshed) setMaterialProjectContext(refreshed);
  };

  const handleOpenPersonalMaterialForm = () => {
    if (!materialProjectContext) return;
    setSelectedProject(materialProjectContext);
    setView('materials');
    setShowPersonalMaterialForm(true);
    setShowAddMaterialOptions(false);
  };

  const resetPersonalMaterialForm = () => {
    setPersonalMaterialForm({
      name: '',
      category: 'Maçonnerie',
      price: '',
      stock: '1',
      description: '',
    });
    setSelectedPersonalImageFile(null);
  };

  const savePersonalMaterial = async () => {
    if (!selectedProject?._id) return;
    if (!personalMaterialForm.name.trim()) {
      toast.error(tr('Material name is required', 'Le nom du materiau est obligatoire', 'Material name is required'));
      return;
    }
    if (!personalMaterialForm.category.trim()) {
      toast.error(tr('Category is required', 'La categorie est obligatoire', 'Category is required'));
      return;
    }

    const parsedPrice = Number(personalMaterialForm.price);
    const parsedStock = Math.max(1, Number(personalMaterialForm.stock || 1));
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error(tr('Price must be a valid non-negative number', 'Le prix doit etre un nombre valide non negatif', 'Price must be a valid non-negative number'));
      return;
    }

    try {
      setIsSavingPersonalMaterial(true);
      const token = getToken();
      const existing = Array.isArray(selectedProject.personalMaterials) ? selectedProject.personalMaterials : [];
      const newPersonalMaterial = {
        name: personalMaterialForm.name.trim(),
        category: personalMaterialForm.category.trim(),
        price: parsedPrice,
        stock: parsedStock,
        image: '',
        description: personalMaterialForm.description.trim(),
      };

      const res = await axios.put(
        `${API_URL}/projects/${selectedProject._id}`,
        { personalMaterials: [...existing, newPersonalMaterial] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let latestProject = res.data;

      if (selectedPersonalImageFile) {
        const createdMaterials = Array.isArray(res.data?.personalMaterials)
          ? res.data.personalMaterials
          : [];
        const createdMaterial = createdMaterials[createdMaterials.length - 1];
        const createdMaterialId = createdMaterial?._id;

        if (createdMaterialId) {
          const imageFormData = new FormData();
          imageFormData.append('document', selectedPersonalImageFile);

          const uploadRes = await axios.post(
            `${API_URL}/projects/${selectedProject._id}/personal-materials/${createdMaterialId}/image`,
            imageFormData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data',
              },
            }
          );

          if (uploadRes.data?.project) {
            latestProject = uploadRes.data.project;
          }
        }
      }

      setSelectedProject(latestProject);
      await fetchProjects();
      resetPersonalMaterialForm();
      setShowPersonalMaterialForm(false);
      toast.success(tr('Personal material added successfully', 'Materiau personnel ajoute avec succes', 'Personal material added successfully'));
    } catch (error) {
      console.error('Failed to save personal material', error);
      toast.error(tr('Error saving personal material', 'Erreur lors de l\'enregistrement du materiau personnel'));
    } finally {
      setIsSavingPersonalMaterial(false);
    }
  };

  const removePersonalMaterial = async (materialId: string) => {
    if (!selectedProject?._id) return;
    try {
      const token = getToken();
      const existing = Array.isArray(selectedProject.personalMaterials) ? selectedProject.personalMaterials : [];
      const updated = existing.filter((mat: any) => String(mat._id || '') !== String(materialId));
      const res = await axios.put(
        `${API_URL}/projects/${selectedProject._id}`,
        { personalMaterials: updated },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedProject(res.data);
      await fetchProjects();
      toast.success(tr('Personal material removed', 'Materiau personnel supprime', 'Personal material removed'));
    } catch (error) {
      console.error('Failed to remove personal material', error);
      toast.error(tr('Error removing personal material', 'Erreur lors de la suppression du materiau personnel', 'Error removing personal material'));
    }
  };

  // --- Utilitaires d'affichage ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-accent/10 text-accent border-accent/20';
      case 'pending':
        return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'completed':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || (project.status || 'active') === statusFilter;
    const matchesPriority = priorityFilter === 'all' || (project.priority || 'medium') === priorityFilter;

    return Boolean(matchesSearch && matchesStatus && matchesPriority);
  });

  // --- Vue Création ---
  if (view === 'create') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setView('list')} className="mb-6 rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Retour aux projets
        </Button>
        <Card className="p-10 bg-card rounded-2xl border border-border shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">Créer un nouveau projet</h2>
          <form className="space-y-6" onSubmit={handleCreateProject}>
            {/* Titre */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="title" className="text-base font-semibold">
                  Titre du projet <span style={{ color: 'red' }}>*</span>
                </Label>
                {renderSpeechButton('title')}
              </div>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => {
                  updateFieldValue('title', e.target.value);
                }}
                onBlur={() => handleBlur('title')}
                placeholder="Entrez le titre du projet"
                className={`h-12 rounded-xl border-2 focus:border-primary ${touched.title && errors.title ? 'border-red-500' : 'border-border'}`}
              />
              {touched.title && errors.title && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.title}</p>}
            </div>

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
                  updateFieldValue('description', e.target.value);
                }}
                onBlur={() => handleBlur('description')}
                placeholder="Décrivez votre projet (minimum 10 caractères)"
                rows={4}
                className={`rounded-xl border-2 focus:border-primary ${touched.description && errors.description ? 'border-red-500' : 'border-border'}`}
              />
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {activeSpeechField === 'description'
                  ? tr('Voice input active for description.', 'Dictee vocale active pour la description.', 'Voice input active for description.')
                  : tr('You can type or use voice input.', 'Vous pouvez taper ou utiliser la dictee vocale.', 'You can type or use voice input.')}
              </p>
              {touched.description && errors.description && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.description}</p>}
            </div>

            {/* Localisation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="location-create" className="text-base font-semibold">
                  Localisation <span style={{ color: 'red' }}>*</span>
                </Label>
                {renderSpeechButton('location')}
              </div>
              <LocationInput
                inputId="location-create"
                value={formData.location}
                onChange={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(false);
                  if (touched.location) setErrors((prev) => ({ ...prev, location: validateField('location', value) }));
                }}
                onSelect={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(true);
                  if (touched.location) setErrors((prev) => ({ ...prev, location: '' }));
                }}
                onBlur={() => handleBlur('location')}
                allowedStates={getProfileLocations()}
                error={touched.location && errors.location ? errors.location : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Saisissez une ville; seules les villes dans vos gouvernorats de profil sont acceptees.
              </p>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {activeSpeechField === 'location'
                  ? tr('Voice input active for location.', 'Dictee vocale active pour la localisation.', 'Voice input active for location.')
                  : tr('You can type or use voice input for location.', 'Vous pouvez taper ou utiliser la dictee vocale pour la localisation.', 'You can type or use voice input for location.')}
              </p>
              {touched.location && errors.location && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.location}</p>}
            </div>

            {/* Dates côte à côte */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Date de début */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="startDate" className="text-base font-semibold">
                    Date de début <span style={{ color: 'red' }}>*</span>
                  </Label>
                  {renderSpeechButton('startDate')}
                </div>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    setFormData({ ...formData, startDate: e.target.value });
                    if (touched.startDate) setErrors((prev) => ({ ...prev, startDate: validateField('startDate', e.target.value) }));
                    // Revalider endDate si elle existe
                    if (formData.endDate) {
                      const endError = validateField('endDate', formData.endDate);
                      setErrors((prev) => ({ ...prev, endDate: endError }));
                    }
                  }}
                  onBlur={() => handleBlur('startDate')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.startDate && errors.startDate ? 'border-red-500' : 'border-border'}`}
                />
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {activeSpeechField === 'startDate'
                    ? tr('Say a date like 12/04/2026.', 'Dites une date comme 12/04/2026.', 'Say a date like 12/04/2026.')
                    : tr('Voice input supported for this date.', 'La dictee vocale est supportee pour cette date.', 'Voice input supported for this date.')}
                </p>
                {touched.startDate && errors.startDate && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.startDate}</p>}
              </div>

              {/* Date de fin */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="endDate" className="text-base font-semibold">
                    Date de fin <span style={{ color: 'red' }}>*</span>
                  </Label>
                  {renderSpeechButton('endDate')}
                </div>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => {
                    setFormData({ ...formData, endDate: e.target.value });
                    if (touched.endDate) setErrors((prev) => ({ ...prev, endDate: validateField('endDate', e.target.value) }));
                  }}
                  onBlur={() => handleBlur('endDate')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.endDate && errors.endDate ? 'border-red-500' : 'border-border'}`}
                />
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {activeSpeechField === 'endDate'
                    ? tr('Say a date like 30/04/2026.', 'Dites une date comme 30/04/2026.', 'Say a date like 30/04/2026.')
                    : tr('Voice input supported for this date.', 'La dictee vocale est supportee pour cette date.', 'Voice input supported for this date.')}
                </p>
                {touched.endDate && errors.endDate && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.endDate}</p>}
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !validateForm()}
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Création...' : 'Créer le projet'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setView('list')} className="h-12 px-8 rounded-xl border-2">
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // --- Vue Édition ---
  if (view === 'edit' && selectedProject) {
    return (
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setView('details')} className="mb-6 rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Retour au projet
        </Button>
        <Card className="p-10 bg-card rounded-2xl border border-border shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">Modifier le projet</h2>
          <form className="space-y-6" onSubmit={handleUpdateProject}>
            {/* Titre */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="title" className="text-base font-semibold">
                  Titre du projet <span style={{ color: 'red' }}>*</span>
                </Label>
                {renderSpeechButton('title')}
              </div>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => {
                  updateFieldValue('title', e.target.value);
                }}
                onBlur={() => handleBlur('title')}
                placeholder="Entrez le titre du projet"
                className={`h-12 rounded-xl border-2 focus:border-primary ${touched.title && errors.title ? 'border-red-500' : 'border-border'}`}
              />
              {touched.title && errors.title && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.title}</p>}
            </div>

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
                  updateFieldValue('description', e.target.value);
                }}
                onBlur={() => handleBlur('description')}
                placeholder="Décrivez votre projet (minimum 10 caractères)"
                rows={4}
                className={`rounded-xl border-2 focus:border-primary ${touched.description && errors.description ? 'border-red-500' : 'border-border'}`}
              />
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {activeSpeechField === 'description'
                  ? tr('Voice input active for description.', 'Dictee vocale active pour la description.', 'Voice input active for description.')
                  : tr('You can type or use voice input.', 'Vous pouvez taper ou utiliser la dictee vocale.', 'You can type or use voice input.')}
              </p>
              {touched.description && errors.description && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.description}</p>}
            </div>

            {/* Localisation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="location-edit" className="text-base font-semibold">
                  Localisation <span style={{ color: 'red' }}>*</span>
                </Label>
                {renderSpeechButton('location')}
              </div>
              <LocationInput
                inputId="location-edit"
                value={formData.location}
                onChange={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(false);
                  if (touched.location) setErrors((prev) => ({ ...prev, location: validateField('location', value) }));
                }}
                onSelect={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(true);
                  if (touched.location) setErrors((prev) => ({ ...prev, location: '' }));
                }}
                onBlur={() => handleBlur('location')}
                allowedStates={getProfileLocations()}
                error={touched.location && errors.location ? errors.location : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Saisissez une ville; seules les villes dans vos gouvernorats de profil sont acceptees.
              </p>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {activeSpeechField === 'location'
                  ? tr('Voice input active for location.', 'Dictee vocale active pour la localisation.', 'Voice input active for location.')
                  : tr('You can type or use voice input for location.', 'Vous pouvez taper ou utiliser la dictee vocale pour la localisation.', 'You can type or use voice input for location.')}
              </p>
              {touched.location && errors.location && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.location}</p>}
            </div>

            {/* Dates côte à côte */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Date de début */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="startDate" className="text-base font-semibold">
                    Date de début <span style={{ color: 'red' }}>*</span>
                  </Label>
                  {renderSpeechButton('startDate')}
                </div>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    setFormData({ ...formData, startDate: e.target.value });
                    if (touched.startDate) setErrors((prev) => ({ ...prev, startDate: validateField('startDate', e.target.value) }));
                    if (formData.endDate) {
                      const endError = validateField('endDate', formData.endDate);
                      setErrors((prev) => ({ ...prev, endDate: endError }));
                    }
                  }}
                  onBlur={() => handleBlur('startDate')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.startDate && errors.startDate ? 'border-red-500' : 'border-border'}`}
                />
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {activeSpeechField === 'startDate'
                    ? tr('Say a date like 12/04/2026.', 'Dites une date comme 12/04/2026.', 'Say a date like 12/04/2026.')
                    : tr('Voice input supported for this date.', 'La dictee vocale est supportee pour cette date.', 'Voice input supported for this date.')}
                </p>
                {touched.startDate && errors.startDate && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.startDate}</p>}
              </div>

              {/* Date de fin */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="endDate" className="text-base font-semibold">
                    Date de fin <span style={{ color: 'red' }}>*</span>
                  </Label>
                  {renderSpeechButton('endDate')}
                </div>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => {
                    setFormData({ ...formData, endDate: e.target.value });
                    if (touched.endDate) setErrors((prev) => ({ ...prev, endDate: validateField('endDate', e.target.value) }));
                  }}
                  onBlur={() => handleBlur('endDate')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.endDate && errors.endDate ? 'border-red-500' : 'border-border'}`}
                />
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {activeSpeechField === 'endDate'
                    ? tr('Say a date like 30/04/2026.', 'Dites une date comme 30/04/2026.', 'Say a date like 30/04/2026.')
                    : tr('Voice input supported for this date.', 'La dictee vocale est supportee pour cette date.', 'Voice input supported for this date.')}
                </p>
                {touched.endDate && errors.endDate && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.endDate}</p>}
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !validateForm()}
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enregistrer les modifications
              </Button>
              <Button type="button" variant="outline" onClick={() => setView('list')} className="h-12 px-8 rounded-xl border-2">
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // VUE 3 : DÉTAILS
  // =========================================================================
  if (view === 'details' && selectedProject) {
    const status = selectedProject.status || 'active';
    const priority = selectedProject.priority || 'medium';
    const tasks = normalizeTasks(selectedProject.tasks);
    const todoTasks = tasks.filter((task) => task.status !== 'done');
    const doneTasks = tasks.filter((task) => task.status === 'done');
    const progress = getProjectProgress(selectedProject);

    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" /> {tr('Back to Projects', 'Retour aux projets', 'Back to Projects')}
        </Button>
        <div className="grid lg:grid-cols-1 gap-6">
          <div className="space-y-6">
            <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-foreground mb-3">{selectedProject.title}</h2>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusColor(status)} px-4 py-1.5 text-sm font-semibold border-2`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                    <Badge className={`${getPriorityColor(priority)} px-4 py-1.5 text-sm font-semibold border-2`}>
                      {priority}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl border-2"
                  onClick={() => guard(() => setView('edit'))}
                >
                  <Edit size={16} className="mr-2" /> Edit
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-foreground mb-3">Description</h4>
                  <p className="text-muted-foreground leading-relaxed">{selectedProject.description}</p>
                </div>

                <div className="pt-6 border-t-2 border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-foreground">{tr('Project Progress', 'Progression du projet', 'Project Progress')}</h4>
                    <span className="text-4xl font-bold text-primary">{progress}%</span>
                  </div>
                  <div className="h-4 rounded-full overflow-hidden bg-gray-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-border space-y-4">
                  <h4 className="text-lg font-semibold text-foreground">Tasks</h4>
                  <div className="flex flex-col md:flex-row gap-3">
                    <Input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder={tr('Add a new task...', 'Ajouter une nouvelle tache...', 'Add a new task...')}
                      className="h-11 rounded-xl border-2 border-border"
                    />
                    <Button
                      type="button"
                      className="h-11 px-6 rounded-xl bg-primary dark:bg-blue-600 text-white hover:bg-primary/90"
                      onClick={handleAddTask}
                      disabled={!newTaskTitle.trim()}
                    >
                      Add Task
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-semibold text-foreground">To Do</h5>
                    {todoTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{tr('No tasks in To Do.', 'Aucune tache a faire.', 'No tasks in To Do.')}</p>
                    ) : (
                      todoTasks.map((task) => (
                        <div key={task._id} className="p-4 rounded-xl border border-border bg-muted/50">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            {editingTaskId === task._id ? (
                              <Input
                                value={editingTaskTitle}
                                onChange={(e) => setEditingTaskTitle(e.target.value)}
                                className="h-10 rounded-lg border-2 border-border"
                              />
                            ) : (
                              <div className="flex items-center gap-3">
                                <p className="font-medium text-foreground">{task.title}</p>
                                <Badge className="bg-muted text-foreground border border-border">
                                  {task.status === 'in_progress' ? 'In Progress' : 'To Do'}
                                </Badge>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {task.status === 'todo' && (
                                <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleTaskStatusChange(task._id, 'in_progress')}>
                                  In Progress
                                </Button>
                              )}
                              {task.status === 'in_progress' && (
                                <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleTaskStatusChange(task._id, 'done')}>
                                  Done
                                </Button>
                              )}
                              {editingTaskId === task._id ? (
                                <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleSaveTaskEdit(task._id)}>
                                  Save
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-lg"
                                  onClick={() => {
                                    setEditingTaskId(task._id);
                                    setEditingTaskTitle(task.title);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button type="button" variant="outline" className="h-9 rounded-lg text-red-600 hover:text-red-700" onClick={() => handleDeleteTask(task._id)}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-semibold text-foreground">Done</h5>
                    {doneTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{tr('No completed tasks yet.', 'Aucune tache terminee pour le moment.', 'No completed tasks yet.')}</p>
                    ) : (
                      doneTasks.map((task) => (
                        <div key={task._id} className="p-4 rounded-xl border border-green-200 bg-green-50/50">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            {editingTaskId === task._id ? (
                              <Input
                                value={editingTaskTitle}
                                onChange={(e) => setEditingTaskTitle(e.target.value)}
                                className="h-10 rounded-lg border-2 border-border"
                              />
                            ) : (
                              <div className="flex items-center gap-3">
                                <p className="font-medium text-foreground">{task.title}</p>
                                <Badge className="bg-green-100 text-green-700 border border-green-200">Done</Badge>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleTaskStatusChange(task._id, 'in_progress')}>
                                In Progress
                              </Button>
                              {editingTaskId === task._id ? (
                                <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleSaveTaskEdit(task._id)}>
                                  Save
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-lg"
                                  onClick={() => {
                                    setEditingTaskId(task._id);
                                    setEditingTaskTitle(task.title);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button type="button" variant="outline" className="h-9 rounded-lg text-red-600 hover:text-red-700" onClick={() => handleDeleteTask(task._id)}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
        {PopupElement}
      </div>
    );
  }

  // =========================================================================
  // VUE 5 : PROJECT MATERIALS
  // =========================================================================
  if (view === 'materials' && selectedProject) {
    const selectedProjectProgress = getProjectProgress(selectedProject);
    const isSelectedProjectCompleted = selectedProjectProgress >= 100;
    const materialsList = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
    const personalMaterialsList = Array.isArray(selectedProject.personalMaterials) ? selectedProject.personalMaterials : [];
    const groupedMaterials = Object.values(
      materialsList.reduce((acc: Record<string, { item: any; quantity: number }>, mat: any) => {
        const matId = String((mat && (mat._id || mat)) || '');
        if (!matId) return acc;
        if (!acc[matId]) {
          acc[matId] = { item: mat, quantity: 0 };
        }
        acc[matId].quantity += 1;
        return acc;
      }, {})
    );

    // +/- local uniquement (sans appel API)
    const handleAdjustLocalQuantity = (materialId: string, delta: number) => {
      const sourceMaterials = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
      const currentCount = localQuantities[materialId] ?? 1;

      if (delta < 0 && currentCount <= 1) return;

      if (delta > 0) {
        const mat = sourceMaterials.find((m: any) => String((m && (m._id || m)) || '') === materialId);
        const maxStock = Number(mat?.stock || 0);
        if (maxStock > 0 && currentCount >= maxStock) {
          toast.warning(`Maximum stock reached (${maxStock} units available).`);
          return;
        }
      }

      setLocalQuantities(prev => ({ ...prev, [materialId]: currentCount + delta }));
    };

    // Confirme la quantité choisie → sauvegarde en base
    const confirmMaterialQuantity = async (materialId: string) => {
      try {
        setConfirmingMaterialId(materialId);
        let token = localStorage.getItem('token');
        if (!token && localStorage.getItem('user')) token = JSON.parse(localStorage.getItem('user')!).token;

        const newQty = localQuantities[materialId] ?? 1;
        const sourceMaterials = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
        const allIds = sourceMaterials.map((mat: any) => String((mat && (mat._id || mat)) || '')).filter(Boolean);

        const otherIds = allIds.filter((id: string) => id !== materialId);
        const updatedIds = [...otherIds, ...Array(newQty).fill(materialId)];

        const res = await axios.put(
          `${API_URL}/projects/${selectedProject._id}`,
          { materials: updatedIds },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // res.data.materials is already populated by the backend (.populate('materials'))
        // Use it directly — no manual hydration needed
        setSelectedProject(res.data);

        // Re-compute localQuantities from the saved data
        const savedMats = Array.isArray(res.data.materials) ? res.data.materials : [];
        const newLocal: Record<string, number> = {};
        savedMats.forEach((mat: any) => {
          const id = String((mat && (mat._id || mat)) || '');
          if (id) newLocal[id] = (newLocal[id] || 0) + 1;
        });
        setLocalQuantities(newLocal);

        await fetchProjects();
        toast.success(tr('Quantity confirmed!', 'Quantite confirmee !', 'Quantity confirmed!'));
      } catch (err) {
        console.error('Failed to confirm quantity', err);
        toast.error(tr('Error saving quantity', 'Erreur lors de l\'enregistrement de la quantite'));
      } finally {
        setConfirmingMaterialId(null);
      }
    };

    const handleAdjustPersonalLocalQuantity = (materialId: string, delta: number) => {
      const material = personalMaterialsList.find((m: any, idx: number) => String(m?._id || `personal-${idx}`) === materialId);
      const savedQty = Number(material?.stock);
      const currentCount = localPersonalQuantities[materialId] ?? (Number.isFinite(savedQty) && savedQty > 0 ? savedQty : 1);
      if (delta < 0 && currentCount <= 1) return;
      setLocalPersonalQuantities((prev) => ({ ...prev, [materialId]: currentCount + delta }));
    };

    const confirmPersonalMaterialQuantity = async (materialId: string) => {
      if (!selectedProject?._id) return;
      try {
        setConfirmingPersonalMaterialId(materialId);
        const token = getToken();
        const existing = Array.isArray(selectedProject.personalMaterials) ? selectedProject.personalMaterials : [];
        const updatedPersonalMaterials = existing.map((mat: any, idx: number) => {
          const id = String(mat?._id || `personal-${idx}`);
          if (id !== materialId) return mat;
          const newQty = Math.max(1, Number(localPersonalQuantities[materialId] ?? mat?.stock ?? 1));
          return { ...mat, stock: newQty };
        });

        const res = await axios.put(
          `${API_URL}/projects/${selectedProject._id}`,
          { personalMaterials: updatedPersonalMaterials },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setSelectedProject(res.data);
        await fetchProjects();
        toast.success(tr('Quantity saved!', 'Quantite enregistree !', 'Quantity saved!'));
      } catch (error) {
        console.error('Failed to save personal material quantity', error);
        toast.error(tr('Error saving quantity', 'Erreur lors de l\'enregistrement de la quantite'));
      } finally {
        setConfirmingPersonalMaterialId(null);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" /> {tr('Back to Projects', 'Retour aux projets', 'Back to Projects')}
          </Button>
          <h2 className="text-2xl font-bold">{tr('Materials for', 'Materiaux pour', 'Materials for')} {selectedProject.title}</h2>
          {!isSelectedProjectCompleted ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => guard(() => { window.location.href = '/?artisanView=marketplace&projectId=' + selectedProject._id; })}
                className="rounded-xl bg-secondary hover:bg-secondary/90 text-white"
              >
                <ShoppingCart size={20} className="mr-2" /> From Marketplace
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPersonalMaterialForm((prev) => !prev)}
                className="rounded-xl border-2"
              >
                <Plus size={16} className="mr-2" /> Personal Material
              </Button>
            </div>
          ) : (
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
              Project completed
            </span>
          )}
        </div>

        {showPersonalMaterialForm && !isSelectedProjectCompleted && (
          <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
            <h3 className="text-2xl font-bold text-foreground mb-6">Add Personal Material</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="font-semibold text-foreground">Product Name</Label>
                <Input
                  value={personalMaterialForm.name}
                  onChange={(e) => setPersonalMaterialForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-12 rounded-xl border-2 border-border"
                  placeholder="Enter material name"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-semibold text-foreground">Category</Label>
                  <select
                    value={personalMaterialForm.category}
                    onChange={(e) => setPersonalMaterialForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full h-12 px-4 border-2 border-border rounded-xl bg-card outline-none"
                  >
                    <option value="Maçonnerie">Maçonnerie</option>
                    <option value="Béton & Ciment">Béton & Ciment</option>
                    <option value="Ferraillage">Ferraillage</option>
                    <option value="Électricité">Électricité</option>
                    <option value="Plomberie">Plomberie</option>
                    <option value="Menuiserie">Menuiserie</option>
                    <option value="Outillage">Outillage</option>
                    <option value="EPI">EPI (Sécurité)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-foreground">Price (TND)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={personalMaterialForm.price}
                    onChange={(e) => setPersonalMaterialForm((prev) => ({ ...prev, price: e.target.value }))}
                    className="h-12 rounded-xl border-2 border-border"
                    placeholder="0.000"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-semibold text-foreground">Stock (Units)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={personalMaterialForm.stock}
                    onChange={(e) => setPersonalMaterialForm((prev) => ({ ...prev, stock: e.target.value }))}
                    className="h-12 rounded-xl border-2 border-border"
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-foreground">Image (JPG, PNG)</Label>
                  <div
                    onClick={() => personalMaterialImageInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 h-32 flex flex-col items-center justify-center cursor-pointer transition-colors ${selectedPersonalImageFile ? 'border-green-500 bg-green-50' : 'border-border hover:border-primary hover:bg-muted/50'}`}
                  >
                    {selectedPersonalImageFile ? (
                      <>
                        <CheckCircle size={32} className="text-green-500 mb-2" />
                        <p className="text-xs text-green-700 font-medium truncate max-w-full">{selectedPersonalImageFile.name}</p>
                      </>
                    ) : (
                      <>
                        <Upload size={32} className="text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload photo</p>
                      </>
                    )}
                    <input
                      ref={personalMaterialImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedPersonalImageFile(file);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-foreground">Description (Optional)</Label>
                <Textarea
                  rows={4}
                  value={personalMaterialForm.description}
                  onChange={(e) => setPersonalMaterialForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="rounded-xl border-2 border-border"
                  placeholder="Material details, dimensions, usage..."
                />
              </div>

              <div className="flex gap-4 pt-2 border-t border-border">
                <Button
                  onClick={savePersonalMaterial}
                  disabled={isSavingPersonalMaterial}
                  className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
                >
                  {isSavingPersonalMaterial ? 'Saving...' : 'Save Material'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPersonalMaterialForm(false);
                    resetPersonalMaterialForm();
                  }}
                  className="h-12 px-8 rounded-xl border-2"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
          <h3 className="text-xl font-bold mb-4">Marketplace Materials</h3>
          {groupedMaterials.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No materials added to this project yet.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {groupedMaterials.map((entry: any, i: number) => {
                const m = entry.item;
                const quantity = entry.quantity;
                const materialId = String((m && (m._id || m)) || '');
                return (
                <div key={materialId || i} className="border p-5 rounded-2xl flex flex-col justify-between items-start gap-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    {m.image && <img src={m.image} alt={m.name} className="w-16 h-16 object-cover rounded-xl shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base leading-tight truncate">{m.name || 'Material'}</p>
                      <p className="text-sm font-semibold text-primary mt-0.5">{m.price ? m.price + ' TND / unit' : ''}</p>
                      {m.stock !== undefined && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Stock available: <span className="font-semibold">{m.stock}</span>
                        </p>
                      )}
                      {/* Quantity adjuster */}
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-muted-foreground">Qty:</span>
                        <div className="flex items-center gap-1 rounded-xl border-2 border-border overflow-hidden">
                          <button
                            type="button"
                            className="h-8 w-8 flex items-center justify-center text-base font-bold hover:bg-muted transition-colors disabled:opacity-40"
                            disabled={(localQuantities[materialId] ?? quantity) <= 1}
                            onClick={() => handleAdjustLocalQuantity(materialId, -1)}
                          >
                            −
                          </button>
                          <div className="min-w-[32px] text-center font-bold text-sm">
                            {localQuantities[materialId] ?? quantity}
                          </div>
                          <button
                            type="button"
                            className="h-8 w-8 flex items-center justify-center text-base font-bold hover:bg-muted transition-colors"
                            onClick={() => handleAdjustLocalQuantity(materialId, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {/* Saved quantity indicator */}
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Saved: {quantity} unit{quantity > 1 ? 's' : ''} · Total: {((m.price || 0) * quantity).toFixed(2)} TND
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full mt-2">
                    {/* Confirm button — also always visible at bottom for convenience */}
                    <button
                      type="button"
                      disabled={confirmingMaterialId === materialId || (localQuantities[materialId] ?? quantity) === quantity}
                      onClick={() => confirmMaterialQuantity(materialId)}
                      className="flex-1 rounded-xl py-2 text-sm font-semibold border border-emerald-600 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: (localQuantities[materialId] ?? quantity) !== quantity ? '#10b981' : 'rgba(16,185,129,0.15)', color: (localQuantities[materialId] ?? quantity) !== quantity ? 'white' : '#065f46' }}
                    >
                      {confirmingMaterialId === materialId ? 'Saving…' : (localQuantities[materialId] ?? quantity) !== quantity ? '✓ Confirm Qty' : '✓ Saved'}
                    </button>
                    <Button variant="outline" className="flex-1 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 rounded-xl py-2 text-sm" onClick={async () => {
                      try {
                        let token = localStorage.getItem('token'); if (!token && localStorage.getItem('user')) token = JSON.parse(localStorage.getItem('user')!).token;
                        const sourceMaterials = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
                        const updatedMaterials = sourceMaterials
                          .map((mat: any) => mat._id || mat)
                          .filter((id: any) => String(id) !== materialId);
                        const res = await axios.put(`${API_URL}/projects/${selectedProject._id}`, { materials: updatedMaterials }, { headers: { Authorization: `Bearer ${token}` } });
                        setSelectedProject(res.data);
                        await fetchProjects();
                      } catch (err) { console.error('Failed to remove', err); toast.error(tr('Error removing material', 'Erreur lors de la suppression du materiau', 'Error removing material')); }
                    }}>🗑 Remove</Button>
                  </div>
                </div>
              )})}
            </div>
          )}
        </Card>

        <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
          <h3 className="text-xl font-bold mb-4">Personal Materials</h3>
          {personalMaterialsList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No personal materials yet.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {personalMaterialsList.map((material: any, idx: number) => (
                <div key={material._id || `personal-${idx}`} className="border p-5 rounded-2xl flex flex-col gap-3 hover:shadow-md transition-shadow">
                  {material.image ? (
                    <img src={toPublicAssetUrl(material.image)} alt={material.name} className="w-full h-32 object-cover rounded-xl" />
                  ) : (
                    <div className="w-full h-32 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-sm">No image</div>
                  )}
                  <p className="font-bold text-base truncate">{material.name || 'Material'}</p>
                  <p className="text-sm text-primary font-semibold">{Number(material.price || 0).toFixed(3)} TND</p>
                  <p className="text-xs text-muted-foreground">Category: {material.category || 'N/A'}</p>
                  {(() => {
                    const materialId = String(material._id || `personal-${idx}`);
                    const savedQtyRaw = Number(material.stock);
                    const savedQty = Number.isFinite(savedQtyRaw) && savedQtyRaw > 0 ? savedQtyRaw : 1;
                    const draftQty = localPersonalQuantities[materialId] ?? savedQty;
                    const hasQtyChange = draftQty !== savedQty;

                    return (
                      <>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">Qty:</span>
                          <div className="flex items-center gap-1 rounded-xl border-2 border-border overflow-hidden">
                            <button
                              type="button"
                              className="h-8 w-8 flex items-center justify-center text-base font-bold hover:bg-muted transition-colors disabled:opacity-40"
                              disabled={draftQty <= 1}
                              onClick={() => handleAdjustPersonalLocalQuantity(materialId, -1)}
                            >
                              −
                            </button>
                            <div className="min-w-[32px] text-center font-bold text-sm">{draftQty}</div>
                            <button
                              type="button"
                              className="h-8 w-8 flex items-center justify-center text-base font-bold hover:bg-muted transition-colors"
                              onClick={() => handleAdjustPersonalLocalQuantity(materialId, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Saved: {savedQty} unit{savedQty > 1 ? 's' : ''} · Total: {(Number(material.price || 0) * savedQty).toFixed(2)} TND
                        </p>
                        <button
                          type="button"
                          disabled={confirmingPersonalMaterialId === materialId || !hasQtyChange}
                          onClick={() => confirmPersonalMaterialQuantity(materialId)}
                          className="w-full rounded-xl py-2 text-sm font-semibold border border-emerald-600 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ backgroundColor: hasQtyChange ? '#10b981' : 'rgba(16,185,129,0.15)', color: hasQtyChange ? 'white' : '#065f46' }}
                        >
                          {confirmingPersonalMaterialId === materialId ? 'Saving…' : hasQtyChange ? '✓ Confirm Qty' : '✓ Saved'}
                        </button>
                      </>
                    );
                  })()}
                  {material.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{material.description}</p>
                  )}
                  {!isSelectedProjectCompleted && (
                    <Button
                      variant="outline"
                      onClick={() => removePersonalMaterial(String(material._id || ''))}
                      className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
        {PopupElement}
      </div>
    );
  }

  if (showRecommendation && materialProjectContext) {
    return (
      <MaterialRecommendation
        project={materialProjectContext}
        onBack={() => {
          setShowRecommendation(false);
        }}
        onAddToProject={handleRecommendationAddToProject}
      />
    );
  }

  // =========================================================================
  // VUE 4 : LISTE PRINCIPALE (Par défaut)
  // =========================================================================
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-lg text-muted-foreground">{tr('Manage and track all your construction projects', 'Gerez et suivez tous vos projets de construction', 'Manage and track all your construction projects')}</p>
        </div>
        <Button onClick={() => guard(handleCreateView)} className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
          <Plus size={20} className="mr-2" /> {tr('Create Project', 'Creer un projet', 'Create Project')}
        </Button>
      </div>

      <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
          <div className="flex-1 h-12 rounded-xl border-2 border-border bg-card px-3 flex items-center gap-2">
            <Search className="text-muted-foreground shrink-0" size={18} />
            <Input
              placeholder={tr('Search projects...', 'Rechercher des projets...', 'Search projects...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-full px-0"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:w-auto">
            <div className="h-12 rounded-xl border-2 border-border bg-card px-3 flex items-center gap-2 min-w-[170px] overflow-hidden focus-within:border-border transition-colors">
              <Filter className="text-muted-foreground shrink-0" size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'pending' | 'completed')}
                className="h-full w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0 outline-none cursor-pointer"
                style={{ WebkitAppearance: 'none', appearance: 'none', background: 'transparent' }}
              >
                <option value="all">{tr('All Status', 'Tous les statuts', 'All Status')}</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="h-12 rounded-xl border-2 border-border bg-card px-3 flex items-center min-w-[170px] overflow-hidden focus-within:border-border transition-colors">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'all' | 'low' | 'medium' | 'high')}
                className="h-full w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0 outline-none cursor-pointer"
                style={{ WebkitAppearance: 'none', appearance: 'none', background: 'transparent' }}
              >
                <option value="all">{tr('All Priority', 'Toutes les priorites', 'All Priority')}</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading your projects...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-2xl border border-border shadow-lg border border-border">
          <FolderKanban className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-xl font-semibold text-muted-foreground">No projects found.</p>
          <p className="text-muted-foreground mt-2">{tr('Click "Create Project" to get started!', 'Cliquez sur "Creer un projet" pour commencer !', 'Click "Create Project" to get started!')}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredProjects.map((project) => {
            const status = project.status || 'active';
            const priority = project.priority || 'medium';
            const projectProgress = getProjectProgress(project);
            const isProjectCompleted = status === 'completed' || projectProgress >= 100;
            
            return (
              <Card key={project._id} className="p-6 bg-card rounded-2xl border border-border shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-3">{project.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(status)} px-3 py-1 text-xs font-semibold border-2`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                      <Badge className={`${getPriorityColor(priority)} px-3 py-1 text-xs font-semibold border-2`}>
                        {priority}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6 leading-relaxed line-clamp-2">
                  {project.description}
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <MapPin size={16} className="text-primary" /> {project.location}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <DollarSign size={16} className="text-accent" /> 
                    Budget: <strong className="text-foreground">{project.budget?.toLocaleString() || 0} TND</strong>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Calendar size={16} className="text-secondary" />
                    {formatDate(project.startDate)} - {formatDate(project.endDate)}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Progress</span>
                    <span className="text-2xl font-bold text-primary">{projectProgress}%</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden bg-gray-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${projectProgress}%` }} />
                  </div>
                </div>

                {isProjectCompleted && (
                  <Button
                    type="button"
                    className="w-full h-10 rounded-xl bg-primary dark:bg-blue-600 text-white hover:bg-primary/90 mb-4"
                    onClick={() => guard(() => handleAddProjectToPortfolio(project._id))}
                    disabled={addingToPortfolio}
                  >
                    {addingToPortfolio ? 'Adding...' : 'Add to Portfolio'}
                  </Button>
                )}

                <div className="space-y-2 mb-4">
                  {!isProjectCompleted && (
                    <Button onClick={() => guard(() => openAddMaterialOptions(project))} className="w-full h-10 justify-start text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-md">
                      <ShoppingCart size={16} className="mr-2" /> {tr('Add Material', 'Ajouter un materiau', 'Add Material')}
                    </Button>
                  )}
                  {(Array.isArray(project.materials) && project.materials.length > 0)
                    || (Array.isArray(project.personalMaterials) && project.personalMaterials.length > 0) ? (
                    <Button onClick={() => guard(() => { setSelectedProject(project); setView('materials'); })} className="w-full h-10 justify-start text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md">
                      <FolderKanban size={16} className="mr-2" /> {tr('View Materials', 'Voir les materiaux', 'View Materials')}
                    </Button>
                  ) : null}
                  <Button
                    className="w-full h-10 justify-start text-white bg-accent hover:bg-accent/90 rounded-xl shadow-md"
                    onClick={() => guard(() => {
                      window.location.href = '/?artisanView=quotes&projectId=' + project._id;
                    })}
                  >
                    <FileText size={16} className="mr-2" /> {tr('Create Quote', 'Creer un devis', 'Create Quote')}
                  </Button>
                  <Button
                    className="w-full h-10 justify-start text-white bg-primary hover:bg-primary/90 dark:bg-secondary dark:hover:bg-secondary/90 rounded-xl shadow-md"
                    onClick={() => guard(() => {
                      // Generate Invoice action
                    })}
                  >
                    <Receipt size={16} className="mr-2" /> {tr('Generate Invoice', 'Generer une facture', 'إنشاء فاتورة')}
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-2 hover:bg-primary hover:text-white hover:border-primary"
                    onClick={() => guard(() => { setSelectedProject(project); setView('details'); })}
                  >
                    <Eye size={16} className="mr-2" /> View
                  </Button>
                  <Button
  variant="outline"
  className="h-11 px-4 rounded-xl border-2 hover:bg-primary hover:text-white hover:border-primary"
  onClick={() => guard(() => {
    setSelectedProject(project);
    setView('edit');
  })}
>
  <Edit size={16} />
</Button>
                  
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showAddMaterialOptions && materialProjectContext && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => {
            setShowAddMaterialOptions(false);
            setMaterialProjectContext(null);
          }}
        >
          <Card
            className="w-full max-w-xl rounded-2xl border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            <div className="h-2 bg-gradient-to-r from-primary via-secondary to-accent" />
            <div className="p-6 md:p-7">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-1">{tr('Add Materials', 'Ajouter des materiaux', 'Add Materials')}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tr('Choose how you want to add materials to', 'Choisissez comment ajouter des materiaux a', 'Choose how you want to add materials to')} <span className="font-semibold text-foreground">{materialProjectContext.title}</span>.
                  </p>
                </div>
                <button
                  type="button"
                  className="h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                  onClick={() => {
                    setShowAddMaterialOptions(false);
                    setMaterialProjectContext(null);
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid gap-3 mb-6">
                <button
                  type="button"
                  onClick={handleAddFromMarketplace}
                  className="w-full text-left rounded-2xl border border-secondary/30 bg-secondary/10 hover:bg-secondary/15 transition-colors p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-secondary text-white flex items-center justify-center shrink-0">
                      <ShoppingCart size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Add From Marketplace</p>
                      <p className="text-xs text-muted-foreground mt-1">Browse products, choose quantity, and attach them to this project.</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPersonalMaterialForm}
                  className="w-full text-left rounded-2xl border border-primary/30 bg-primary/10 hover:bg-primary/15 transition-colors p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                      <Plus size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Add Personal Material</p>
                      <p className="text-xs text-muted-foreground mt-1">Create your own material with custom price, quantity, image, and description.</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleOpenSmartRecommendation}
                  className="w-full text-left rounded-2xl border p-4 transition-colors"
                  style={{ borderColor: 'rgba(139,92,246,0.35)', backgroundColor: 'rgba(139,92,246,0.08)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(139,92,246,0.14)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(139,92,246,0.08)')}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                      style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                    >
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">Smart Recommendation</p>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                        >
                          AI
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Get scored recommendations based on your need, budget, stock, and tech sheets.</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddMaterialOptions(false);
                    setMaterialProjectContext(null);
                  }}
                  className="flex-1 h-11 rounded-xl border-2"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {PopupElement}
    </div>
  );
}

