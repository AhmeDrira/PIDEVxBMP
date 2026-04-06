import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Search, MapPin, Star, MessageSquare, Briefcase, SlidersHorizontal, X, ChevronDown, ChevronUp, Sparkles, Wand2, LoaderCircle } from 'lucide-react';
import ViewArtisanProfile from './ViewArtisanProfile';
import ArtisanPortfolioPage from './ArtisanPortfolioPage';
import ExpertPortfolioItemPage from './ExpertPortfolioItemPage';

interface ExpertArtisanDirectoryProps { onNavigate: (view: string) => void; }
interface Artisan {
  id: string; name: string; specialization: string; location: string; experience: string; yearsExperience: number;
  bio: string; rating: number; reviews: number; completedProjects: number; skills: string[];
  aiScore?: number; aiMatchPercent?: number; aiReason?: string;
  similarProjectsCount?: number; similarProjectExamples?: string[]; matchHighlights?: string[];
}
interface AiSearchMeta {
  query: string; total: number;
  analysis?: { matchedDomains?: string[]; matchedLocations?: string[]; minYearsExperience?: number | null; requiresCertification?: boolean; sortBy?: string; sortDirection?: string; semanticMode?: string; };
}
type Page =
  | { type: 'directory' }
  | { type: 'profile'; artisanId: string; artisanName: string; artisanDomain: string }
  | { type: 'portfolio'; artisanId: string; artisanName: string; artisanDomain: string }
  | { type: 'portfolioItem'; artisanId: string; artisanName: string; itemId: string };
interface ArtisanFilters { specializations: string[]; locations: string[]; minRating: number; }

