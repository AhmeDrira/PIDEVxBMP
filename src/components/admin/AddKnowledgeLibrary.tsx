import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { Badge } from '../ui/badge';

interface AddKnowledgeLibraryProps {
  onBack: () => void;
  onSave: (data: any) => void;
}

export default function AddKnowledgeLibrary({ onBack, onSave }: AddKnowledgeLibraryProps) {
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    content: '',
    tags: [] as string[],
  });
  const [currentTag, setCurrentTag] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);

  const categories = [
    'Structural Engineering',
    'Materials Science',
    'Safety & Compliance',
    'Technical Guide',
    'Best Practices',
    'Project Management'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onBack();
  };

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, currentTag.trim()] });
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) });
  };

  return (
    <div className="space-y-8">
      <Button variant="ghost" onClick={onBack} className="hover:bg-white rounded-xl">
        <ArrowLeft size={20} className="mr-2" />
        Back to Library
      </Button>

      <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-foreground mb-8">Add Knowledge Library Article</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-semibold">Article Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter article title"
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-base font-semibold">Category *</Label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              required
            >
              <option value="">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content" className="text-base font-semibold">Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Write your article content here... You can use HTML formatting."
              rows={20}
              className="rounded-xl border-2 border-gray-200 focus:border-primary font-mono text-sm"
              required
            />
            <p className="text-xs text-muted-foreground">
              Tip: You can use HTML tags like &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;strong&gt; for formatting
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Tags</Label>
            <div className="flex gap-3">
              <Input
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tag..."
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              />
              <Button
                type="button"
                onClick={addTag}
                className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl"
              >
                Add Tag
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.tags.map((tag) => (
                  <Badge key={tag} className="bg-primary/10 text-primary px-3 py-1.5 border-0 text-sm">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X size={14} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Attachments (Optional)</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-primary transition-colors bg-gray-50">
              <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground mb-2">Upload supporting documents</p>
              <p className="text-xs text-muted-foreground mb-3">PDF, DOC, DOCX, XLS, XLSX, DWG (Max 10MB each)</p>
              <Input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).map(f => f.name);
                  setAttachments([...attachments, ...files]);
                }}
                className="max-w-xs mx-auto"
              />
            </div>
            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-gray-100">
                    <span className="text-sm text-foreground">{file}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
            >
              Publish Article
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 px-8 rounded-xl border-2"
            >
              Save Draft
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="h-12 px-8 rounded-xl border-2"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
