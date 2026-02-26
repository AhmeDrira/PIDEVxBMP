import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { FolderKanban, ShoppingCart, FileText, Clock, Package, TrendingUp, Eye, Activity, ArrowRight } from 'lucide-react';
import StatsCard from '../common/StatsCard';
import { Badge } from '../ui/badge';

interface ArtisanHomeProps {
  onNavigate: (view: string) => void;
}

export default function ArtisanHome({ onNavigate }: ArtisanHomeProps) {
  const stats = [
    { 
      label: 'Total Projects', 
      value: '12', 
      icon: <FolderKanban size={28} />, 
      color: '#1E40AF',
      trend: '+3 this month',
      trendUp: true,
      subtitle: '5 active projects'
    },
    { 
      label: 'Pending Quotes', 
      value: '8', 
      icon: <FileText size={28} />, 
      color: '#F59E0B',
      trend: '2 new',
      trendUp: true,
      subtitle: 'Awaiting response'
    },
    { 
      label: 'Recent Orders', 
      value: '23', 
      icon: <Package size={28} />, 
      color: '#10B981',
      trend: '+5 this week',
      trendUp: true,
      subtitle: 'From marketplace'
    },
    { 
      label: 'Active Tasks', 
      value: '15', 
      icon: <Activity size={28} />, 
      color: '#8B5CF6',
      trend: '3 due soon',
      trendUp: false,
      subtitle: 'Across all projects'
    },
  ];

  const recentProjects = [
    {
      id: 1,
      title: 'Villa Construction - Tunis',
      location: 'La Marsa, Tunis',
      budget: '150,000 TND',
      status: 'in-progress',
      progress: 65,
      deadline: '2026-06-15',
      priority: 'high'
    },
    {
      id: 2,
      title: 'Office Renovation',
      location: 'Centre Ville, Tunis',
      budget: '45,000 TND',
      status: 'in-progress',
      progress: 30,
      deadline: '2026-04-20',
      priority: 'medium'
    },
    {
      id: 3,
      title: 'Apartment Restoration',
      location: 'Sousse',
      budget: '80,000 TND',
      status: 'planning',
      progress: 10,
      deadline: '2026-08-10',
      priority: 'low'
    },
  ];

  const quickActions = [
    { 
      label: 'Create New Project', 
      icon: <FolderKanban size={24} />, 
      action: () => onNavigate('projects'), 
      color: '#1E40AF',
      description: 'Start a new construction project'
    },
    { 
      label: 'Browse Marketplace', 
      icon: <ShoppingCart size={24} />, 
      action: () => onNavigate('marketplace'), 
      color: '#F59E0B',
      description: 'Order materials and supplies'
    },
    { 
      label: 'Generate Quote', 
      icon: <FileText size={24} />, 
      action: () => onNavigate('quotes'), 
      color: '#10B981',
      description: 'Create estimate for client'
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-progress': return 'bg-accent/10 text-accent';
      case 'planning': return 'bg-secondary/10 text-secondary';
      case 'completed': return 'bg-primary/10 text-primary';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 text-white shadow-2xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-3">Welcome Back, Ahmed! 👋</h1>
          <p className="text-xl text-white/90 leading-relaxed">
            You have 5 active projects and 8 pending quotes. Here's your dashboard overview.
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

      {/* Recent Projects */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Recent Projects</h2>
            <p className="text-muted-foreground mt-1">Your active construction projects</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => onNavigate('projects')}
            className="rounded-xl border-2 hover:border-primary hover:text-primary"
          >
            View All Projects
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
        <div className="space-y-4">
          {recentProjects.map((project) => (
            <div
              key={project.id}
              className="p-6 rounded-2xl border-2 border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-semibold text-foreground">{project.title}</h3>
                    <Badge className={`${getStatusColor(project.status)} px-3 py-1 text-xs font-semibold`}>
                      {getStatusLabel(project.status)}
                    </Badge>
                    <Badge className={`${getPriorityColor(project.priority)} px-3 py-1 text-xs font-semibold`}>
                      {project.priority}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      📍 {project.location}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span>Budget: <strong className="text-foreground">{project.budget}</strong></span>
                    <span className="text-gray-300">•</span>
                    <span>Due: <strong className="text-foreground">{project.deadline}</strong></span>
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-muted-foreground">Progress</span>
                      <span className="text-xl font-bold text-primary">{project.progress}%</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden bg-gray-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500 shadow-lg"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="rounded-xl border-2 hover:bg-primary hover:text-white hover:border-primary whitespace-nowrap"
                >
                  View Details
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity Timeline */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Recent Activity</h2>
        <div className="space-y-6">
          {[
            { 
              icon: <FileText size={20} />, 
              color: '#10B981', 
              text: 'Quote #Q-2024-045 approved by client Mohamed Ali', 
              time: '2 hours ago',
              type: 'success'
            },
            { 
              icon: <Package size={20} />, 
              color: '#F59E0B', 
              text: 'Order #ORD-1234 shipped from BuildMaster Ltd', 
              time: '5 hours ago',
              type: 'info'
            },
            { 
              icon: <Clock size={20} />, 
              color: '#EF4444', 
              text: 'Payment reminder for Invoice #INV-789', 
              time: '1 day ago',
              type: 'warning'
            },
            { 
              icon: <TrendingUp size={20} />, 
              color: '#1E40AF', 
              text: 'Project "Villa Construction" reached 65% completion', 
              time: '2 days ago',
              type: 'success'
            },
          ].map((activity, index) => (
            <div key={index} className="flex items-start gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
                style={{ backgroundColor: `${activity.color}15` }}
              >
                <div style={{ color: activity.color }}>{activity.icon}</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium leading-relaxed">{activity.text}</p>
                <p className="text-sm text-muted-foreground mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}