import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Users, BookOpen, MessageSquare, TrendingUp, Eye, ThumbsUp, ArrowRight } from 'lucide-react';
import StatsCard from '../common/StatsCard';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface ExpertHomeProps {
  onNavigate: (view: string) => void;
}

export default function ExpertHome({ onNavigate }: ExpertHomeProps) {
  const stats = [
    { 
      label: 'Published Articles', 
      value: '24', 
      icon: <BookOpen size={28} />, 
      color: '#1E40AF',
      trend: '+3 this month',
      trendUp: true
    },
    { 
      label: 'Total Views', 
      value: '12.5K', 
      icon: <Eye size={28} />, 
      color: '#F59E0B',
      trend: '+1.2K this week',
      trendUp: true
    },
    { 
      label: 'Artisan Connections', 
      value: '87', 
      icon: <Users size={28} />, 
      color: '#10B981',
      trend: '+12 this month',
      trendUp: true
    },
    { 
      label: 'Active Conversations', 
      value: '15', 
      icon: <MessageSquare size={28} />, 
      color: '#8B5CF6',
      subtitle: '5 unread'
    },
  ];

  const recentArticles = [
    {
      id: 1,
      title: 'Modern Foundation Techniques for Residential Buildings',
      category: 'Structural Engineering',
      views: 1234,
      likes: 89,
      publishedDate: '2026-02-05',
      status: 'published'
    },
    {
      id: 2,
      title: 'Sustainable Materials in Construction',
      category: 'Materials Science',
      views: 987,
      likes: 76,
      publishedDate: '2026-02-01',
      status: 'published'
    },
    {
      id: 3,
      title: 'Safety Standards for High-Rise Construction',
      category: 'Safety & Compliance',
      views: 1567,
      likes: 123,
      publishedDate: '2026-01-28',
      status: 'published'
    },
  ];

  const recentConnections = [
    { name: 'Ahmed Ben Salah', role: 'General Construction', location: 'Tunis', lastContact: '2 hours ago' },
    { name: 'Fatma Hamdi', role: 'Interior Design', location: 'Sousse', lastContact: '1 day ago' },
    { name: 'Youssef Trabelsi', role: 'Electrical Systems', location: 'Sfax', lastContact: '3 days ago' },
  ];

  const quickActions = [
    { 
      label: 'Write Article', 
      icon: <BookOpen size={24} />, 
      action: () => onNavigate('library'), 
      color: '#1E40AF',
      description: 'Share your knowledge with the community'
    },
    { 
      label: 'Browse Artisans', 
      icon: <Users size={24} />, 
      action: () => onNavigate('directory'), 
      color: '#10B981',
      description: 'Connect with construction professionals'
    },
    { 
      label: 'Send Message', 
      icon: <MessageSquare size={24} />, 
      action: () => onNavigate('messages'), 
      color: '#F59E0B',
      description: 'Communicate with your network'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 text-white shadow-2xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-3">Welcome Back, Dr. Mansour! 👋</h1>
          <p className="text-xl text-white/90 leading-relaxed">
            You have 24 published articles and 87 artisan connections. Keep sharing your expertise!
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Quick Actions</h2>
            <p className="text-muted-foreground mt-1">Common tasks and shortcuts</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className="group p-6 rounded-2xl border-2 border-gray-200 hover:border-transparent hover:shadow-xl transition-all duration-300 text-left"
              style={{
                background: `linear-gradient(135deg, ${action.color}05 0%, ${action.color}10 100%)`
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform"
                style={{ backgroundColor: action.color }}
              >
                <span className="text-white">{action.icon}</span>
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-2">{action.label}</h3>
              <p className="text-sm text-muted-foreground mb-3">{action.description}</p>
              <div className="flex items-center text-sm font-medium" style={{ color: action.color }}>
                Get Started
                <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Recent Articles */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Your Recent Articles</h2>
            <p className="text-muted-foreground mt-1">Latest published content</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => onNavigate('library')}
            className="rounded-xl border-2 hover:border-primary hover:text-primary"
          >
            View All
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
        <div className="space-y-4">
          {recentArticles.map((article) => (
            <div
              key={article.id}
              className="p-6 rounded-2xl border-2 border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-foreground mb-3">{article.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <Badge className="bg-primary/10 text-primary px-3 py-1 text-xs font-semibold border-0">
                      {article.category}
                    </Badge>
                    <span>Published: <strong className="text-foreground">{article.publishedDate}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Eye size={16} />
                    <span className="font-semibold">{article.views}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ThumbsUp size={16} />
                    <span className="font-semibold">{article.likes}</span>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl border-2">
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Connections */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Recent Connections</h2>
            <p className="text-muted-foreground mt-1">Your artisan network</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => onNavigate('directory')}
            className="rounded-xl border-2 hover:border-primary hover:text-primary"
          >
            View All
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
        <div className="space-y-4">
          {recentConnections.map((connection, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100 hover:border-primary/20 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md"
                  style={{ backgroundColor: '#1E40AF' }}
                >
                  {connection.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-lg">{connection.name}</h4>
                  <p className="text-sm text-muted-foreground">{connection.role}</p>
                  <p className="text-sm text-muted-foreground">📍 {connection.location}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-3">{connection.lastContact}</p>
                <Button size="sm" variant="outline" className="rounded-xl border-2">
                  Message
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}