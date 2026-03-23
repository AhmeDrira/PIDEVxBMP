import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ArrowRight, Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import type { KnowledgeAttachment } from '../../services/knowledgeService';
import type { KnowledgeArticle } from '../../services/knowledgeService';

interface AddKnowledgePageProps {
  onBack?: () => void;
  onSave?: (data: {
    title: string;
    category: string;
    summary: string;
    content: string;
    authorName: string;
    tags?: string[];
    attachments?: File[];
    removeAttachmentUrls?: string[];
  }) => Promise<void> | void;
  isSaving?: boolean;
  initialData?: Partial<Pick<KnowledgeArticle, 'title' | 'category' | 'summary' | 'content' | 'authorName' | 'tags'>> & {
    attachments?: KnowledgeAttachment[];
  };
}

export default function AddKnowledgePage({
  onBack,
  onSave,
  isSaving = false,
  initialData,
}: AddKnowledgePageProps) {
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    authorName: 'BMP Admin',
    summary: '',
    content: '',
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [existingAttachments, setExistingAttachments] = useState<KnowledgeAttachment[]>([]);
  const [removedAttachmentUrls, setRemovedAttachmentUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const totalNewFilesSize = useMemo(() => {
    return newFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  }, [newFiles]);

  useEffect(() => {
    if (!initialData) return;
    setFormData({
      title: initialData.title || '',
      category: initialData.category || '',
      authorName: initialData.authorName || 'BMP Admin',
      summary: initialData.summary || '',
      content: initialData.content || '',
    });
    setTags(initialData.tags || []);
    setExistingAttachments(initialData.attachments || []);
    setRemovedAttachmentUrls([]);
    setNewFiles([]);
    setTagInput('');
  }, [initialData]);

  const categories = [
    'Structural Engineering',
    'Materials Science',
    'Safety & Compliance',
    'Technical Guide',
    'Best Practices',
    'Project Management'
  ];

  const addTag = () => {
    const cleaned = tagInput.trim();
    if (!cleaned) return;
    if (tags.includes(cleaned)) {
      setTagInput('');
      return;
    }
    setTags([...tags, cleaned]);
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const removeExistingAttachment = (url: string) => {
    setExistingAttachments(existingAttachments.filter((a) => a.url !== url));
    if (!removedAttachmentUrls.includes(url)) {
      setRemovedAttachmentUrls([...removedAttachmentUrls, url]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      const payload = {
        title: formData.title,
        category: formData.category,
        summary: formData.summary,
        content: formData.content,
        authorName: formData.authorName,
        tags,
        attachments: newFiles.length ? newFiles : undefined,
        removeAttachmentUrls: removedAttachmentUrls.length ? removedAttachmentUrls : undefined,
      };
      try {
        await onSave(payload);
      } catch (err: any) {
        toast.error(err?.message || 'Could not save the article.');
        return;
      }
    }
    if (onBack) onBack();
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {onBack && (
        <Button 
          variant="outline" 
          onClick={onBack} 
          className="rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Knowledge Library
        </Button>
      )}

      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Add Knowledge Article</h1>
          <p className="text-lg text-muted-foreground">Create a new article for the knowledge library</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-semibold text-foreground">
              Title *
            </Label>
            <Input
              id="title"
              type="text"
              placeholder="e.g., Modern Foundation Techniques"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-base font-semibold text-foreground">
              Category *
            </Label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none"
              required
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Author */}
          <div className="space-y-2">
            <Label htmlFor="authorName" className="text-base font-semibold text-foreground">
              Author *
            </Label>
            <Input
              id="authorName"
              type="text"
              placeholder="e.g., Dr. Karim Mansour"
              value={formData.authorName}
              onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label htmlFor="summary" className="text-base font-semibold text-foreground">
              Summary *
            </Label>
            <Textarea
              id="summary"
              placeholder="Short overview that appears in the list..."
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              rows={4}
              className="rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-base font-semibold text-foreground">Tags</Label>
            <div className="flex gap-3">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add tag (press Enter)"
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" onClick={addTag} className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl">
                Add
              </Button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-primary/10 text-primary px-3 py-1.5 border-0 text-sm hover:bg-primary/10"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 hover:text-destructive inline-flex items-center"
                    >
                      <X size={14} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="content" className="text-base font-semibold text-foreground">
              Full Content *
            </Label>
            <Textarea
              id="content"
              placeholder="Provide detailed information about this article..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={8}
              className="rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label className="text-base font-semibold text-foreground">
              Attachments (Optional)
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-primary transition-colors bg-gray-50">
              <FileText size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-base font-medium text-foreground mb-2">
                {newFiles.length
                  ? `${newFiles.length} file(s) selected`
                  : 'Upload supporting documents or files'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                PDF, DOC, DOCX, or images (Max 10MB)
              </p>
              <Input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.dwg"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) setNewFiles([...newFiles, ...files]);
                  // allow selecting same file again
                  e.currentTarget.value = '';
                }}
                className="max-w-xs mx-auto"
              />
            </div>

            {existingAttachments.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Existing files</p>
                {existingAttachments.map((att) => (
                  <div key={att.url || att.name} className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-gray-100">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{att.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{att.type} {att.size ? `• ${att.size}` : ''}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => att.url && removeExistingAttachment(att.url)}
                      className="ml-3 rounded-lg border-2 hover:bg-destructive/5 text-destructive"
                      disabled={!att.url}
                      title={att.url ? 'Remove file' : 'Cannot remove (missing URL)'}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {newFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground font-medium">
                  New files ({newFiles.length}) - total {Math.round(totalNewFilesSize / 1024)} KB
                </p>
                {newFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-gray-100"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {file.type || 'File'} • {Math.round(file.size / 1024)} KB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewFiles(newFiles.filter((_, i) => i !== index))}
                      className="ml-3 rounded-lg border-2 hover:bg-destructive/5 text-destructive"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
              disabled={isSaving}
            >
              {isSaving ? (
                'Publishing...'
              ) : (
                <>
                  <Upload size={20} className="mr-2" />
                  Publish Article
                </>
              )}
            </Button>
            {onBack && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onBack}
                className="h-12 px-8 rounded-xl border-2"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
