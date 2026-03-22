import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ArrowRight, Upload, FileText } from 'lucide-react';

interface AddKnowledgePageProps {
  onBack?: () => void;
  onSave?: (data: { title: string; category: string; summary: string; content: string; authorName: string }) => Promise<void> | void;
  isSaving?: boolean;
}

export default function AddKnowledgePage({ onBack, onSave, isSaving = false }: AddKnowledgePageProps) {
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    authorName: 'BMP Admin',
    summary: '',
    content: '',
  });
  const [uploadedFile, setUploadedFile] = useState<string>('');

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
    if (onSave) {
      onSave({
        title: formData.title,
        category: formData.category,
        summary: formData.summary,
        content: formData.content,
        authorName: formData.authorName,
      });
    }
    // Reset form
    setFormData({ title: '', category: '', authorName: 'BMP Admin', summary: '', content: '' });
    setUploadedFile('');
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
                {uploadedFile || 'Upload supporting documents or files'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                PDF, DOC, DOCX, or images (Max 10MB)
              </p>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setUploadedFile(e.target.files?.[0]?.name || '')}
                className="max-w-xs mx-auto"
              />
            </div>
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
