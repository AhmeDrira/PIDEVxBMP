import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { FolderKanban, ShoppingCart, FileText, Clock, Package, TrendingUp, Eye, Activity, ArrowRight, CheckCircle, Receipt, XCircle } from 'lucide-react';
import StatsCard from '../common/StatsCard';
import { Badge } from '../ui/badge';
import axios from 'axios';

interface ArtisanHomeProps {
  onNavigate: (view: string, projectId?: string) => void;
}

const getTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return "Just now";
};

export default function ArtisanHome({ onNavigate }: ArtisanHomeProps) {
  const userStorage = localStorage.getItem('user');
  const user = userStorage ? JSON.parse(userStorage) : null;
  const firstName = user?.firstName || 'Artisan';

  const[projects, setProjects] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const[loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);


  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) {
      token = JSON.parse(userStorage).token;
    }
    return token;
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const token = getToken();
        if (!token) return;

        const config = { headers: { Authorization: `Bearer ${token}` } };

        // On lance les 3 requêtes en parallèle pour aller plus vite !
        const[resProjects, resQuotes, resInvoices] = await Promise.all([
          axios.get(`${API_URL}/projects`, config),
          axios.get(`${API_URL}/quotes`, config),
          axios.get(`${API_URL}/invoices`, config)
        ]);

        setProjects(resProjects.data);
        setQuotes(resQuotes.data);
        setInvoices(resInvoices.data);

      } catch (err) {
        console.error('Erreur chargement dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [API_URL]);

  
  // ==========================================
  // CALCUL DES STATISTIQUES DYNAMIQUES
  // ==========================================
  const activeProjectsCount = projects.filter(p => p.status === 'active' || p.status === 'in-progress').length;
  const projectsThisMonth = projects.filter(p => new Date(p.createdAt).getMonth() === new Date().getMonth()).length;
  
  const pendingQuotesCount = quotes.filter(q => q.status === 'pending').length;
  const approvedQuotesCount = quotes.filter(q => q.status === 'approved').length;

  const paidInvoicesCount = invoices.filter(i => i.status === 'paid').length;
  
  // Factures bientôt expirées (dans les 7 prochains jours)
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueSoonInvoices = invoices.filter(i => i.status === 'pending' && new Date(i.dueDate) <= nextWeek && new Date(i.dueDate) >= today).length;

  const stats =[
    { 
      label: 'Total Projects', 
      value: projects.length.toString(), 
      icon: <FolderKanban size={28} />, 
      color: '#1E40AF',
      trend: `+${projectsThisMonth} this month`,
      trendUp: projectsThisMonth > 0,
      subtitle: `${activeProjectsCount} active projects`
    },
    { 
      label: 'Pending Quotes', 
      value: pendingQuotesCount.toString(), 
      icon: <FileText size={28} />, 
      color: '#F59E0B',
      trend: `${approvedQuotesCount} approved`,
      trendUp: approvedQuotesCount > 0,
      subtitle: 'Awaiting response'
    },
    { 
      label: 'Paid Invoices', 
      value: paidInvoicesCount.toString(), 
      icon: <Activity size={28} />, 
      color: '#8B5CF6',
      trend: `${dueSoonInvoices} due soon`,
      trendUp: dueSoonInvoices === 0,
      subtitle: 'From all projects'
    },
    { 
      label: 'Total Orders', 
      value: '0', // Statique comme tu l'as demandé
      icon: <Package size={28} />, 
      color: '#10B981',
      trend: '0 this week',
      trendUp: true,
      subtitle: 'From marketplace'
    }
  ];

  // ==========================================
  // GÉNÉRATEUR D'ACTIVITÉS RÉCENTES
  // ==========================================
  const generateActivities = () => {
    const activities: any[] =[];

    // 1. Activités des projets
    projects.forEach(p => {
      activities.push({
        type: 'project_created',
        date: new Date(p.createdAt),
        text: `Project "${p.title}" was created`,
        icon: <FolderKanban size={20} />,
        color: '#1E40AF'
      });
      if (p.progress > 0) {
        activities.push({
          type: 'project_progress',
          date: new Date(p.updatedAt),
          text: `Project "${p.title}" reached ${p.progress}% completion`,
          icon: <TrendingUp size={20} />,
          color: '#1E40AF'
        });
      }
    });

    // 2. Activités des Devis (Quotes)
    quotes.forEach(q => {
      activities.push({
        type: 'quote_created',
        date: new Date(q.createdAt),
        text: `Quote ${q.quoteNumber} generated for project ${q.project?.title || ''}`,
        icon: <FileText size={20} />,
        color: '#F59E0B'
      });
      if (q.status === 'approved') {
        activities.push({
          type: 'quote_approved',
          date: new Date(q.updatedAt),
          text: `Quote ${q.quoteNumber} was approved!`,
          icon: <CheckCircle size={20} />,
          color: '#10B981'
        });
      } else if (q.status === 'rejected') {
        activities.push({
          type: 'quote_rejected',
          date: new Date(q.updatedAt),
          text: `Quote ${q.quoteNumber} was rejected`,
          icon: <XCircle size={20} />,
          color: '#EF4444'
        });
      }
    });

    // 3. Activités des Factures (Invoices)
    invoices.forEach(i => {
      activities.push({
        type: 'invoice_created',
        date: new Date(i.createdAt),
        text: `Invoice ${i.invoiceNumber} generated for ${i.clientName}`,
        icon: <Receipt size={20} />,
        color: '#8B5CF6'
      });
      if (i.status === 'paid') {
        activities.push({
          type: 'invoice_paid',
          date: new Date(i.updatedAt),
          text: `Payment received for Invoice ${i.invoiceNumber} 💰`,
          icon: <CheckCircle size={20} />,
          color: '#10B981'
        });
      }
    });

    // On trie toutes ces activités par date (de la plus récente à la plus ancienne)
    activities.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // On ne garde que les 5 dernières pour ne pas surcharger l'affichage
    return activities.slice(0, 5);
  };

  const recentActivities = generateActivities();

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

    const formatBudget = (budget: number) => {
      return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(budget);
    };

    const formatDate = (dateString: string) => {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString('en-GB');
    };

    // Limiter aux 5 projets les plus récents pour l'affichage "Recent Projects"
    const recentProjects = projects.slice(0, 5);

      if (loading) return <div className="p-10 text-center text-muted-foreground">Loading your dashboard...</div>;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 text-white shadow-2xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-3 capitalize">Welcome Back, {firstName}! 👋</h1>
          <p className="text-xl text-white/90 leading-relaxed">
            You have {activeProjectsCount} active projects and {pendingQuotesCount} pending quotes. Here's your dashboard overview.
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
      
    <div className="space-y-8">
      {/* Header avec message de bienvenue */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Projects stats
          </h1>
          <p className="text-lg text-muted-foreground">
            Here's what's happening with your projects today.
          </p>
        </div>
        
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6">
        <StatsCard 
          label="Active Projects" 
          value={projects.filter(p => p.status === 'active').length.toString()} 
          icon={<Activity size={28} />} 
          color="#10B981" 
          subtitle="In progress"
        />
        <StatsCard 
          label="Pending" 
          value={projects.filter(p => p.status === 'pending').length.toString()} 
          icon={<Clock size={28} />} 
          color="#F59E0B" 
          subtitle="Awaiting approval"
        />
        <StatsCard 
          label="Completed" 
          value={projects.filter(p => p.status === 'completed').length.toString()} 
          icon={<Package size={28} />} 
          color="#3B82F6" 
          subtitle="Finished"
        />
        <StatsCard 
          label="Total Budget" 
          value={formatBudget(projects.reduce((sum, p) => sum + (p.budget || 0), 0))} 
          icon={<TrendingUp size={28} />} 
          color="#8B5CF6" 
          subtitle="All projects"
        />
      </div>

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

        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading projects...</div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">{error}</div>
        ) : recentProjects.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No projects yet. Create your first project!
          </div>
        ) : (
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <div
                key={project._id}
                className="p-6 rounded-2xl border-2 border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold text-foreground">{project.title}</h3>
                      <Badge className={`${getStatusColor(project.status)} px-3 py-1 text-xs font-semibold`}>
                        {getStatusLabel(project.status)}
                      </Badge>
                      {project.priority && (
                        <Badge className={`${getPriorityColor(project.priority)} px-3 py-1 text-xs font-semibold`}>
                          {project.priority}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mb-4 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        📍 {project.location.length > 25 ? project.location.substring(0, 25) + '…' : project.location}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span>Budget: <strong className="text-foreground">{formatBudget(project.budget)}</strong></span>
                      <span className="text-gray-300">•</span>
                      <span>Due: <strong className="text-foreground">{formatDate(project.endDate)}</strong></span>
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
                    onClick={() => onNavigate('details', project._id)}
                  >
                    View Details
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  

      {/* Activity Timeline (100% Dynamique) */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Recent Activity</h2>
        <div className="space-y-6">
          {recentActivities.length === 0 ? (
            <p className="text-muted-foreground">No recent activity detected. Create a project to get started!</p>
          ) : (
            recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
                  style={{ backgroundColor: `${activity.color}15` }}
                >
                  <div style={{ color: activity.color }}>{activity.icon}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium leading-relaxed">{activity.text}</p>
                  <p className="text-sm text-muted-foreground mt-1">{getTimeAgo(activity.date)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}