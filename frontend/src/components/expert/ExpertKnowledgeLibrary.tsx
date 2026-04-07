import { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Search, BookOpen, Eye, ThumbsUp, Calendar, SlidersHorizontal, Sparkles, Wand2, LoaderCircle, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import KnowledgeLibraryDetail from '../knowledge/KnowledgeLibraryDetail';
import knowledgeService, { KnowledgeArticle } from '../../services/knowledgeService';
import { toast } from 'sonner';
import FilterSidebar, { KnowledgeFilters } from '../common/FilterSidebar';
import { useLanguage } from '../../context/LanguageContext';

export default function ExpertKnowledgeLibrary() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [aiArticles, setAiArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiActive, setAiActive] = useState(false);
  const [filters, setFilters] = useState<KnowledgeFilters>({
    categories: [],
    dateRange: 'alltime',
    viewsSort: 'default',
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await knowledgeService.list();
        setArticles(data);
      } catch (error: any) {
        const message = error.response?.data?.message || t('expert.knowledge.unableToLoad');
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const clearAiSearch = () => {
    setAiActive(false);
    setAiArticles([]);
    setAiQuery('');
    setAiError(null);
    setAiWarning(null);
  };

  const handleAiSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = aiQuery.trim();

    if (!trimmed) {
      clearAiSearch();
      return;
    }

    try {
      setAiLoading(true);
      setAiError(null);
      const response = await knowledgeService.aiSearch(trimmed);
      setAiArticles(Array.isArray(response.articles) ? response.articles : []);
      setAiActive(true);
      setAiWarning(response.warning || null);
      if (response.warning) {
        toast.message(tr('AI used a local semantic fallback for this search.', 'L IA a utilise un fallback semantique local pour cette recherche.', 'استخدم الذكاء الاصطناعي بديلاً دلالياً محلياً لهذا البحث.'));
      }
    } catch (error: any) {
      const message = error.response?.data?.message || tr('AI search failed. Please try again.', 'La recherche IA a echoue. Veuillez reessayer.', 'فشل البحث الذكي. يرجى المحاولة مرة أخرى.');
      setAiError(message);
      setAiActive(true);
      setAiArticles([]);
      toast.error(message);
    } finally {
      setAiLoading(false);
    }
  };

  const categories = useMemo(() => {
    const defaults = [
      t('expert.knowledge.structuralEngineering'),
      t('expert.knowledge.materialsScience'),
      t('expert.knowledge.safetyCompliance'),
      t('expert.knowledge.technicalGuide'),
      t('expert.knowledge.bestPractices'),
      t('expert.knowledge.projectManagement'),
    ];
    const dynamic = Array.from(new Set(articles.map((a) => a.category)));
    return Array.from(new Set([...defaults, ...dynamic]));
  }, [articles]);

  const displayedArticles = useMemo(() => (aiActive ? aiArticles : articles), [aiActive, aiArticles, articles]);

  const filteredArticles = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    let result = [...displayedArticles].filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(normalizedQuery) ||
        article.category.toLowerCase().includes(normalizedQuery) ||
        (article.summary || '').toLowerCase().includes(normalizedQuery);

      const matchesCategory =
        filters.categories.length === 0 || filters.categories.includes(article.category);

      return matchesSearch && matchesCategory;
    });

    // Keep backend ordering for AI mode (already sorted by views then likes).
    if (!aiActive) {
      if (filters.viewsSort === 'most_viewed') {
        result.sort((a, b) => (b.views || 0) - (a.views || 0));
      } else if (filters.viewsSort === 'least_viewed') {
        result.sort((a, b) => (a.views || 0) - (b.views || 0));
      } else if (filters.dateRange === 'newest') {
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else if (filters.dateRange === 'oldest') {
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    }

    return result;
  }, [displayedArticles, filters, searchQuery, aiActive]);

  const handleApplyFilters = (nextFilters: KnowledgeFilters) => setFilters(nextFilters);
  const handleClearFilters = () =>
    setFilters({
      categories: [],
      dateRange: 'alltime',
      viewsSort: 'default',
    });

  if (selectedArticleId) {
    return <KnowledgeLibraryDetail articleId={selectedArticleId} onBack={() => setSelectedArticleId(null)} />;
  }

  const searchToolbar = (
    <Card className="p-4 bg-card rounded-2xl border border-border shadow-lg w-full max-w-full min-w-0">
      <div className="flex flex-col md:flex-row gap-3 w-full min-w-0">
        <div className="relative flex-1 min-w-0 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 w-full max-w-full rounded-xl border-2 border-border focus:border-primary"
          />
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          className={`h-12 px-6 rounded-xl border-2 shrink-0 ${showFilters ? 'text-white bg-primary hover:bg-primary/90' : ''}`}
          onClick={() => setShowFilters((prev) => !prev)}
        >
          <SlidersHorizontal size={18} className="mr-2" />
          {showFilters ? 'Hide Filter' : 'Show Filter'}
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden px-4 md:px-6 py-4 md:py-8 space-y-6">
      <div className="space-y-4 min-w-0 w-full max-w-full">
        <Card className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-secondary/10 p-5 shadow-lg">
          <form className="space-y-4" onSubmit={handleAiSearch}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                    {tr('AI Advanced Search', 'Recherche IA Avancee', 'البحث الذكي المتقدم')}
                  </p>
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {tr('Describe your project and problem to find matching knowledge articles', 'Decrivez votre projet et votre probleme pour trouver les articles adaptes', 'صف مشروعك ومشكلتك للعثور على المقالات المناسبة')}
                </h2>
              </div>
              {aiActive && (
                <Button type="button" variant="outline" onClick={clearAiSearch} className="rounded-xl border-2">
                  <X size={16} className="mr-2" />
                  {tr('Clear AI results', 'Effacer les resultats IA', 'مسح نتائج البحث الذكي')}
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Wand2 className="absolute left-4 top-4 text-primary" size={18} />
                <Textarea
                  rows={3}
                  placeholder={tr(
                    'Example: I have cracking in exterior walls after heavy rain and need waterproofing + structural diagnostics best practices.',
                    'Exemple : J ai des fissures sur les murs exterieurs apres de fortes pluies et je cherche des bonnes pratiques d etancheite et de diagnostic structurel.',
                    'مثال: لدي تشققات في الجدران الخارجية بعد الأمطار وأحتاج مقالات حول العزل المائي وتشخيص السلامة الإنشائية.'
                  )}
                  value={aiQuery}
                  onChange={(event) => setAiQuery(event.target.value)}
                  className="min-h-[96px] rounded-xl border-2 border-primary/30 bg-card pl-12 focus:border-primary"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={aiLoading} className="h-11 rounded-xl bg-primary px-6 text-white hover:bg-primary/90">
                  {aiLoading
                    ? <><LoaderCircle size={18} className="mr-2 animate-spin" />{tr('Analyzing...', 'Analyse...', 'جارٍ التحليل...')}</>
                    : <><Sparkles size={18} className="mr-2" />{tr('Run AI article search', 'Lancer la recherche IA', 'تشغيل البحث الذكي في المقالات')}</>}
                </Button>
              </div>
            </div>
            {aiWarning && <p className="text-sm text-amber-600">{aiWarning}</p>}
            {aiError && <p className="text-sm text-red-500">{aiError}</p>}
          </form>
        </Card>

        {!showFilters && searchToolbar}

        <div
          className={
            showFilters
              ? 'flex flex-col lg:flex-row gap-8 items-start w-full max-w-full min-w-0'
              : 'w-full max-w-full min-w-0'
          }
        >
          {showFilters && (
            <div className="w-full lg:w-80 flex-shrink-0 min-w-0 animate-in slide-in-from-left-3 fade-in duration-200">
              <FilterSidebar
                categories={categories}
                onApplyFilters={handleApplyFilters}
                onClearFilters={handleClearFilters}
              />
            </div>
          )}

          <div className="flex-1 min-w-0 w-full max-w-full space-y-4">
            {showFilters && searchToolbar}
            <p className="text-sm text-muted-foreground">
              {aiActive
                ? tr(
                    `${filteredArticles.length} AI match(es), sorted by views then likes`,
                    `${filteredArticles.length} resultat(s) IA, tries par vues puis likes`,
                    `${filteredArticles.length} نتيجة ذكية مرتبة حسب المشاهدات ثم الإعجابات`
                  )
                : tr(
                    `${filteredArticles.length} article(s) found`,
                    `${filteredArticles.length} article(s) trouve(s)`,
                    `${filteredArticles.length} مقال(ات) تم العثور عليها`
                  )}
            </p>

            {loading && (
              <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
                <p className="text-muted-foreground">Loading articles...</p>
              </Card>
            )}

            {aiLoading && (
              <Card className="p-6 bg-card rounded-2xl border border-primary/20 shadow-lg">
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <LoaderCircle size={18} className="animate-spin text-primary" />
                  <span>{tr('AI is analyzing your project context and matching relevant articles...', 'L IA analyse votre contexte projet et les articles pertinents...', 'الذكاء الاصطناعي يحلل سياق مشروعك ويطابق المقالات المناسبة...')}</span>
                </div>
              </Card>
            )}

            {!loading && !aiLoading && filteredArticles.length === 0 && (
              <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
                <p className="text-muted-foreground">
                  {aiActive
                    ? tr('No article matches this AI request.', 'Aucun article ne correspond a cette demande IA.', 'لا يوجد مقال يطابق هذا الطلب الذكي.')
                    : tr('No articles found.', 'Aucun article trouve.', 'لم يتم العثور على مقالات.')}
                </p>
              </Card>
            )}

            <div className="space-y-4">
              {!loading &&
                filteredArticles.map((article) => (
                  <Card
  key={article._id}
  className="p-6 bg-card rounded-2xl border border-border shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden max-w-full min-w-0"
>
  <div className="flex items-start gap-4 sm:gap-6 min-w-0">
    <div
      className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
      style={{ backgroundColor: '#1E40AF15' }}
    >
      <BookOpen size={36} className="text-primary" />
    </div>
    <div className="flex-1 min-w-0 overflow-hidden">
      <h3 className="text-xl font-bold text-foreground mb-3 break-words">{article.title}</h3>
      <div className="flex items-center gap-3 mb-4">
        <Badge className="bg-primary/10 text-primary px-3 py-1 text-xs font-semibold border-0">
          {article.category}
        </Badge>
        <span className="text-sm text-muted-foreground">
          ~{Math.max(3, Math.round((article.content?.split(' ').length || 200) / 200))} min read
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed break-words">{article.summary}</p>
      
      {/* Conteneur avec flex row et justify-between pour placer les stats à gauche et le bouton à droite */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Eye size={16} />
            <span className="font-semibold">{article.views || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <ThumbsUp size={16} />
            <span className="font-semibold">{article.likes || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} />
            <span>{new Date(article.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg border-2 px-3 py-1 text-xs h-8 w-20 flex-shrink-0"
          onClick={() => setSelectedArticleId(article._id)}
        >
          Read More
        </Button>
      </div>
    </div>
  </div>
</Card>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}