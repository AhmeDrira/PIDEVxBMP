import React, { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, Calendar, Eye, ThumbsUp, Download, FileText } from 'lucide-react';
import knowledgeService, { KnowledgeArticle } from '../../services/knowledgeService';
import { toast } from 'sonner';

interface KnowledgeDetailPageProps {
  articleId?: string;
  onBack?: () => void;
  userRole?: string;
  article?: KnowledgeArticle;
}

export default function KnowledgeDetailPage({ articleId, onBack, userRole = 'expert', article: articleProp }: KnowledgeDetailPageProps) {
  const [article, setArticle] = useState<KnowledgeArticle | null>(articleProp || null);
  const [loading, setLoading] = useState(Boolean(articleId) && !articleProp);

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

  if (loading || !article) {
    return (
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <p className="text-muted-foreground">Loading article...</p>
      </Card>
    );
  }

  const attachmentList = article.attachments || [];
  const likes = article.likes ?? 0;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="mb-10">
        <Button 
          variant="outline" 
          onClick={onBack} 
          className="rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Knowledge Library
        </Button>
      </div>

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

      {/* Attachments */}
      {attachmentList.length > 0 && (
        <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-2xl font-bold text-foreground mb-6">Attachments</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attachmentList.map((fileName, idx) => (
              <Card 
                key={idx}
                className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-primary hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <FileText size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground mb-1 truncate">{fileName}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Attached file</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-4 rounded-lg border-2 hover:bg-primary hover:text-white hover:border-primary"
                >
                  <Download size={16} className="mr-2" />
                  Download
                </Button>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl border-2 border-primary/20">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-foreground mb-1">Found this article helpful?</p>
            <p className="text-sm text-muted-foreground">Share your feedback and help others discover it</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="h-11 px-6 rounded-xl border-2 hover:bg-white"
            >
              <ThumbsUp size={18} className="mr-2" />
              Like ({likes})
            </Button>
            <Button 
              className="h-11 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl"
            >
              {userRole === 'admin' ? 'Share with experts' : 'Share Article'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