const SPECIALIZATIONS = ['Masonry', 'Concrete Work', 'Foundation Construction', 'Plumbing', 'Electrical Installation', 'Carpentry', 'Painting', 'Tiling', 'Plastering', 'Roofing', 'Waterproofing', 'HVAC', 'Metal Work', 'Aluminum Work'];
const TUNISIA_LOCATIONS = ['Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Beja', 'Jendouba', 'Kef', 'Siliana', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Sousse', 'Monastir', 'Mahdia', 'Sfax', 'Gafsa', 'Tozeur', 'Kebili', 'Gabes', 'Medenine', 'Tataouine'];
const getRatingOptions = (t: (key: string) => string) => [{ label: t('expert.directory.allRatings'), value: 0 }, { label: t('expert.directory.rating4Above'), value: 4 }, { label: t('expert.directory.rating3Above'), value: 3 }, { label: t('expert.directory.rating2Above'), value: 2 }];
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ExpertArtisanDirectory({ onNavigate }: ExpertArtisanDirectoryProps) {
  const { t, language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const specTranslationMap: Record<string, string> = {
    Masonry: t('spec.masonry'), 'Concrete Work': t('spec.concreteWork'), 'Foundation Construction': t('spec.foundationConstruction'),
    Plumbing: t('spec.plumbing'), 'Electrical Installation': t('spec.electricalInstallation'), Carpentry: t('spec.carpentry'),
    Painting: t('spec.painting'), Tiling: t('spec.tiling'), Plastering: t('spec.plastering'), Roofing: t('spec.roofing'),
    Waterproofing: t('spec.waterproofing'), HVAC: t('spec.hvac'), 'Metal Work': t('spec.metalWork'), 'Aluminum Work': t('spec.aluminumWork'),
  };
  const translateSpec = (value: string) => specTranslationMap[value] || value;
  const RATING_OPTIONS = getRatingOptions(t);

  const mapArtisans = (data: any[]): Artisan[] => data.map((item: any) => {
    const yearsExperience = Number(item.yearsExperience ?? item.experience ?? 0);
    return {
      id: item._id ?? item.id,
      name: `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || item.name || tr('Unknown artisan', 'Artisan inconnu', 'حرفي غير معروف'),
      specialization: item.domain || item.specialization || '',
      location: item.location || '',
      experience: tr(`${yearsExperience} years`, `${yearsExperience} ans`, `${yearsExperience} سنة`),
      yearsExperience,
      bio: item.bio || '',
      rating: Number(item.rating ?? 0),
      reviews: Number(item.reviewCount ?? item.reviews ?? 0),
      completedProjects: Number(item.completedProjects ?? item.portfolioCount ?? 0),
      skills: Array.isArray(item.skills) ? item.skills : [],
      aiScore: typeof item.aiScore === 'number' ? item.aiScore : undefined,
      aiMatchPercent: typeof item.aiMatchPercent === 'number' ? item.aiMatchPercent : undefined,
      aiReason: typeof item.aiReason === 'string' ? item.aiReason : undefined,
      similarProjectsCount: typeof item.similarProjectsCount === 'number' ? item.similarProjectsCount : undefined,
      similarProjectExamples: Array.isArray(item.similarProjectExamples) ? item.similarProjectExamples : [],
      matchHighlights: Array.isArray(item.matchHighlights) ? item.matchHighlights : [],
    };
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [page, setPage] = useState<Page>({ type: 'directory' });
  const [catalogArtisans, setCatalogArtisans] = useState<Artisan[]>([]);
  const [aiArtisans, setAiArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<AiSearchMeta | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ArtisanFilters>({ specializations: [], locations: [], minRating: 0 });
  const [pendingFilters, setPendingFilters] = useState<ArtisanFilters>({ specializations: [], locations: [], minRating: 0 });
  const [specExpanded, setSpecExpanded] = useState(false);
  const [locExpanded, setLocExpanded] = useState(false);
  const isAiActive = aiMeta !== null;

  const getToken = () => {
    let token: string | null = localStorage.getItem('token');
    if (!token) { try { token = JSON.parse(localStorage.getItem('user') || '{}').token || null; } catch { token = null; } }
    return token;
  };

  const fetchArtisans = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = searchQuery ? `${API_URL}/artisans/search?query=${encodeURIComponent(searchQuery)}` : `${API_URL}/artisans`;
      const response = await axios.get(endpoint);
      setCatalogArtisans(mapArtisans(Array.isArray(response.data) ? response.data : []));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || tr('Failed to load artisans', 'Chargement des artisans impossible', 'تعذر تحميل الحرفيين'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchArtisans(); }, [searchQuery]);

  const clearAiSearch = () => { setAiQuery(''); setAiArtisans([]); setAiMeta(null); setAiError(null); };

  const handleAiSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmedQuery = aiQuery.trim();
    if (!trimmedQuery) { clearAiSearch(); return; }
    try {
      setAiLoading(true);
      setAiError(null);
      const response = await axios.post(`${API_URL}/artisans/ai-search`, { query: trimmedQuery });
      const payload = response.data || {};
      const artisans = Array.isArray(payload.artisans) ? payload.artisans : [];
      setAiArtisans(mapArtisans(artisans));
      setAiMeta({ query: payload.query || trimmedQuery, total: Number(payload.total ?? artisans.length), analysis: payload.analysis });
    } catch (err: any) {
      setAiArtisans([]);
      setAiMeta({ query: trimmedQuery, total: 0 });
      setAiError(err?.response?.data?.message || err?.message || tr('AI search failed', 'La recherche IA a échoué', 'فشل البحث بالذكاء الاصطناعي'));
    } finally {
      setAiLoading(false);
    }
  };

  const displayedArtisans = useMemo(() => (isAiActive ? aiArtisans : catalogArtisans), [isAiActive, aiArtisans, catalogArtisans]);
  const filteredArtisans = useMemo(() => displayedArtisans.filter((artisan) => {
    const matchSpec = filters.specializations.length === 0 || filters.specializations.includes(artisan.specialization);
    const matchLoc = filters.locations.length === 0 || filters.locations.some((location) => artisan.location.toLowerCase().includes(location.toLowerCase()));
    const matchRating = filters.minRating === 0 || artisan.rating >= filters.minRating;
    return matchSpec && matchLoc && matchRating;
  }), [displayedArtisans, filters]);
  const activeFilterCount = filters.specializations.length + filters.locations.length + (filters.minRating > 0 ? 1 : 0);

  const handleApplyFilters = () => setFilters({ ...pendingFilters });
  const handleClearFilters = () => {
    const empty = { specializations: [], locations: [], minRating: 0 };
    setPendingFilters(empty);
    setFilters(empty);
  };
  const toggleSpec = (value: string) => setPendingFilters((previous) => ({ ...previous, specializations: previous.specializations.includes(value) ? previous.specializations.filter((entry) => entry !== value) : [...previous.specializations, value] }));
  const toggleLoc = (value: string) => setPendingFilters((previous) => ({ ...previous, locations: previous.locations.includes(value) ? previous.locations.filter((entry) => entry !== value) : [...previous.locations, value] }));
  const removeSpec = (value: string) => { setFilters((previous) => ({ ...previous, specializations: previous.specializations.filter((entry) => entry !== value) })); setPendingFilters((previous) => ({ ...previous, specializations: previous.specializations.filter((entry) => entry !== value) })); };
  const removeLoc = (value: string) => { setFilters((previous) => ({ ...previous, locations: previous.locations.filter((entry) => entry !== value) })); setPendingFilters((previous) => ({ ...previous, locations: previous.locations.filter((entry) => entry !== value) })); };
  const clearRating = () => { setFilters((previous) => ({ ...previous, minRating: 0 })); setPendingFilters((previous) => ({ ...previous, minRating: 0 })); };

  const handleContact = async (artisanId: string) => {
    try {
      const token = getToken();
      if (!token) { alert(t('expert.directory.pleaseLogin')); return; }
      const response = await axios.post(`${API_URL}/conversations`, { participantId: artisanId }, { headers: { Authorization: `Bearer ${token}` } });
      localStorage.setItem('selectedConversationId', response.data._id || response.data.id);
      onNavigate('messages');
    } catch (err: any) {
      alert(`${t('expert.directory.failedCreateConv')}: ${axios.isAxiosError(err) ? err.response?.data?.message || err.message : tr('Unknown error', 'Erreur inconnue', 'خطأ غير معروف')}`);
    }
  };

  const getAiSortLabel = (sortBy?: string) => sortBy === 'rating' ? tr('Priority: rating', 'Priorité : note', 'الأولوية: التقييم')
    : sortBy === 'completedProjects' ? tr('Priority: completed projects', 'Priorité : projets terminés', 'الأولوية: المشاريع المكتملة')
    : sortBy === 'yearsExperience' ? tr('Priority: experience', 'Priorité : expérience', 'الأولوية: الخبرة')
    : tr('Hybrid semantic ranking', 'Classement sémantique hybride', 'ترتيب دلالي هجين');

  if (page.type === 'portfolioItem') return <ExpertPortfolioItemPage artisanId={page.artisanId} itemId={page.itemId} artisanName={page.artisanName} onBack={() => setPage({ type: 'portfolio', artisanId: page.artisanId, artisanName: page.artisanName, artisanDomain: '' })} />;
  if (page.type === 'portfolio') return <ArtisanPortfolioPage artisanId={page.artisanId} artisanName={page.artisanName} artisanDomain={page.artisanDomain} onBack={() => setPage({ type: 'profile', artisanId: page.artisanId, artisanName: page.artisanName, artisanDomain: page.artisanDomain })} onViewItem={(itemId) => setPage({ type: 'portfolioItem', artisanId: page.artisanId, artisanName: page.artisanName, itemId })} />;
  if (page.type === 'profile') return <ViewArtisanProfile artisanId={page.artisanId} onBack={() => setPage({ type: 'directory' })} onContact={() => handleContact(page.artisanId)} onViewPortfolio={() => setPage({ type: 'portfolio', artisanId: page.artisanId, artisanName: page.artisanName, artisanDomain: page.artisanDomain })} />;

  const filterPanel = (
    <Card className="sticky top-8 w-full flex-shrink-0 rounded-2xl border border-border border-t-4 border-t-primary bg-card p-6 shadow-lg lg:w-80">
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4"><div className="flex items-center gap-2"><SlidersHorizontal size={20} className="text-primary" /><h3 className="text-xl font-bold text-foreground">{t('common.filters')}</h3></div><Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-muted-foreground hover:text-primary">{t('common.clearAll')}</Button></div>
        <div>
          <button type="button" onClick={() => setSpecExpanded((previous) => !previous)} className="group mb-2 flex w-full items-center justify-between">
            <Label className="cursor-pointer text-sm font-bold uppercase tracking-wider text-foreground group-hover:text-primary">{t('auth.specialization')}{pendingFilters.specializations.length > 0 && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingFilters.specializations.length}</span>}</Label>
            {specExpanded ? <ChevronUp size={16} className="text-muted-foreground group-hover:text-primary" /> : <ChevronDown size={16} className="text-muted-foreground group-hover:text-primary" />}
          </button>
          {specExpanded && <div className="mt-2 space-y-1">{SPECIALIZATIONS.map((value) => <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted/50"><input type="checkbox" checked={pendingFilters.specializations.includes(value)} onChange={() => toggleSpec(value)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" /><span className="text-sm text-foreground">{translateSpec(value)}</span></label>)}</div>}
        </div>
        <div>
          <button type="button" onClick={() => setLocExpanded((previous) => !previous)} className="group mb-2 flex w-full items-center justify-between">
            <Label className="cursor-pointer text-sm font-bold uppercase tracking-wider text-foreground group-hover:text-primary">{t('common.city')}{pendingFilters.locations.length > 0 && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingFilters.locations.length}</span>}</Label>
            {locExpanded ? <ChevronUp size={16} className="text-muted-foreground group-hover:text-primary" /> : <ChevronDown size={16} className="text-muted-foreground group-hover:text-primary" />}
          </button>
          {locExpanded && <div className="mt-2 space-y-1">{TUNISIA_LOCATIONS.map((value) => <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted/50"><input type="checkbox" checked={pendingFilters.locations.includes(value)} onChange={() => toggleLoc(value)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" /><span className="text-sm text-foreground">{value}</span></label>)}</div>}
        </div>
        <div><Label className="mb-3 block text-sm font-bold uppercase tracking-wider text-foreground">{t('expert.directory.minRating')}</Label><select value={pendingFilters.minRating} onChange={(event) => setPendingFilters((previous) => ({ ...previous, minRating: Number(event.target.value) }))} className="h-11 w-full rounded-xl border-2 border-border bg-muted/50 px-4 text-sm outline-none focus:border-primary focus:bg-card">{RATING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="flex gap-3 border-t-2 border-border pt-4"><Button onClick={handleClearFilters} variant="outline" className="h-11 flex-1 rounded-xl border-2">{t('common.reset')}</Button><Button onClick={handleApplyFilters} className="h-11 flex-1 rounded-xl bg-primary text-white hover:bg-primary/90">{t('common.apply')}</Button></div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-secondary/10 p-5 shadow-lg">
        <form className="space-y-4" onSubmit={handleAiSearch}>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div><div className="mb-1 flex items-center gap-2"><Sparkles size={18} className="text-primary" /><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{tr('AI Advanced Search', 'Recherche Avancée IA', 'البحث الذكي المتقدم')}</p></div><h2 className="text-xl font-bold text-foreground">{tr('Describe your project or the ideal artisan in natural language', 'Décrivez votre projet ou l’artisan idéal en langage naturel', 'صف مشروعك أو الحرفي المثالي بلغة طبيعية')}</h2></div>
            {isAiActive && <Button type="button" variant="outline" onClick={clearAiSearch} className="rounded-xl border-2"><X size={16} className="mr-2" />{tr('Clear AI search', 'Effacer la recherche IA', 'مسح البحث الذكي')}</Button>}
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1"><Wand2 className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} /><Input placeholder={tr('Describe project/artisan...', 'Decrivez un projet/artisan', 'مثال: أبني فيلا وأبحث عن أفضل كهربائي لديه 10 سنوات خبرة وأنجز مشاريع مشابهة من قبل...')} value={aiQuery} onChange={(event) => setAiQuery(event.target.value)} className="h-12 rounded-xl border-2 border-primary/30 bg-card pl-12 focus:border-primary" /></div>
            <Button type="submit" disabled={aiLoading} className="h-12 rounded-xl bg-primary px-6 text-white hover:bg-primary/90">{aiLoading ? <><LoaderCircle size={18} className="mr-2 animate-spin" />{tr('Analyzing...', 'Analyse...', 'جارٍ التحليل...')}</> : <><Sparkles size={18} className="mr-2" />{tr('Run AI search', 'Lancer la recherche IA', 'تشغيل البحث الذكي')}</>}</Button>
          </div>
          
          {aiLoading && <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-card/80 px-4 py-3 text-sm text-foreground"><LoaderCircle size={18} className="animate-spin text-primary" /><span>{tr("L'IA analyse les profils et les projets terminés...", "L'IA analyse les profils et les projets terminés...", 'الذكاء الاصطناعي يحلل الملفات والمشاريع المنجزة...')}</span></div>}
          {aiMeta && <div className="flex flex-wrap gap-2"><Badge className="border-0 bg-primary/10 px-3 py-1 text-primary">{getAiSortLabel(aiMeta.analysis?.sortBy)}</Badge>{(aiMeta.analysis?.matchedDomains || []).map((domain) => <Badge key={domain} className="border-0 bg-secondary/15 px-3 py-1 text-secondary-foreground">{translateSpec(domain)}</Badge>)}{(aiMeta.analysis?.matchedLocations || []).map((location) => <Badge key={location} className="border-0 bg-blue-100 px-3 py-1 text-blue-700"><MapPin size={11} className="mr-1" />{location}</Badge>)}{typeof aiMeta.analysis?.minYearsExperience === 'number' && <Badge className="border-0 bg-amber-100 px-3 py-1 text-amber-700">{tr(`${aiMeta.analysis.minYearsExperience}+ years`, `${aiMeta.analysis.minYearsExperience}+ ans`, `${aiMeta.analysis.minYearsExperience}+ سنوات`)}</Badge>}{aiMeta.analysis?.requiresCertification && <Badge className="border-0 bg-emerald-100 px-3 py-1 text-emerald-700">{tr('Certified profile requested', 'Profil certifié demandé', 'تم طلب ملف معتمد')}</Badge>}</div>}
          {aiError && <p className="text-sm text-red-500">{aiError}</p>}
        </form>
      </Card>

      {!showFilters && <Card className="rounded-2xl border border-border bg-card p-4 shadow-lg"><div className="mb-3 flex items-center gap-2"><Search size={16} className="text-muted-foreground" /><p className="text-sm font-semibold text-muted-foreground">{tr('Classic Search', 'Recherche classique', 'البحث التقليدي')}</p></div><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} /><Input placeholder={t('expert.directory.searchPlaceholder')} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-12 rounded-xl border-2 border-border pl-12 focus:border-primary" /></div><Button variant={showFilters ? 'default' : 'outline'} className={`relative h-12 rounded-xl border-2 px-6 ${showFilters ? 'bg-primary text-white hover:bg-primary/90' : ''}`} onClick={() => setShowFilters((previous) => !previous)}><SlidersHorizontal size={18} className="mr-2" />{showFilters ? tr('Hide Filters', 'Masquer les filtres', 'إخفاء الفلاتر') : tr('Show Filters', 'Afficher les filtres', 'عرض الفلاتر')}{!showFilters && activeFilterCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">{activeFilterCount}</span>}</Button></div></Card>}

      <div className={showFilters ? 'flex flex-col items-start gap-8 lg:flex-row' : 'w-full'}>
        {showFilters && filterPanel}
        <div className="min-w-0 flex-1 space-y-6">
          {showFilters && <Card className="rounded-2xl border border-border bg-card p-4 shadow-lg"><div className="mb-3 flex items-center gap-2"><Search size={16} className="text-muted-foreground" /><p className="text-sm font-semibold text-muted-foreground">{tr('Classic Search', 'Recherche classique', 'البحث التقليدي')}</p></div><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} /><Input placeholder={t('expert.directory.searchPlaceholder')} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-12 rounded-xl border-2 border-border pl-12 focus:border-primary" /></div><Button variant={showFilters ? 'default' : 'outline'} className={`relative h-12 rounded-xl border-2 px-6 ${showFilters ? 'bg-primary text-white hover:bg-primary/90' : ''}`} onClick={() => setShowFilters((previous) => !previous)}><SlidersHorizontal size={18} className="mr-2" />{showFilters ? tr('Hide Filters', 'Masquer les filtres', 'إخفاء الفلاتر') : tr('Show Filters', 'Afficher les filtres', 'عرض الفلاتر')}</Button></div></Card>}
          {activeFilterCount > 0 && <div className="flex flex-wrap gap-2">{filters.specializations.map((value) => <span key={value} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{value}<button onClick={() => removeSpec(value)}><X size={11} /></button></span>)}{filters.locations.map((value) => <span key={value} className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"><MapPin size={10} /> {value}<button onClick={() => removeLoc(value)}><X size={11} /></button></span>)}{filters.minRating > 0 && <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700"><Star size={10} /> {filters.minRating}★+<button onClick={clearRating}><X size={11} /></button></span>}</div>}
          {isAiActive && <Card className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-primary">{tr('AI results ready', 'Résultats IA prêts', 'نتائج الذكاء الاصطناعي جاهزة')}</p><p className="text-sm text-muted-foreground">{tr(`Request: "${aiMeta?.query || ''}"`, `Demande : "${aiMeta?.query || ''}"`, `الطلب: "${aiMeta?.query || ''}"`)}</p></div><p className="text-sm font-medium text-foreground">{tr(`${filteredArtisans.length} artisan(s) matched`, `${filteredArtisans.length} artisan(s) correspondent`, `${filteredArtisans.length} حرفي مطابق`)}</p></div></Card>}
          {!isAiActive && <p className="text-sm text-muted-foreground">{tr(`${filteredArtisans.length} artisan(s) found`, `${filteredArtisans.length} artisan(s) trouvé(s)`, `${filteredArtisans.length} حرفي تم العثور عليهم`)}</p>}
          {loading && <p className="text-sm text-muted-foreground">{tr('Loading artisans...', 'Chargement des artisans...', 'جارٍ تحميل الحرفيين...')}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {aiLoading && <Card className="rounded-2xl border border-primary/20 bg-card p-8 shadow-lg"><div className="flex flex-col items-center gap-4 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><LoaderCircle size={24} className="animate-spin text-primary" /></div><div><p className="text-lg font-semibold text-foreground">{tr("L'IA analyse les profils...", "L'IA analyse les profils...", 'الذكاء الاصطناعي يحلل الملفات...')}</p><p className="mt-1 text-sm text-muted-foreground">{tr('It compares expertise, completed projects, ratings, experience, and recent activity.', 'Elle compare les expertises, les projets terminés, les notes, l’expérience et l’activité récente.', 'يقارن بين التخصصات والمشاريع المكتملة والتقييمات والخبرة والنشاط الحديث.')}</p></div></div></Card>}
          <div className="grid gap-6 md:grid-cols-2">{filteredArtisans.map((artisan) => <Card key={artisan.id} className="rounded-2xl border border-border bg-card p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"><div className="mb-4 flex items-start gap-4"><Avatar className="h-16 w-16 ring-4 ring-border shadow-lg"><AvatarFallback className="bg-slate-200 text-xl font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-100">{artisan.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</AvatarFallback></Avatar><div className="flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold text-foreground">{artisan.name}</h3>{isAiActive && typeof artisan.aiMatchPercent === 'number' && <Badge className="border-0 bg-primary/10 px-2.5 py-1 text-primary"><Sparkles size={12} className="mr-1" />{tr(`AI Match ${artisan.aiMatchPercent}%`, `Match IA ${artisan.aiMatchPercent}%`, `مطابقة ذكية ${artisan.aiMatchPercent}%`)}</Badge>}</div><p className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><Briefcase size={13} /> {artisan.specialization}</p><div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground"><div className="flex items-center gap-1"><MapPin size={13} /> {artisan.location || tr('Location not specified', 'Lieu non précisé', 'الموقع غير محدد')}</div><div className="flex items-center gap-1"><Star size={13} className={artisan.rating > 0 ? 'fill-secondary text-secondary' : 'text-gray-300'} /><span className="font-semibold text-foreground">{artisan.rating > 0 ? artisan.rating.toFixed(1) : '—'}</span><span>({artisan.reviews})</span></div></div></div></div><p className="mb-4 text-sm leading-relaxed text-muted-foreground">{artisan.bio || tr('No biography provided yet.', 'Aucune biographie renseignée pour le moment.', 'لا توجد نبذة حالياً.')}</p><div className="mb-4 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-100 p-4 dark:!border-slate-600 dark:!bg-slate-800"><div><p className="mb-1 text-xs font-medium text-slate-500 dark:!text-slate-300">{tr('Experience', 'Expérience', 'الخبرة')}</p><p className="text-sm font-bold text-slate-900 dark:!text-slate-100">{artisan.experience}</p></div><div><p className="mb-1 text-xs font-medium text-slate-500 dark:!text-slate-300">{tr('Completed Projects', 'Projets terminés', 'المشاريع المكتملة')}</p><p className="text-sm font-bold text-slate-900 dark:!text-slate-100">{artisan.completedProjects} {tr('projects', 'projets', 'مشاريع')}</p></div></div>{isAiActive && artisan.aiReason && <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-semibold leading-relaxed text-slate-800"><span className="mr-1 text-primary">✨</span>{artisan.aiReason}</p>{artisan.matchHighlights && artisan.matchHighlights.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{artisan.matchHighlights.map((highlight) => <span key={`${artisan.id}-${highlight}`} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{highlight}</span>)}</div>}</div>}{artisan.skills.length > 0 && <div className="mb-4 flex flex-wrap gap-2">{artisan.skills.slice(0, 3).map((skill) => <Badge key={skill} className="border-0 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{skill}</Badge>)}{artisan.skills.length > 3 && <Badge className="border-0 bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">+{artisan.skills.length - 3}</Badge>}</div>}<div className="flex gap-3"><Button className="h-11 flex-1 rounded-xl !border-secondary !bg-secondary text-white hover:!bg-secondary/90" onClick={() => handleContact(artisan.id)}><MessageSquare size={16} className="mr-2" />{tr('Contact', 'Contacter', 'تواصل')}</Button><Button variant="outline" className="h-11 rounded-xl border-2 border-slate-300 bg-slate-100 px-6 text-slate-800 hover:bg-slate-200 dark:!border-slate-500 dark:!bg-slate-700 dark:!text-slate-100 dark:hover:!bg-slate-600" onClick={() => setPage({ type: 'profile', artisanId: artisan.id, artisanName: artisan.name, artisanDomain: artisan.specialization })}>{tr('View Profile', 'Voir le profil', 'عرض الملف')}</Button></div></Card>)}</div>
          {!loading && !aiLoading && filteredArtisans.length === 0 && !error && !aiError && <Card className="rounded-2xl border border-border bg-card p-12 text-center shadow-lg"><p className="text-xl font-semibold text-muted-foreground">{isAiActive ? tr('No artisan matches this AI request', 'Aucun artisan ne correspond à cette demande IA', 'لا يوجد حرفي يطابق هذا الطلب الذكي') : tr('No artisans found', 'Aucun artisan trouvé', 'لم يتم العثور على حرفيين')}</p><p className="mt-1 text-muted-foreground">{isAiActive ? tr('Try a broader project description, another city, or a lower experience threshold.', 'Essayez une description de projet plus large, une autre ville ou un seuil d’expérience plus souple.', 'جرّب وصف مشروع أوسع أو مدينة أخرى أو شرط خبرة أقل.') : tr('Try adjusting your search or filters.', 'Essayez de modifier votre recherche ou vos filtres.', 'حاول تعديل البحث أو الفلاتر.')}</p></Card>}
        </div>
      </div>
    </div>
  );
}
