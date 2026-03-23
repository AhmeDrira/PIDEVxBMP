import { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, Calendar, Eye, ThumbsUp, Download, FileText, Edit, Trash2 } from 'lucide-react';
import knowledgeService, { KnowledgeArticle } from '../../services/knowledgeService';
import { toast } from 'sonner';
import AddKnowledgePage from '../admin/AddKnowledgePage';

interface KnowledgeDetailPageProps {
  articleId?: string;
  onBack?: () => void;
  article?: KnowledgeArticle;
  userRole?: string;
  onDeleted?: () => void | Promise<void>;
  onUpdated?: () => void | Promise<void>;
}

export default function KnowledgeDetailPage({
  articleId,
  onBack,
  userRole = 'expert',
  article: articleProp,
  onDeleted,
  onUpdated,
}: KnowledgeDetailPageProps) {
  const [article, setArticle] = useState<KnowledgeArticle | null>(articleProp || null);
  const [loading, setLoading] = useState(Boolean(articleId) && !articleProp);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!articleId) return;
    const fetchArticle = async () => {
      setLoading(true);
      try {
        const data = await knowledgeService.getById(articleId);
        setArticle(data);
      } catch (error: any) {
        const message = error.response?.data?.message || 'Unable to load the article.';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [articleId]);

  useEffect(() => {
    // If article is passed as a prop, treat it as loaded.
    if (articleProp) setLoading(false);
  }, [articleProp]);

  if (loading || !article) {
    return (
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <p className="text-muted-foreground">Loading article...</p>
      </Card>
    );
  }

  const attachmentList = article.attachments || [];
  const likes = article.likes ?? 0;
  const tags = article.tags || [];

  const handleDelete = async () => {
    if (!article) return;
    const confirmed = window.confirm('Delete this article? This action cannot be undone.');
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await knowledgeService.remove(article._id);
      toast.success('Article deleted');
      await onDeleted?.();
      setIsEditing(false);
      onBack?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not delete article.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing && userRole === 'admin') {
    return (
      <AddKnowledgePage
        initialData={{
          title: article.title,
          category: article.category,
          summary: article.summary,
          content: article.content,
          authorName: article.authorName,
          attachments: article.attachments || [],
          tags: article.tags || [],
        }}
        isSaving={isSaving}
        onBack={() => setIsEditing(false)}
        onSave={async (payload) => {
          if (!article) return;
          setIsSaving(true);
          try {
            const updated = await knowledgeService.update(article._id, payload);
            setArticle(updated);
            toast.success('Article updated successfully');
            await onUpdated?.();
            setIsEditing(false);
          } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Could not update article.');
          } finally {
            setIsSaving(false);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Actions */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <Button 
          variant="outline" 
          onClick={onBack} 
          className="rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Management
        </Button>
        {userRole === 'admin' && (
          <div className="flex gap-3">
            <Button
              onClick={() => setIsEditing(true)}
              className="h-11 px-6 rounded-xl text-white bg-primary hover:bg-primary/90 shadow-md"
              disabled={isSaving}
            >
              <Edit size={18} className="mr-2" />
              Edit Article
            </Button>
            <Button
              onClick={handleDelete}
              className="h-11 px-6 rounded-xl text-white bg-destructive hover:bg-destructive/90 shadow-md"
              disabled={isSaving}
            >
              <Trash2 size={18} className="mr-2" />
              Delete Article
            </Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/* Article Header */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <Badge className="mb-4 bg-primary/10 text-primary border-0 px-3 py-1 text-sm">
              {article.category}
            </Badge>
            
            <h1 className="text-4xl font-bold text-foreground mb-6 leading-tight">
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">{(article.authorName || 'Admin').substring(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{article.authorName}</p>
                  <p className="text-sm text-muted-foreground">Editorial Contributor</p>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200" />

              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar size={18} />
                <span className="text-sm">{new Date(article.createdAt).toLocaleDateString('en-GB')}</span>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye size={18} />
                <span className="text-sm">{(article.views || 0).toLocaleString()} views</span>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <ThumbsUp size={18} />
                <span className="text-sm">{likes} likes</span>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm">~{Math.max(3, Math.round((article.content?.split(' ').length || 200) / 200))} min read</span>
              </div>
            </div>
          </Card>

          {/* Article Content */}
          <Card className="p-8 lg:p-12 bg-white rounded-2xl border-0 shadow-lg">
            <div 
              className="prose prose-lg max-w-none"
              style={{
                color: '#374151',
                lineHeight: '1.75'
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: (article.content || '').replace(/\n/g, '<br />') }} />
            </div>
          </Card>

          {/* Tags */}
          {tags.length > 0 && (
            <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
              <h2 className="text-2xl font-bold text-foreground mb-6">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, idx) => (
                  <Badge
                    key={`${tag}-${idx}`}
                    className="bg-gray-100 text-foreground px-4 py-2 text-sm border-0 hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar: Attachments only */}
        <div className="space-y-6">
          {attachmentList.length > 0 && (
            <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
              <h2 className="text-2xl font-bold text-foreground mb-6">Attachments</h2>
              <div className="space-y-4">
                {attachmentList.map((attachment, idx) => (
                  <Card 
                    key={idx}
                    className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-primary hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <FileText size={24} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground mb-1 truncate">{attachment.name}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground truncate">
                            {attachment.type || 'File'} {attachment.size ? `• ${attachment.size}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {attachment.url ? (
                      <a href={attachment.url} download className="block w-full mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full rounded-lg border-2 hover:bg-primary hover:text-white hover:border-primary"
                        >
                          <Download size={16} className="mr-2" />
                          Download
                        </Button>
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full mt-4 rounded-lg border-2" disabled>
                        <Download size={16} className="mr-2" />
                        Download unavailable
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
