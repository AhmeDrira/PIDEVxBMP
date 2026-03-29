import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Users, BookOpen, MessageSquare, Eye, ThumbsUp, ArrowRight, Loader2, Wallet } from 'lucide-react';
import StatsCard from '../common/StatsCard';
import { Badge } from '../ui/badge';
import axios from 'axios';

interface ExpertHomeProps {
  onNavigate: (view: string) => void;
}

export default function ExpertHome({ onNavigate }: ExpertHomeProps) {
  const userStorage = localStorage.getItem('user');
  const user = userStorage ? JSON.parse(userStorage) : null;
  const firstName = user?.firstName || 'Expert';
  const lastName = user?.lastName || '';

  const [conversations, setConversations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getToken = () => {
    const direct = localStorage.getItem('token');
    if (direct) return direct;
    const stored = localStorage.getItem('user');
    if (stored) return JSON.parse(stored).token;
    return null;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = getToken();
        if (!token) return;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const [resConv, resProj, resPay] = await Promise.all([
          axios.get('/api/conversations', config).catch(() => ({ data: [] })),
          axios.get('/api/projects', config).catch(() => ({ data: [] })),
          axios.get('/api/payments/product-payments', config).catch(() => ({ data: [] })),
        ]);
        setConversations(Array.isArray(resConv.data) ? resConv.data : []);
        setProjects(Array.isArray(resProj.data) ? resProj.data : []);
        setPayments(Array.isArray(resPay.data) ? resPay.data : []);
      } catch {
        // silently fail — show zeros
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeConversations = conversations.length;
  const activeProjects = projects.length;
  const totalPayments = payments.length;

  const stats = [
    { 
      label: 'Active Projects',
      value: loading ? '…' : String(activeProjects),
      icon: <BookOpen size={28} />, 
      color: '#1E40AF',
    },
    { 
      label: 'Active Conversations', 
      value: loading ? '…' : String(activeConversations),
      icon: <MessageSquare size={28} />, 
      color: '#8B5CF6',
    },
    { 
      label: 'Artisan Connections', 
      value: loading ? '…' : String(activeConversations),
      icon: <Users size={28} />, 
      color: '#10B981',
    },
    { 
      label: 'Product Purchases', 
      value: loading ? '…' : String(totalPayments),
      icon: <Wallet size={28} />, 
      color: '#F59E0B',
    },
  ];

  const recentConnections = conversations.slice(0, 3).map((conv: any) => {
    const other = conv.participants?.find((p: any) => p._id !== user?._id);
    return {
      name: other ? `${other.firstName} ${other.lastName}` : 'Unknown',
      role: other?.role || 'Artisan',
      lastContact: conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString() : '—',
    };
  });

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
    { 
      label: 'View Payments', 
      icon: <Wallet size={24} />, 
      action: () => onNavigate('payments'), 
      color: '#8B5CF6',
      description: 'Track your material purchases'
    },
  ];

  return (
    <div className="space-y-8">
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


      {/* Recent Conversations */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Recent Conversations</h2>
            <p className="text-muted-foreground mt-1">Your artisan network</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => onNavigate('messages')}
            className="rounded-xl border-2 hover:border-primary hover:text-primary"
          >
            View All
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={32} className="animate-spin text-primary" /></div>
        ) : recentConnections.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No conversations yet. Connect with artisans!</p>
        ) : (
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
                    <p className="text-sm text-muted-foreground capitalize">{connection.role}</p>
                    <p className="text-sm text-muted-foreground">{connection.lastContact}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="rounded-xl border-2" onClick={() => onNavigate('messages')}>
                  Message
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}