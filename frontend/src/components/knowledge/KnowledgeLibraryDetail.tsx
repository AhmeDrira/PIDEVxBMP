import { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowLeft, Calendar, Eye, ThumbsUp, Download, FileText, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import knowledgeService, { KnowledgeAttachment, KnowledgeArticle } from '../../services/knowledgeService';

interface KnowledgeLibraryDetailProps {
  articleId: string;
  onBack: () => void;
}

function formatSize(size: string | number | undefined) {
  if (size === undefined) return '';
  if (typeof size === 'number') return `${size} B`;
  return size;
}

export default function KnowledgeLibraryDetail({ articleId, onBack }: KnowledgeLibraryDetailProps) {
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      try {
        const data = await knowledgeService.getById(articleId);
        setArticle(data);
        setLikeCount(data.likes ?? 0);
        setHasLiked(Boolean(data.liked ?? data.likedByUser));
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Unable to load the article.');
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [articleId]);

  // Keep derived UI state in sync when the article updates
  useEffect(() => {
    if (!article) return;
    setLikeCount(article.likes ?? 0);
    setHasLiked(Boolean(article.liked ?? article.likedByUser));
  }, [article]);

  const attachmentList: KnowledgeAttachment[] = useMemo(() => article?.attachments ?? [], [article]);
  const tags = article?.tags ?? [];
  const initials = useMemo(() => {
    const name = article?.authorName || '';
    return name.substring(0, 2).toUpperCase();
  }, [article?.authorName]);

  const handleLike = async () => {
    if (!article) return;
    if (isLiking) return;
    setIsLiking(true);
    try {
      const response = await knowledgeService.toggleLike(article._id);
      setLikeCount(response.likes);
      setHasLiked(response.liked);
      // Update local cache for other parts of the UI
      setArticle((prev) =>
        prev
          ? {
              ...prev,
              likes: response.likes,
              liked: response.liked,
            }
          : prev,
      );
      toast.success(response.liked ? 'Like saved. Thanks for your feedback!' : 'Like removed.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to like this article.');
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async () => {
    if (!article) return;
    const url = window.location.href;
    const text = `Knowledge: ${article.title}`;

    try {
      // Web Share API (if available)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav: any = navigator;
      if (nav?.share) {
        await nav.share({ title: article.title, text, url });
        toast.success('Shared successfully!');
        return;
      }
    } catch {
      // fall back to clipboard below
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard.');
    } catch {
      toast.error('Unable to share. Please copy the URL manually.');
    }
  };

  if (loading || !article) {
    return (
      <div className="w-full min-h-screen">
        <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
          <p className="text-muted-foreground">Loading article...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen overflow-hidden">
      <Button variant="ghost" onClick={onBack} className="hover:bg-white rounded-xl">
        <ArrowLeft size={20} className="mr-2" />
        Back to Library
      </Button>

      <div className="w-full flex flex-col lg:flex-row gap-6">
        <main className="flex-1 min-w-0">
          <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg w-full">
            <Badge className="bg-primary/10 text-primary px-4 py-1.5 text-sm font-semibold border-0 mb-4">
              {article.category}
            </Badge>

            <h1 className="text-4xl font-bold text-foreground mb-6 leading-tight break-words">{article.title}</h1>

            <div className="flex flex-wrap items-center gap-6 pb-6 mb-8 border-b-2 border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold text-lg">{initials}</span>
                </div>
                <div>
                  <p className="font-bold text-foreground">{article.authorName}</p>
                  <p className="text-sm text-muted-foreground">Editorial Contributor</p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <span>{new Date(article.createdAt).toLocaleDateString('en-GB')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye size={16} />
                  <span>{article.views} views</span>
                </div>
                <div className="flex items-center gap-2">
                  <ThumbsUp size={16} />
                  <span>{likeCount} likes</span>
                </div>
              </div>
            </div>

            <div
              className="prose prose-lg max-w-full mb-8 break-words whitespace-normal overflow-x-auto [&_*]:max-w-full [&_img]:max-w-full [&_img]:h-auto [&_table]:block [&_table]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:whitespace-pre-wrap [&_code]:break-all"
              dangerouslySetInnerHTML={{ __html: (article.content || '').replace(/\n/g, '<br />') }}
              style={{
                lineHeight: '1.8',
                color: '#374151',
                overflowWrap: 'break-word',
                wordWrap: 'break-word',
                wordBreak: 'break-word',
              }}
            />

            {tags.length > 0 && (
              <div className="pt-8 border-t-2 border-gray-100">
                <h3 className="text-lg font-bold text-foreground mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <Badge
                      key={`${tag}-${index}`}
                      className="bg-gray-100 text-foreground px-4 py-2 text-sm border-0 hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </main>

        <aside className="w-full lg:w-96 flex-shrink-0">
          <div className="space-y-6">
            <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
              <h3 className="text-xl font-bold text-foreground mb-4">Actions</h3>
              <div className="space-y-3">
                <Button
                  onClick={handleLike}
                  disabled={isLiking}
                  className={
                    hasLiked
                      ? 'w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl shadow-md'
                      : 'w-full h-11 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md'
                  }
                >
                  <ThumbsUp size={18} className="mr-2" />
                  {hasLiked ? `Liked (${likeCount})` : `Like (${likeCount})`}
                </Button>
                <Button onClick={handleShare} variant="outline" className="w-full h-11 rounded-xl border-2">
                  <Share2 size={18} className="mr-2" />
                  Share
                </Button>
              </div>
            </Card>

            {attachmentList.length > 0 && (
              <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
                <h3 className="text-xl font-bold text-foreground mb-4">Attachments</h3>
                <div className="space-y-3">
                  {attachmentList.map((attachment, index) => (
                    <div
                      key={`${attachment.url || attachment.name}-${index}`}
                      className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100 hover:border-primary/20 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <FileText size={24} className="text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                            {attachment.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.type} {attachment.type && attachment.size ? '•' : ''} {formatSize(attachment.size)}
                          </p>
                        </div>
                      </div>

                      {attachment.url ? (
                        <a href={attachment.url} download className="block">
                          <Button size="sm" variant="outline" className="w-full h-9 rounded-lg border-2">
                            <Download size={14} className="mr-2" />
                            Download
                          </Button>
                        </a>
                      ) : (
                        <Button size="sm" variant="outline" className="w-full h-9 rounded-lg border-2" disabled>
                          <Download size={14} className="mr-2" />
                          Download unavailable
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
