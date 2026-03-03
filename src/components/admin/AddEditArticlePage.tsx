import React, { useState } from 'react';
import { ArrowLeft, Save, Upload, X, FileText, Image as ImageIcon, File, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card } from '../ui/card';
import { toast } from "sonner";

interface AddEditArticlePageProps {
  mode?: 'add' | 'edit';
  articleId?: string | number;
  initialData?: any;
  onBack: () => void;
  onSave?: (data: any) => void;
}

export default function AddEditArticlePage({
  mode = 'add',
  articleId,
  initialData,
  onBack,
  onSave
}: AddEditArticlePageProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    category: initialData?.category || '',
    content: initialData?.content || '',
    tags: initialData?.tags || [],
    readTime: initialData?.readTime || '',
    status: initialData?.status || 'draft',
  });

  const [tagInput, setTagInput] = useState('');
  const [attachments, setAttachments] = useState(initialData?.attachments || []);
  const [isLoading, setIsLoading] = useState(false);

  const categories = [
    'Structural Engineering',
    'Materials Science',
    'Safety & Compliance',
    'Construction Management',
    'Architecture',
    'Sustainability',
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag: string) => tag !== tagToRemove)
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments = Array.from(files).map(file => ({
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024).toFixed(2)} KB`,
        url: URL.createObjectURL(file)
      }));
      setAttachments([...attachments, ...newAttachments]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_: any, i: number) => i !== index));
  };

  const handleSubmit = async (status: 'draft' | 'published') => {
    if (!formData.title || !formData.category || !formData.content) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const articleData = {
        ...formData,
        status,
        attachments,
        author: {
          id: '1',
          name: 'Admin User',
          role: 'Administrator'
        }
      };

      if (onSave) {
        onSave(articleData);
      }

      const message = mode === 'edit' 
        ? 'Article updated successfully' 
        : 'Article created successfully';
      
      toast.success(message);
      setIsLoading(false);
      
      // Return to library after success
      setTimeout(() => onBack(), 1000);
    }, 1500);
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      {/* Back Button */}
      <Button
        onClick={onBack}
        variant="ghost"
        className="text-sm hover:bg-gray-100"
        style={{ color: '#6B7280' }}
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Library
      </Button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#111827' }}>
          {mode === 'edit' ? 'Edit Article' : 'Add New Article'}
        </h1>
        <p className="text-lg" style={{ color: '#6B7280' }}>
          {mode === 'edit' 
            ? 'Update and republish your knowledge article'
            : 'Create and publish a new knowledge article'}
        </p>
      </div>

      {/* Form Card */}
      <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
        <div className="space-y-8">
          {/* Title */}
          <div>
            <Label className="text-base font-semibold mb-2 block" style={{ color: '#111827' }}>
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Enter article title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="h-12 text-base rounded-xl"
            />
          </div>

          {/* Category */}
          <div>
            <Label className="text-base font-semibold mb-2 block" style={{ color: '#111827' }}>
              Category <span className="text-red-500">*</span>
            </Label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ color: '#111827' }}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Author (Auto-filled) */}
          <div>
            <Label className="text-base font-semibold mb-2 block" style={{ color: '#111827' }}>
              Author
            </Label>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
                style={{ backgroundColor: '#1F3A8A' }}
              >
                A
              </div>
              <div>
                <p className="font-semibold" style={{ color: '#111827' }}>Admin User</p>
                <p className="text-sm" style={{ color: '#6B7280' }}>Administrator</p>
              </div>
            </div>
          </div>

          {/* Article Content - Rich Text Editor */}
          <div>
            <Label className="text-base font-semibold mb-2 block" style={{ color: '#111827' }}>
              Article Content <span className="text-red-500">*</span>
            </Label>
            
            {/* Toolbar */}
            <div className="border border-gray-300 rounded-t-xl p-3 bg-gray-50 flex flex-wrap gap-2">
              <button type="button" className="px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm font-medium" style={{ color: '#6B7280' }}>H2</button>
              <button type="button" className="px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm font-medium" style={{ color: '#6B7280' }}>H3</button>
              <span className="border-l border-gray-300 mx-1"></span>
              <button type="button" className="px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm font-bold" style={{ color: '#6B7280' }}>B</button>
              <button type="button" className="px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm italic" style={{ color: '#6B7280' }}>I</button>
              <span className="border-l border-gray-300 mx-1"></span>
              <button type="button" className="px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm" style={{ color: '#6B7280' }}>• List</button>
              <button type="button" className="px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm" style={{ color: '#6B7280' }}>1. List</button>
              <span className="border-l border-gray-300 mx-1"></span>
              <button type="button" className="px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm" style={{ color: '#6B7280' }}>🔗 Link</button>
              <button type="button" className="px-3 py-1.5 rounded-lg hover:bg-gray-200 text-sm" style={{ color: '#6B7280' }}>🖼️ Image</button>
            </div>
            
            {/* Content Area */}
            <Textarea
              placeholder="Write your article content here... You can use the toolbar above to format text."
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              className="rounded-t-none rounded-b-xl text-base min-h-[400px] border-t-0"
            />
          </div>

          {/* Tags */}
          <div>
            <Label className="text-base font-semibold mb-2 block" style={{ color: '#111827' }}>
              Tags
            </Label>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add a tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="h-11 rounded-xl"
              />
              <Button
                type="button"
                onClick={handleAddTag}
                className="h-11 px-6 rounded-xl text-white"
                style={{ backgroundColor: '#1F3A8A' }}
              >
                <Plus size={20} className="mr-1" />
                Add Tag
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
                    style={{ backgroundColor: '#F3F4F6', color: '#111827' }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-600"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Read Time */}
          <div>
            <Label className="text-base font-semibold mb-2 block" style={{ color: '#111827' }}>
              Read Time (minutes)
            </Label>
            <Input
              type="number"
              placeholder="5"
              value={formData.readTime}
              onChange={(e) => handleInputChange('readTime', e.target.value)}
              className="h-12 text-base rounded-xl w-32"
            />
          </div>

          {/* Attachments Upload */}
          <div>
            <Label className="text-base font-semibold mb-2 block" style={{ color: '#111827' }}>
              Attachments
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                accept=".pdf,.xlsx,.xls,.dwg,.png,.jpg,.jpeg"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload size={48} className="mx-auto mb-4" style={{ color: '#6B7280' }} />
                <p className="font-semibold mb-1" style={{ color: '#111827' }}>
                  Click to upload or drag and drop
                </p>
                <p className="text-sm" style={{ color: '#6B7280' }}>
                  PDF, Excel, AutoCAD, Images (Max 10MB each)
                </p>
              </label>
            </div>

            {/* Attachment List */}
            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((file: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100">
                        {file.type.includes('pdf') ? <FileText size={20} style={{ color: '#F59E0B' }} /> :
                         file.type.includes('image') ? <ImageIcon size={20} style={{ color: '#10B981' }} /> :
                         <File size={20} style={{ color: '#6B7280' }} />}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: '#111827' }}>{file.name}</p>
                        <p className="text-sm" style={{ color: '#6B7280' }}>{file.size}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttachment(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X size={20} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <Label className="text-base font-semibold mb-3 block" style={{ color: '#111827' }}>
              Status
            </Label>
            <div className="flex flex-col gap-3">
              {[
                { value: 'draft', label: 'Draft', description: 'Save as draft to edit later' },
                { value: 'published', label: 'Published', description: 'Make article visible to all users' },
                { value: 'archived', label: 'Archived', description: 'Hide article from public view' },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{
                    borderColor: formData.status === option.value ? '#1F3A8A' : '#E5E7EB',
                    backgroundColor: formData.status === option.value ? '#F0F4FF' : 'white'
                  }}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={formData.status === option.value}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-semibold" style={{ color: '#111827' }}>{option.label}</p>
                    <p className="text-sm" style={{ color: '#6B7280' }}>{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pb-8">
        <Button
          onClick={onBack}
          variant="outline"
          className="h-11 px-8 rounded-xl border-2"
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={() => handleSubmit('draft')}
          variant="outline"
          className="h-11 px-8 rounded-xl border-2"
          disabled={isLoading}
        >
          <Save size={20} className="mr-2" />
          Save as Draft
        </Button>
        <Button
          onClick={() => handleSubmit('published')}
          className="h-11 px-8 rounded-xl text-white"
          style={{ backgroundColor: '#1F3A8A' }}
          disabled={isLoading}
        >
          {isLoading ? 'Publishing...' : mode === 'edit' ? 'Update Article' : 'Publish Article'}
        </Button>
      </div>
    </div>
  );
}