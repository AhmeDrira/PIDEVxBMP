import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ArrowRight, Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import type { KnowledgeAttachment } from '../../services/knowledgeService';
import type { KnowledgeArticle } from '../../services/knowledgeService';

import { useLanguage } from '../../context/LanguageContext';
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
  /** When true, form is in edit mode (title / button labels). */
  isEditing?: boolean;
  /** Full article from admin list — used to pre-fill and to detect edit mode reliably. */
  articleToEdit?: KnowledgeArticle | null;
  initialData?: Partial<Pick<KnowledgeArticle, 'title' | 'category' | 'summary' | 'content' | 'authorName' | 'tags'>> & {
    attachments?: KnowledgeAttachment[];
  };
}

function formValuesFromArticle(
  article: KnowledgeArticle | null | undefined,
  patch?: AddKnowledgePageProps['initialData'],
) {
  const title = patch?.title ?? article?.title ?? '';
  const category = patch?.category ?? article?.category ?? '';
  const authorName = patch?.authorName ?? article?.authorName ?? 'BMP Admin';
  const summary = patch?.summary ?? article?.summary ?? '';
  const content = patch?.content ?? article?.content ?? '';
  return { title, category, authorName, summary, content };
}

export default function AddKnowledgePage({
  onBack,
  onSave,
  isSaving = false,
  isEditing = false,
  articleToEdit = null,
  initialData,
}: AddKnowledgePageProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const isEditMode = Boolean(isEditing && articleToEdit?._id);
  const articleRef = useRef(articleToEdit);
  articleRef.current = articleToEdit;

  const [formData, setFormData] = useState(() =>
    formValuesFromArticle(articleToEdit, initialData),
  );
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [existingAttachments, setExistingAttachments] = useState<KnowledgeAttachment[]>([]);
  const [removedAttachmentUrls, setRemovedAttachmentUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const totalNewFilesSize = useMemo(() => {
    return newFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  }, [newFiles]);

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [2, 3, 4, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        [{ color: ['#1F3A8A', '#F59E0B', '#10B981', 'var(--muted-foreground)', '#DC2626'] }],
        [{ size: ['normal', 'large', 'huge'] }],
        ['clean'],
      ],
    }),
    [],
  );

  const quillFormats = useMemo(
    () => ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'link', 'color', 'size'],
    [],
  );

  const sanitizeHtml = (html: string) => {
    const allowedTags = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'DEL', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'A', 'SPAN']);
    const allowedColors = new Set(['rgb(31, 58, 138)', 'rgb(245, 158, 11)', 'rgb(16, 185, 129)', 'rgb(107, 114, 128)', 'rgb(220, 38, 38)']);
    const allowedSizes = new Set(['large', 'huge']);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html || '', 'text/html');

    const cleanNode = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (!allowedTags.has(el.tagName)) {
          const parent = el.parentNode;
          while (el.firstChild) parent?.insertBefore(el.firstChild, el);
          parent?.removeChild(el);
          return;
        }

        // Remove dangerous inline styles/classes, then whitelist color/size only
        const originalStyle = el.getAttribute('style') || '';
        const cls = el.getAttribute('class') || '';
        el.removeAttribute('style');
        el.removeAttribute('class');

        if (el.tagName === 'A') {
          const href = el.getAttribute('href') || '';
          if (!/^https?:\/\//i.test(href)) {
            el.removeAttribute('href');
          }
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }

        // Keep only allowed quill size classes
        const sizeMatch = cls.match(/ql-size-(large|huge)/);
        if (sizeMatch && allowedSizes.has(sizeMatch[1])) {
          el.classList.add(`ql-size-${sizeMatch[1]}`);
        }

        // Keep only allowed colors from quill inline color style (if present in original style attr)
        const colorMatch = originalStyle.match(/color\s*:\s*([^;]+)/i);
        const color = colorMatch?.[1]?.trim() || '';
        if (color && allowedColors.has(color)) {
          el.style.color = color;
        }
      }

      Array.from(node.childNodes).forEach(cleanNode);
    };

    Array.from(doc.body.childNodes).forEach(cleanNode);
    return doc.body.innerHTML;
  };

  useEffect(() => {
    const current = articleRef.current;
    if (isEditing && current) {
      setFormData(formValuesFromArticle(current));
      setTags(current.tags || []);
      setExistingAttachments(current.attachments || []);
      setRemovedAttachmentUrls([]);
      setNewFiles([]);
      setTagInput('');
      return;
    }
    if (!isEditing) {
      setFormData({
        title: '',
        category: '',
        authorName: 'BMP Admin',
        summary: '',
        content: '',
      });
      setTags([]);
      setExistingAttachments([]);
      setRemovedAttachmentUrls([]);
      setNewFiles([]);
      setTagInput('');
    }
  }, [isEditing, articleToEdit?._id]);

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
        content: sanitizeHtml(formData.content),
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

      <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{isEditMode ? 'Edit Knowledge Article' : 'Add Knowledge Article'}</h1>
          <p className="text-lg text-muted-foreground">
            {isEditMode ? 'Update this article with rich formatting' : 'Create a new article for the knowledge library'}
          </p>
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
              className="h-12 rounded-xl border-2 border-border focus:border-primary"
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
              className="w-full h-12 px-4 rounded-xl border-2 border-border focus:border-primary focus:outline-none"
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
              className="h-12 rounded-xl border-2 border-border focus:border-primary"
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
              className="rounded-xl border-2 border-border focus:border-primary"
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
                className="h-12 rounded-xl border-2 border-border focus:border-primary"
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

          {/* Full content */}
          <div className="space-y-2">
            <Label htmlFor="content" className="text-base font-semibold text-foreground">
              Full Content *
            </Label>
            <div className="rounded-xl border-2 border-border overflow-hidden bg-card">
              <ReactQuill
                key={articleToEdit?._id ?? 'new-quill'}
                theme="snow"
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Write and style your article content..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Allowed: H2/H3/H4, bold, italic, underline, strike, lists, links, predefined colors and sizes.
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label className="text-base font-semibold text-foreground">
              Attachments (Optional)
            </Label>
            <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary transition-colors bg-muted/50">
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
                  <div key={att.url || att.name} className="flex items-center justify-between p-3 rounded-xl bg-card border-2 border-border">
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
                    className="flex items-center justify-between p-3 rounded-xl bg-card border-2 border-border"
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
                isEditMode ? 'Updating...' : 'Publishing...'
              ) : (
                <>
                  <Upload size={20} className="mr-2" />
                  {isEditMode ? 'Update Article' : 'Publish Article'}
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
