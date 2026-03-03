import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, BookOpen, Eye, Trash2, Edit } from 'lucide-react';
import AddEditArticlePage from './AddEditArticlePage';
import DeleteArticleModal from './DeleteArticleModal';
import { toast } from "sonner";

export default function AdminKnowledgeManagement() {
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; article: any }>({
    isOpen: false,
    article: null
  });

  const [articles, setArticles] = useState([
    { 
      id: 1, 
      title: 'Modern Foundation Techniques', 
      author: 'Dr. Karim Mansour', 
      category: 'Structural Engineering', 
      status: 'published', 
      views: 1234, 
      date: '2026-02-05',
      content: 'Article content...',
      tags: ['foundation', 'construction'],
      readTime: 8
    },
    { 
      id: 2, 
      title: 'Sustainable Materials in Construction', 
      author: 'Dr. Karim Mansour', 
      category: 'Materials Science', 
      status: 'published', 
      views: 987, 
      date: '2026-02-01',
      content: 'Article content...',
      tags: ['sustainability', 'materials'],
      readTime: 6
    },
    { 
      id: 3, 
      title: 'Safety Standards for High-Rise Construction', 
      author: 'Dr. Karim Mansour', 
      category: 'Safety & Compliance', 
      status: 'draft', 
      views: 1567, 
      date: '2026-01-28',
      content: 'Article content...',
      tags: ['safety', 'compliance'],
      readTime: 10
    },
  ]);

  const handleAddArticle = () => {
    setSelectedArticle(null);
    setView('add');
  };

  const handleEditArticle = (article: any) => {
    setSelectedArticle(article);
    setView('edit');
  };

  const handleViewArticle = (article: any) => {
    // Navigate to article detail page
    console.log('View article:', article);
  };

  const handleDeleteArticle = (article: any) => {
    setDeleteModal({ isOpen: true, article });
  };

  const confirmDelete = () => {
    // Remove article from list
    setArticles(articles.filter(a => a.id !== deleteModal.article.id));
    toast.success('Article deleted successfully');
    setDeleteModal({ isOpen: false, article: null });
  };

  const handleSaveArticle = (data: any) => {
    if (view === 'edit') {
      // Update existing article
      setArticles(articles.map(a => 
        a.id === selectedArticle.id ? { ...a, ...data } : a
      ));
    } else {
      // Add new article
      const newArticle = {
        ...data,
        id: articles.length + 1,
        views: 0,
        date: new Date().toISOString().split('T')[0]
      };
      setArticles([...articles, newArticle]);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: { bg: '#F3F4F6', color: '#6B7280', label: 'Draft' },
      published: { bg: '#D1FAE5', color: '#059669', label: 'Published' },
      archived: { bg: '#FEE2E2', color: '#DC2626', label: 'Archived' },
    };
    const style = styles[status as keyof typeof styles] || styles.draft;
    
    return (
      <span
        className="px-3 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: style.bg, color: style.color }}
      >
        {style.label}
      </span>
    );
  };

  // Show Add/Edit page
  if (view === 'add' || view === 'edit') {
    return (
      <AddEditArticlePage
        mode={view === 'edit' ? 'edit' : 'add'}
        articleId={selectedArticle?.id}
        initialData={selectedArticle}
        onBack={() => setView('list')}
        onSave={handleSaveArticle}
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
          onClick={handleAddArticle}
          className="text-white" 
          style={{ backgroundColor: '#1F3A8A' }}
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
            {articles.reduce((sum, a) => sum + a.views, 0).toLocaleString()}
          </p>
          <p style={{ color: '#6B7280' }}>Total Views</p>
        </Card>
        <Card className="p-6 bg-white">
          <BookOpen size={32} style={{ color: '#10B981' }} className="mb-2" />
          <p className="text-3xl mb-1" style={{ color: '#111827' }}>6</p>
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
                <th className="text-left py-3" style={{ color: '#6B7280' }}>Status</th>
                <th className="text-left py-3" style={{ color: '#6B7280' }}>Views</th>
                <th className="text-left py-3" style={{ color: '#6B7280' }}>Date</th>
                <th className="text-left py-3" style={{ color: '#6B7280' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td className="py-4" style={{ color: '#111827' }}>{article.title}</td>
                  <td className="py-4" style={{ color: '#6B7280' }}>{article.author}</td>
                  <td className="py-4">
                    <span
                      className="px-2 py-1 rounded text-xs"
                      style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                    >
                      {article.category}
                    </span>
                  </td>
                  <td className="py-4">
                    {getStatusBadge(article.status)}
                  </td>
                  <td className="py-4" style={{ color: '#6B7280' }}>{article.views}</td>
                  <td className="py-4" style={{ color: '#6B7280' }}>{article.date}</td>
                  <td className="py-4">
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewArticle(article)}
                        title="View"
                      >
                        <Eye size={16} />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEditArticle(article)}
                        title="Edit"
                      >
                        <Edit size={16} />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteArticle(article)}
                        title="Delete"
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

      {/* Delete Modal */}
      <DeleteArticleModal
        isOpen={deleteModal.isOpen}
        articleTitle={deleteModal.article?.title || ''}
        onClose={() => setDeleteModal({ isOpen: false, article: null })}
        onConfirm={confirmDelete}
      />
    </div>
  );
}