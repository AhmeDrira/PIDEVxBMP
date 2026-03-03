import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, Calendar, User, Eye, ThumbsUp, Download, FileText } from 'lucide-react';

interface KnowledgeDetailPageProps {
  articleId?: string;
  onBack?: () => void;
}

export default function KnowledgeDetailPage({ articleId, onBack }: KnowledgeDetailPageProps) {
  // Mock article data - in real app this would come from API/props
  const article = {
    id: articleId || '1',
    title: 'Modern Foundation Techniques for Residential Buildings',
    category: 'Structural Engineering',
    author: {
      name: 'Dr. Karim Mansour',
      title: 'Structural Engineering Expert',
      avatar: 'KM'
    },
    createdDate: '2026-02-05',
    views: 1234,
    likes: 89,
    readTime: '12 min',
    content: `
      <h2>Introduction</h2>
      <p>Modern foundation techniques have revolutionized the way we approach residential building construction. This comprehensive guide explores the latest methods and best practices in foundation design and implementation.</p>
      
      <h2>Types of Foundations</h2>
      <p>There are several types of foundations commonly used in residential construction:</p>
      <ul>
        <li><strong>Shallow Foundations:</strong> Strip foundations, pad foundations, and raft foundations</li>
        <li><strong>Deep Foundations:</strong> Pile foundations and caisson foundations</li>
        <li><strong>Specialized Foundations:</strong> For challenging soil conditions</li>
      </ul>
      
      <h2>Deep Foundations</h2>
      <p>Deep foundations are essential when surface soil cannot support the structural load. They transfer loads to deeper, more stable soil layers or bedrock. Common types include:</p>
      <ul>
        <li>Driven piles (concrete, steel, timber)</li>
        <li>Bored piles</li>
        <li>Helical piles</li>
      </ul>
      
      <h2>Raft Foundations</h2>
      <p>Raft foundations, also known as mat foundations, are a type of shallow foundation that covers the entire building footprint. They're particularly useful for:</p>
      <ul>
        <li>Poor soil conditions</li>
        <li>Heavy structural loads</li>
        <li>Areas with high water tables</li>
      </ul>
      
      <h2>Pile Systems</h2>
      <p>Pile foundations are deep foundations that transfer structural loads through weak soil to stronger layers below. Key considerations include:</p>
      <ul>
        <li>Load-bearing capacity</li>
        <li>Soil conditions and analysis</li>
        <li>Installation methods</li>
        <li>Cost-effectiveness</li>
      </ul>
      
      <h2>Best Practices</h2>
      <p>When implementing modern foundation techniques, consider the following best practices:</p>
      <ol>
        <li>Conduct thorough soil analysis</li>
        <li>Engage qualified structural engineers</li>
        <li>Comply with local building codes</li>
        <li>Consider long-term settlement</li>
        <li>Plan for proper drainage</li>
      </ol>
      
      <h2>Conclusion</h2>
      <p>Modern foundation techniques offer improved stability, durability, and cost-effectiveness for residential construction. By understanding the various methods and their applications, builders can make informed decisions that ensure the longevity and safety of structures.</p>
    `,
    attachments: [
      { name: 'Foundation-Technical-Specs.pdf', size: '2.4 MB', type: 'PDF' },
      { name: 'Soil-Analysis-Report.pdf', size: '1.8 MB', type: 'PDF' },
      { name: 'Foundation-Diagrams.jpg', size: '856 KB', type: 'Image' }
    ]
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
              <span className="text-white font-semibold text-lg">{article.author.avatar}</span>
            </div>
            <div>
              <p className="font-semibold text-foreground">{article.author.name}</p>
              <p className="text-sm text-muted-foreground">{article.author.title}</p>
            </div>
          </div>

          <div className="h-8 w-px bg-gray-200" />

          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={18} />
            <span className="text-sm">{new Date(article.createdDate).toLocaleDateString('en-GB')}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Eye size={18} />
            <span className="text-sm">{article.views.toLocaleString()} views</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <ThumbsUp size={18} />
            <span className="text-sm">{article.likes} likes</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-sm">{article.readTime} read</span>
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
          <div dangerouslySetInnerHTML={{ __html: article.content }} />
        </div>
      </Card>

      {/* Attachments */}
      {article.attachments.length > 0 && (
        <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-2xl font-bold text-foreground mb-6">Attachments</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {article.attachments.map((attachment, idx) => (
              <Card 
                key={idx}
                className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-primary hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <FileText size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground mb-1 truncate">{attachment.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{attachment.size}</span>
                      <Badge className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 border-0">
                        {attachment.type}
                      </Badge>
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
              Like ({article.likes})
            </Button>
            <Button 
              className="h-11 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl"
            >
              Share Article
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
