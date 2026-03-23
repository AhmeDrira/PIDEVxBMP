import { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, BookOpen, Eye, Trash2 } from 'lucide-react';
import AddKnowledgePage from './AddKnowledgePage';
import KnowledgeDetailPage from '../knowledge/KnowledgeDetailPage';
import knowledgeService, { KnowledgeArticle } from '../../services/knowledgeService';
import { toast } from 'sonner';

interface AdminKnowledgeManagementProps {
  canManageKnowledge?: boolean;
}

export default function AdminKnowledgeManagement({ canManageKnowledge = false }: AdminKnowledgeManagementProps) {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadArticles = async () => {
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

  useEffect(() => {
    loadArticles();
  }, []);

  const stats = useMemo(() => {
    const totalViews = articles.reduce((sum, article) => sum + (article.views || 0), 0);
    const categories = new Set(articles.map((article) => article.category));
    return { totalViews, categoryCount: categories.size || 0 };
  }, [articles]);

  const handleCreateArticle = async (payload: {
    title: string;
    category: string;
    summary: string;
    content: string;
    authorName: string;
    tags?: string[];
    attachments?: File[];
  }) => {
    if (!canManageKnowledge) {
      toast.error('You do not have permission to add articles.');
      return;
    }
    setIsSaving(true);
    try {
      await knowledgeService.create(payload);
      toast.success('Article published successfully');
      setShowAddForm(false);
      await loadArticles();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Could not create article.';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!canManageKnowledge) {
      toast.error('You do not have permission to delete articles.');
      return;
    }
    const confirmed = window.confirm('Delete this article? This action cannot be undone.');
    if (!confirmed) return;
    try {
      await knowledgeService.remove(id);
      toast.success('Article deleted');
      await loadArticles();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Could not delete article.';
      toast.error(message);
    }
  };

  if (showAddForm) {
    return (
      <AddKnowledgePage
        onBack={() => setShowAddForm(false)}
        onSave={handleCreateArticle}
        isSaving={isSaving}
      />
    );
  }

  if (selectedArticleId) {
    return (
      <KnowledgeDetailPage
        articleId={selectedArticleId}
        userRole="admin"
        onBack={() => setSelectedArticleId(null)}
        onDeleted={loadArticles}
        onUpdated={loadArticles}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-1" style={{ color: '#111827' }}>Knowledge Library Management</h1>
          <p style={{ color: '#6B7280' }}>Manage platform articles and content</p>
        </div>
        <Button
          className="text-white"
          style={{ backgroundColor: '#1F3A8A' }}
          onClick={() => setShowAddForm(true)}
          disabled={!canManageKnowledge}
        >
          <Plus size={20} className="mr-2" />
          Add Article
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6 bg-white">
          <BookOpen size={32} style={{ color: '#1F3A8A' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: '#111827' }}>{articles.length}</p>
          <p style={{ color: '#6B7280' }}>Total Articles</p>
        </Card>
        <Card className="p-6 bg-white">
          <Eye size={32} style={{ color: '#F59E0B' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: '#111827' }}>
            {stats.totalViews.toLocaleString()}
          </p>
          <p style={{ color: '#6B7280' }}>Total Views</p>
        </Card>
        <Card className="p-6 bg-white">
          <BookOpen size={32} style={{ color: '#10B981' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: '#111827' }}>{stats.categoryCount}</p>
          <p style={{ color: '#6B7280' }}>Categories</p>
        </Card>
      </div>

      <Card className="p-6 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                <th className="text-left py-3" style={{ color: '#6B7280' }}>Title</th>
                <th className="text-left py-3" style={{ color: '#6B7280' }}>Author</th>
                <th className="text-left py-3" style={{ color: '#6B7280' }}>Category</th>
                <th className="text-left py-3" style={{ color: '#6B7280' }}>Views</th>
                <th className="text-left py-3" style={{ color: '#6B7280' }}>Date</th>
                <th className="text-left py-3" style={{ color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">Loading articles...</td>
                </tr>
              )}
              {!loading && articles.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">No articles published yet.</td>
                </tr>
              )}
              {!loading && articles.map((article) => (
                <tr key={article._id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td className="py-4" style={{ color: '#111827' }}>{article.title}</td>
                  <td className="py-4" style={{ color: '#6B7280' }}>{article.authorName}</td>
                  <td className="py-4">
                    <span
                      className="px-2 py-1 rounded text-xs"
                      style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                    >
                      {article.category}
                    </span>
                  </td>
                  <td className="py-4" style={{ color: '#6B7280' }}>{article.views}</td>
                  <td className="py-4" style={{ color: '#6B7280' }}>{new Date(article.createdAt).toLocaleDateString()}</td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedArticleId(article._id)}>
                        <Eye size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteArticle(article._id)}
                        disabled={!canManageKnowledge}
                        title={canManageKnowledge ? 'Delete article' : 'Permission required'}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
