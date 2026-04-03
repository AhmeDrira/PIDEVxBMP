import { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, BookOpen, Eye, Trash2, Edit } from 'lucide-react';
import AddKnowledgePage from './AddKnowledgePage';
import KnowledgeDetailPage from '../knowledge/KnowledgeDetailPage';
import knowledgeService, { KnowledgeArticle } from '../../services/knowledgeService';
import { toast } from 'sonner';
import { useLanguage } from '../../context/LanguageContext';

interface AdminKnowledgeManagementProps {
  canManageKnowledge?: boolean;
}

export default function AdminKnowledgeManagement({ canManageKnowledge = false }: AdminKnowledgeManagementProps) {

  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);  const { t } = useLanguage();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  /** Full article for edit form — mutually exclusive with `selectedArticleId` (detail view). */
  const [articleToEdit, setArticleToEdit] = useState<KnowledgeArticle | null>(null);
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

  const handleSaveArticle = async (payload: {
    title: string;
    category: string;
    summary: string;
    content: string;
    authorName: string;
    tags?: string[];
    attachments?: File[];
    removeAttachmentUrls?: string[];
  }) => {
    if (!canManageKnowledge) {
      toast.error(t('admin.knowledge.noPermissionManage'));
      return;
    }
    setIsSaving(true);
    try {
      if (articleToEdit) {
        await knowledgeService.update(articleToEdit._id, payload);
        toast.success(t('admin.knowledge.articleUpdated'));
      } else {
        await knowledgeService.create(payload);
        toast.success(t('admin.knowledge.articlePublished'));
      }
      setShowAddForm(false);
      setArticleToEdit(null);
      await loadArticles();
    } catch (error: any) {
      const message = error.response?.data?.message || t('admin.knowledge.couldNotSave');
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditArticle = (article: KnowledgeArticle) => {
    if (!canManageKnowledge) {
      toast.error(t('admin.knowledge.noPermissionEdit'));
      return;
    }
    setSelectedArticleId(null);
    setArticleToEdit(article);
    setShowAddForm(true);
  };

  const handleDeleteArticle = async (id: string) => {
    if (!canManageKnowledge) {
      toast.error(t('admin.knowledge.noPermissionDelete'));
      return;
    }
    const confirmed = window.confirm(t('admin.knowledge.deleteConfirm'));
    if (!confirmed) return;
    try {
      await knowledgeService.remove(id);
      toast.success(t('admin.knowledge.articleDeleted'));
      await loadArticles();
    } catch (error: any) {
      const message = error.response?.data?.message || t('admin.knowledge.couldNotDelete');
      toast.error(message);
    }
  };

  if (showAddForm) {
    return (
      <AddKnowledgePage
        key={articleToEdit?._id ?? 'new-knowledge-article'}
        onBack={() => {
          setShowAddForm(false);
          setArticleToEdit(null);
        }}
        onSave={handleSaveArticle}
        isSaving={isSaving}
        isEditing={Boolean(articleToEdit)}
        articleToEdit={articleToEdit}
        initialData={
          articleToEdit
            ? {
                title: articleToEdit.title,
                category: articleToEdit.category,
                summary: articleToEdit.summary,
                content: articleToEdit.content,
                authorName: articleToEdit.authorName,
                tags: articleToEdit.tags || [],
                attachments: articleToEdit.attachments || [],
              }
            : undefined
        }
      />
    );
  }

  if (selectedArticleId) {
    return (
      <KnowledgeDetailPage
        articleId={selectedArticleId}
        userRole="admin"
        onBack={() => {
          setSelectedArticleId(null);
          setArticleToEdit(null);
        }}
        onDeleted={loadArticles}
        onUpdated={loadArticles}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p style={{ color: 'var(--muted-foreground)' }}>{t('admin.knowledge.manageArticles')}</p>
        </div>
        <Button
          className="text-white"
          style={{ backgroundColor: '#1F3A8A' }}
          onClick={() => {
            setSelectedArticleId(null);
            setArticleToEdit(null);
            setShowAddForm(true);
          }}
          disabled={!canManageKnowledge}
        >
          <Plus size={20} className="mr-2" />
          {t('admin.knowledge.addArticle')}
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6 bg-card">
          <BookOpen size={32} style={{ color: '#1F3A8A' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>{articles.length}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>{t('admin.knowledge.totalArticles')}</p>
        </Card>
        <Card className="p-6 bg-card">
          <Eye size={32} style={{ color: '#F59E0B' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>
            {stats.totalViews.toLocaleString()}
          </p>
          <p style={{ color: 'var(--muted-foreground)' }}>{t('admin.knowledge.totalViews')}</p>
        </Card>
        <Card className="p-6 bg-card">
          <BookOpen size={32} style={{ color: '#10B981' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: 'var(--foreground)' }}>{stats.categoryCount}</p>
          <p style={{ color: 'var(--muted-foreground)' }}>{t('admin.knowledge.categories')}</p>
        </Card>
      </div>

      <Card className="p-6 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                <th className="text-left py-3" style={{ color: 'var(--muted-foreground)' }}>{t('admin.knowledge.title')}</th>
                <th className="text-left py-3" style={{ color: 'var(--muted-foreground)' }}>{t('admin.knowledge.author')}</th>
                <th className="text-left py-3" style={{ color: 'var(--muted-foreground)' }}>{t('common.category')}</th>
                <th className="text-left py-3" style={{ color: 'var(--muted-foreground)' }}>{t('admin.knowledge.views')}</th>
                <th className="text-left py-3" style={{ color: 'var(--muted-foreground)' }}>{t('common.date')}</th>
                <th className="text-left py-3" style={{ color: 'var(--muted-foreground)' }}>{t('common.actions')}</th>
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
                  <td className="py-4" style={{ color: 'var(--foreground)' }}>{article.title}</td>
                  <td className="py-4" style={{ color: 'var(--muted-foreground)' }}>{article.authorName}</td>
                  <td className="py-4">
                    <span
                      className="px-2 py-1 rounded text-xs"
                      style={{ backgroundColor: '#F3F4F6', color: 'var(--muted-foreground)' }}
                    >
                      {article.category}
                    </span>
                  </td>
                  <td className="py-4" style={{ color: 'var(--muted-foreground)' }}>{article.views}</td>
                  <td className="py-4" style={{ color: 'var(--muted-foreground)' }}>{new Date(article.createdAt).toLocaleDateString()}</td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setArticleToEdit(null);
                          setShowAddForm(false);
                          setSelectedArticleId(article._id);
                        }}
                      >
                        <Eye size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditArticle(article)}
                        disabled={!canManageKnowledge}
                        title={canManageKnowledge ? 'Edit article' : 'Permission required'}
                      >
                        <Edit size={16} />
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
