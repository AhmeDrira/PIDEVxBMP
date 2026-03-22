import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Filter, BookOpen, Eye, ThumbsUp, Calendar } from 'lucide-react';
import { Badge } from '../ui/badge';
import KnowledgeDetailPage from '../knowledge/KnowledgeDetailPage';
import knowledgeService, { KnowledgeArticle } from '../../services/knowledgeService';
import { toast } from 'sonner';

export default function ExpertKnowledgeLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await knowledgeService.list();
        setArticles(data);
      } catch (error: any) {
        const message = error.response?.data?.message || 'Unable to load knowledge articles.';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredArticles = articles.filter((article) => {
    const normalizedQuery = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(normalizedQuery) ||
      article.category.toLowerCase().includes(normalizedQuery) ||
      (article.summary || '').toLowerCase().includes(normalizedQuery)
    );
  });

  const categories = useMemo(() => {
    const set = new Set(articles.map((a) => a.category));
    return Array.from(set);
  }, [articles]);

  // Show article detail if selected
  if (selectedArticleId) {
    return (
      <KnowledgeDetailPage
        articleId={selectedArticleId}
        userRole="expert"
        onBack={() => setSelectedArticleId(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Knowledge Library</h1>
          <p className="text-lg text-muted-foreground">Explore construction expertise and best practices</p>
        </div>
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
            />
          </div>
          <Button variant="outline" className="h-12 px-6 rounded-xl border-2">
            <Filter size={20} className="mr-2" />
            Filter
          </Button>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading && (
            <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
              <p className="text-muted-foreground">Loading articles...</p>
            </Card>
          )}
          {!loading && filteredArticles.length === 0 && (
            <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
              <p className="text-muted-foreground">No articles found.</p>
            </Card>
          )}
          {!loading && filteredArticles.map((article) => (
            <Card key={article._id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-start gap-6">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
                  style={{ backgroundColor: '#1E40AF15' }}
                >
                  <BookOpen size={36} className="text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground mb-3">{article.title}</h3>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className="bg-primary/10 text-primary px-3 py-1 text-xs font-semibold border-0">
                      {article.category}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ~{Math.max(3, Math.round((article.content?.split(' ').length || 200) / 200))} min read
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {article.summary}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
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
                      className="rounded-xl border-2"
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

        <div className="space-y-6">
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-4">Categories</h3>
            <div className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-primary/5 transition-colors font-medium text-muted-foreground hover:text-primary"
                >
                  {category}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Your Stats</h3>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Articles</p>
                <p className="text-4xl font-bold text-primary">{articles.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Views</p>
                <p className="text-4xl font-bold text-secondary">{articles.reduce((sum, article) => sum + (article.views || 0), 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Likes</p>
                <p className="text-4xl font-bold text-accent">{articles.reduce((sum, article) => sum + (article.likes || 0), 0)}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}