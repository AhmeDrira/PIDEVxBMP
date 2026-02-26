import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Search, Filter, BookOpen, Eye, ThumbsUp, Calendar, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/badge';

export default function ExpertKnowledgeLibrary() {
  const [searchQuery, setSearchQuery] = useState('');

  const articles = [
    {
      id: 1,
      title: 'Modern Foundation Techniques for Residential Buildings',
      category: 'Structural Engineering',
      excerpt: 'Comprehensive guide to modern foundation methods including deep foundations, raft foundations, and pile systems...',
      views: 1234,
      likes: 89,
      publishedDate: '2026-02-05',
      readTime: '12 min'
    },
    {
      id: 2,
      title: 'Sustainable Materials in Construction',
      category: 'Materials Science',
      excerpt: 'Exploring eco-friendly construction materials and their applications in modern building practices...',
      views: 987,
      likes: 76,
      publishedDate: '2026-02-01',
      readTime: '8 min'
    },
    {
      id: 3,
      title: 'Safety Standards for High-Rise Construction',
      category: 'Safety & Compliance',
      excerpt: 'Essential safety protocols and regulations for high-rise building construction projects...',
      views: 1567,
      likes: 123,
      publishedDate: '2026-01-28',
      readTime: '15 min'
    },
    {
      id: 4,
      title: 'Advanced Waterproofing Techniques',
      category: 'Technical Guide',
      excerpt: 'Modern waterproofing solutions for basements, roofs, and foundations in various climates...',
      views: 876,
      likes: 64,
      publishedDate: '2026-01-20',
      readTime: '10 min'
    },
  ];

  const categories = [
    'Structural Engineering',
    'Materials Science',
    'Safety & Compliance',
    'Technical Guide',
    'Best Practices',
    'Project Management'
  ];

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Knowledge Library</h1>
          <p className="text-lg text-muted-foreground">Explore construction expertise and best practices</p>
        </div>
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
            />
          </div>
          <Button variant="outline" className="h-12 px-6 rounded-xl border-2">
            <Filter size={20} className="mr-2" />
            Filter
          </Button>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filteredArticles.map((article) => (
            <Card key={article.id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-start gap-6">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
                  style={{ backgroundColor: '#1E40AF15' }}
                >
                  <BookOpen size={36} className="text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground mb-3">{article.title}</h3>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className="bg-primary/10 text-primary px-3 py-1 text-xs font-semibold border-0">
                      {article.category}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {article.readTime} read
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Eye size={16} />
                        <span className="font-semibold">{article.views}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ThumbsUp size={16} />
                        <span className="font-semibold">{article.likes}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        <span>{article.publishedDate}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-xl border-2">
                      Read More
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-4">Categories</h3>
            <div className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-primary/5 transition-colors font-medium text-muted-foreground hover:text-primary"
                >
                  {category}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Your Stats</h3>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Articles</p>
                <p className="text-4xl font-bold text-primary">24</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Views</p>
                <p className="text-4xl font-bold text-secondary">12.5K</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Likes</p>
                <p className="text-4xl font-bold text-accent">892</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}