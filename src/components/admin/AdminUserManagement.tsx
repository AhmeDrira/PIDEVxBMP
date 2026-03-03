import { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Trash2, Shield, UserCheck, UserX } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import { Avatar, AvatarFallback } from '../ui/avatar';
import authService from '../../services/authService';

export default function AdminUserManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<Array<{ _id: string; firstName?: string; lastName?: string; email: string; role: string; status: string; createdAt?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await authService.listUsers();
        setUsers(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  const stats = useMemo(() => ([
    { label: 'Total Users', value: users.length, icon: <UserCheck size={28} />, color: '#1E40AF' },
    { label: 'Artisans', value: users.filter(u => u.role === 'artisan').length, icon: <UserCheck size={28} />, color: '#F59E0B' },
    { label: 'Experts', value: users.filter(u => u.role === 'expert').length, icon: <UserCheck size={28} />, color: '#10B981' },
    { label: 'Manufacturers', value: users.filter(u => u.role === 'manufacturer').length, icon: <UserCheck size={28} />, color: '#8B5CF6' },
    { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: <Shield size={28} />, color: '#EF4444' },
  ]), [users]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'artisan': return 'bg-secondary/10 text-secondary border-0';
      case 'expert': return 'bg-accent/10 text-accent border-0';
      case 'manufacturer': return 'bg-purple-100 text-purple-700 border-0';
      case 'admin': return 'bg-red-100 text-red-700 border-0';
      default: return 'bg-gray-100 text-gray-700 border-0';
    }
  };

  const displayName = (u: any) => {
    if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
    return u.email;
  };

  const filteredUsers = users.filter(user => {
    const name = displayName(user);
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const suspend = async (id: string) => {
    await authService.suspendUser(id);
    setRefreshKey((k) => k + 1);
  };

  const activate = async (id: string) => {
    await authService.activateUser(id);
    setRefreshKey((k) => k + 1);
  };

  const remove = async (id: string) => {
    await authService.deleteUser(id);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">User Management</h1>
        <p className="text-lg text-muted-foreground">Manage all platform users</p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            placeholder="Search users by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
          />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {loading && <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg"><p className="text-muted-foreground">Loading users...</p></Card>}
        {!loading && filteredUsers.map((user) => (
          <Card key={user._id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-start gap-4 mb-4">
              <Avatar className="w-14 h-14 ring-4 ring-white shadow-lg">
                <AvatarFallback className="bg-primary text-white font-bold text-lg">
                  {(displayName(user)[0] || 'U').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-bold text-foreground text-lg mb-2">{displayName(user)}</h4>
                <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                <div className="flex items-center gap-2">
                  <Badge className={`${getRoleBadgeColor(user.role)} px-3 py-1 text-xs font-semibold`}>
                    {user.role?.charAt(0)?.toUpperCase() + user.role?.slice(1)}
                  </Badge>
                  <Badge className={`${user.status === 'active' ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'} border-0 px-3 py-1 text-xs font-semibold`}>
                    {user.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 mb-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Joined</p>
                <p className="text-sm font-bold text-foreground">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Role</p>
                <p className="text-sm font-bold text-foreground">{user.role}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {user.status === 'active' ? (
                <Button onClick={() => suspend(user._id)} variant="outline" size="sm" className="flex-1 h-10 rounded-xl border-2">
                  <UserX size={16} className="mr-2" />
                  Suspend
                </Button>
              ) : (
                <Button onClick={() => activate(user._id)} variant="outline" size="sm" className="flex-1 h-10 rounded-xl border-2">
                  <UserCheck size={16} className="mr-2" />
                  Activate
                </Button>
              )}
              <Button onClick={() => remove(user._id)} variant="outline" size="sm" className="h-10 px-4 rounded-xl border-2">
                <Trash2 size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
