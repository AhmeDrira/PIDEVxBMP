import { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, BookOpen, Eye, ThumbsUp, Calendar, SlidersHorizontal } from 'lucide-react';
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
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(false);
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

  const filteredArticles = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    let result = [...articles].filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(normalizedQuery) ||
        article.category.toLowerCase().includes(normalizedQuery) ||
        (article.summary || '').toLowerCase().includes(normalizedQuery);

      const matchesCategory =
        filters.categories.length === 0 || filters.categories.includes(article.category);

      return matchesSearch && matchesCategory;
    });

    if (filters.viewsSort === 'most_viewed') {
      result.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (filters.viewsSort === 'least_viewed') {
      result.sort((a, b) => (a.views || 0) - (b.views || 0));
    } else if (filters.dateRange === 'newest') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (filters.dateRange === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    return result;
  }, [articles, filters, searchQuery]);

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
            <p className="text-sm text-muted-foreground">{filteredArticles.length} article(s) trouvé(s)</p>

            {loading && (
              <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
                <p className="text-muted-foreground">Loading articles...</p>
              </Card>
            )}

            {!loading && filteredArticles.length === 0 && (
              <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg">
                <p className="text-muted-foreground">No articles found.</p>
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