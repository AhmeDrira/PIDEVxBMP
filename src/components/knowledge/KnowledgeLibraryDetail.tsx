import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowLeft, Calendar, User, Eye, ThumbsUp, Download, FileText, Share2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface KnowledgeLibraryDetailProps {
  articleId: number;
  onBack: () => void;
  userRole?: string;
}

export default function KnowledgeLibraryDetail({ articleId, onBack, userRole }: KnowledgeLibraryDetailProps) {
  const article = {
    id: articleId,
    title: 'Modern Foundation Techniques for Residential Buildings',
    category: 'Structural Engineering',
    author: {
      name: 'Dr. Karim Mansour',
      role: 'Structural Engineer',
      avatar: 'KM'
    },
    publishedDate: '2026-02-05',
    views: 1234,
    likes: 89,
    readTime: '12 min',
    content: `
      <h2>Introduction</h2>
      <p>Modern residential construction requires a solid foundation that can withstand various environmental and structural loads. This comprehensive guide explores the latest foundation techniques and best practices for residential buildings.</p>
      
      <h2>Types of Foundations</h2>
      <h3>1. Deep Foundations</h3>
      <p>Deep foundations are used when the soil near the surface is not suitable to support the weight of the building. These include:</p>
      <ul>
        <li><strong>Pile Foundations:</strong> Vertical columns driven deep into the ground to transfer the building load to stronger soil or bedrock.</li>
        <li><strong>Drilled Shafts:</strong> Large diameter concrete cylinders created by drilling holes and filling them with reinforced concrete.</li>
      </ul>
      
      <h3>2. Shallow Foundations</h3>
      <p>Shallow foundations are typically used when the soil has good bearing capacity. Common types include:</p>
      <ul>
        <li><strong>Spread Footings:</strong> The most common type, distributing the load over a larger area.</li>
        <li><strong>Mat Foundations:</strong> A large concrete slab supporting multiple columns or the entire building.</li>
      </ul>
      
      <h2>Modern Construction Techniques</h2>
      <p>Recent advances in foundation construction include:</p>
      <ul>
        <li>Use of high-strength concrete mixes (Grade 40-50)</li>
        <li>Advanced waterproofing membranes</li>
        <li>Geotechnical investigation using modern equipment</li>
        <li>Computer-aided design and analysis</li>
        <li>Sustainable and eco-friendly materials</li>
      </ul>
      
      <h2>Best Practices</h2>
      <p>When designing and constructing residential foundations, consider:</p>
      <ol>
        <li>Conduct thorough soil testing before design</li>
        <li>Ensure proper drainage systems</li>
        <li>Use appropriate reinforcement based on structural calculations</li>
        <li>Apply quality waterproofing to prevent moisture issues</li>
        <li>Follow local building codes and regulations</li>
        <li>Regular inspection during construction</li>
      </ol>
      
      <h2>Conclusion</h2>
      <p>Proper foundation design and construction are critical to the longevity and safety of residential buildings. By following modern techniques and best practices, construction professionals can ensure durable and reliable foundations.</p>
    `,
    attachments: [
      { name: 'Foundation_Design_Guide.pdf', size: '2.4 MB', type: 'PDF' },
      { name: 'Structural_Calculations.xlsx', size: '854 KB', type: 'Excel' },
      { name: 'Technical_Drawings.dwg', size: '1.2 MB', type: 'AutoCAD' }
    ],
    tags: ['Foundation', 'Residential', 'Construction', 'Structural Engineering', 'Best Practices']
  };

  return (
    <div className="space-y-8">
      <Button variant="ghost" onClick={onBack} className="hover:bg-white rounded-xl">
        <ArrowLeft size={20} className="mr-2" />
        Back to Library
      </Button>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
            {/* Article Header */}
            <Badge className="bg-primary/10 text-primary px-4 py-1.5 text-sm font-semibold border-0 mb-4">
              {article.category}
            </Badge>
            
            <h1 className="text-4xl font-bold text-foreground mb-6 leading-tight">{article.title}</h1>

            <div className="flex flex-wrap items-center gap-6 pb-6 mb-8 border-b-2 border-gray-100">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 ring-2 ring-white shadow-md">
                  <AvatarFallback className="bg-primary text-white font-semibold">
                    {article.author.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-foreground">{article.author.name}</p>
                  <p className="text-sm text-muted-foreground">{article.author.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <span>{article.publishedDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye size={16} />
                  <span>{article.views} views</span>
                </div>
                <div className="flex items-center gap-2">
                  <ThumbsUp size={16} />
                  <span>{article.likes} likes</span>
                </div>
                <Badge className="bg-secondary/10 text-secondary border-0 px-3 py-1">
                  {article.readTime} read
                </Badge>
              </div>
            </div>

            {/* Article Content */}
            <div 
              className="prose prose-lg max-w-none mb-8"
              dangerouslySetInnerHTML={{ __html: article.content }}
              style={{
                lineHeight: '1.8',
                color: '#374151'
              }}
            />

            {/* Tags */}
            <div className="pt-8 border-t-2 border-gray-100">
              <h3 className="text-lg font-bold text-foreground mb-4">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag, index) => (
                  <Badge
                    key={index}
                    className="bg-gray-100 text-foreground px-4 py-2 text-sm border-0 hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-4">Actions</h3>
            <div className="space-y-3">
              <Button className="w-full h-11 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md">
                <ThumbsUp size={18} className="mr-2" />
                Like ({article.likes})
              </Button>
              <Button variant="outline" className="w-full h-11 rounded-xl border-2">
                <Share2 size={18} className="mr-2" />
                Share
              </Button>
              {userRole === 'admin' && (
                <>
                  <Button variant="outline" className="w-full h-11 rounded-xl border-2">
                    Edit Article
                  </Button>
                  <Button variant="outline" className="w-full h-11 rounded-xl border-2 text-destructive hover:bg-destructive/5">
                    Delete Article
                  </Button>
                </>
              )}
            </div>
          </Card>

          {/* Attachments */}
          {article.attachments.length > 0 && (
            <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
              <h3 className="text-xl font-bold text-foreground mb-4">Attachments</h3>
              <div className="space-y-3">
                {article.attachments.map((attachment, index) => (
                  <div key={index} className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100 hover:border-primary/20 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText size={24} className="text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.type} • {attachment.size}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full h-9 rounded-lg border-2">
                      <Download size={14} className="mr-2" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Statistics */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Article Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye size={18} className="text-secondary" />
                  <span className="text-sm text-muted-foreground">Views</span>
                </div>
                <span className="text-xl font-bold text-foreground">{article.views}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ThumbsUp size={18} className="text-accent" />
                  <span className="text-sm text-muted-foreground">Likes</span>
                </div>
                <span className="text-xl font-bold text-foreground">{article.likes}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-primary" />
                  <span className="text-sm text-muted-foreground">Published</span>
                </div>
                <span className="text-sm font-bold text-foreground">{article.publishedDate}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
