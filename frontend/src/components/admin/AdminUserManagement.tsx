import { useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { KeyRound, Search, Trash2, Shield, UserCheck, UserX, Settings2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import StatsCard from '../common/StatsCard';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Checkbox } from '../ui/checkbox';
import authService from '../../services/authService';
import { toast } from 'sonner';

interface AdminUserManagementProps {
  canSuspendUsers?: boolean;
  canDeleteUsers?: boolean;
}

type PermissionSet = {
  canVerifyManufacturers: boolean;
  canManageKnowledge: boolean;
  canSuspendUsers: boolean;
  canDeleteUsers: boolean;
};

type ManagedUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
  adminType?: string;
  permissions?: Partial<PermissionSet>;
};

const emptyPermissions: PermissionSet = {
  canVerifyManufacturers: false,
  canManageKnowledge: false,
  canSuspendUsers: false,
  canDeleteUsers: false,
};

export default function AdminUserManagement({ canSuspendUsers = false, canDeleteUsers = false }: AdminUserManagementProps) {
  const currentUser = authService.getCurrentUser();
  const isSubAdmin = currentUser?.role === 'admin' && currentUser?.adminType === 'sub';
  const isSuperAdmin = currentUser?.role === 'admin' && (currentUser?.adminType === 'super' || currentUser?.isSuperAdmin);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState('Total Users');
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [editingSubAdmin, setEditingSubAdmin] = useState<ManagedUser | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<PermissionSet>(emptyPermissions);
  const [savingPermissions, setSavingPermissions] = useState(false);

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
    { 
      label: 'Total Users', 
      value: users.length, 
      icon: <UserCheck size={28} />, 
      color: '#1E40AF',
      onClick: () => setActiveFilter('Total Users'),
      isActive: activeFilter === 'Total Users'
    },
    { 
      label: 'Artisans', 
      value: users.filter(u => u.role === 'artisan').length, 
      icon: <UserCheck size={28} />, 
      color: '#F59E0B',
      onClick: () => setActiveFilter('Artisans'),
      isActive: activeFilter === 'Artisans'
    },
    { 
      label: 'Experts', 
      value: users.filter(u => u.role === 'expert').length, 
      icon: <UserCheck size={28} />, 
      color: '#10B981',
      onClick: () => setActiveFilter('Experts'),
      isActive: activeFilter === 'Experts'
    },
    { 
      label: 'Manufacturers', 
      value: users.filter(u => u.role === 'manufacturer').length, 
      icon: <UserCheck size={28} />, 
      color: '#8B5CF6',
      onClick: () => setActiveFilter('Manufacturers'),
      isActive: activeFilter === 'Manufacturers'
    },
    { 
      label: 'Admins', 
      value: users.filter(u => u.role === 'admin').length, 
      icon: <Shield size={28} />, 
      color: '#EF4444',
      onClick: () => setActiveFilter('Admins'),
      isActive: activeFilter === 'Admins'
    },
  ]), [users, activeFilter]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'artisan': return 'bg-secondary/10 text-secondary border-0';
      case 'expert': return 'bg-accent/10 text-accent border-0';
      case 'manufacturer': return 'bg-purple-100 text-purple-700 border-0';
      case 'admin': return 'bg-red-100 text-red-700 border-0';
      default: return 'bg-gray-100 text-gray-700 border-0';
    }
  };

  const displayName = (u: ManagedUser) => {
    if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
    return u.email;
  };

  const openPermissionsEditor = (user: ManagedUser) => {
    if (!isSuperAdmin || user.role !== 'admin' || user.adminType !== 'sub') {
      toast.error('Only super admins can edit sub-admin permissions.');
      return;
    }

    setEditingSubAdmin(user);
    setEditingPermissions({
      canVerifyManufacturers: Boolean(user.permissions?.canVerifyManufacturers),
      canManageKnowledge: Boolean(user.permissions?.canManageKnowledge),
      canSuspendUsers: Boolean(user.permissions?.canSuspendUsers),
      canDeleteUsers: Boolean(user.permissions?.canDeleteUsers),
    });
    setPermissionsDialogOpen(true);
  };

  const savePermissions = async () => {
    if (!editingSubAdmin) return;
    setSavingPermissions(true);
    try {
      await authService.updateSubAdminPermissions(editingSubAdmin._id, editingPermissions);
      toast.success('Sub-admin permissions updated successfully.');
      setPermissionsDialogOpen(false);
      setEditingSubAdmin(null);
      setRefreshKey((k) => k + 1);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Unable to update permissions.';
      toast.error(message);
    } finally {
      setSavingPermissions(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const name = displayName(user);
    const matchesSearch = (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    let matchesFilter = true;
    if (activeFilter === 'Artisans') matchesFilter = user.role === 'artisan';
    else if (activeFilter === 'Experts') matchesFilter = user.role === 'expert';
    else if (activeFilter === 'Manufacturers') matchesFilter = user.role === 'manufacturer';
    else if (activeFilter === 'Admins') matchesFilter = user.role === 'admin';

    return matchesSearch && matchesFilter;
  });

  const suspend = async (id: string) => {
    if (!canSuspendUsers) {
      toast.error('You do not have permission to suspend users.');
      return;
    }
    const target = users.find((u) => u._id === id);
    if (isSubAdmin && target?.role === 'admin') {
      toast.error('Sub-admins cannot suspend admin accounts.');
      return;
    }
    try {
      await authService.suspendUser(id);
      setRefreshKey((k) => k + 1);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Unable to suspend user.';
      toast.error(message);
    }
  };

  const activate = async (id: string) => {
    if (!canSuspendUsers) {
      toast.error('You do not have permission to update user status.');
      return;
    }
    const target = users.find((u) => u._id === id);
    if (isSubAdmin && target?.role === 'admin') {
      toast.error('Sub-admins cannot update admin accounts.');
      return;
    }
    try {
      await authService.activateUser(id);
      setRefreshKey((k) => k + 1);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Unable to activate user.';
      toast.error(message);
    }
  };

  const remove = async (id: string) => {
    if (!canDeleteUsers) {
      toast.error('You do not have permission to delete users.');
      return;
    }
    const target = users.find((u) => u._id === id);
    if (isSubAdmin && target?.role === 'admin') {
      toast.error('Sub-admins cannot delete admin accounts.');
      return;
    }
    try {
      await authService.deleteUser(id);
      setRefreshKey((k) => k + 1);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Unable to delete user.';
      toast.error(message);
    }
  };

  const resetSubAdminPassword = async (id: string) => {
    if (!isSuperAdmin) {
      toast.error('Only super admins can reset sub-admin passwords.');
      return;
    }
    try {
      await authService.resetSubAdminPassword(id);
      toast.success('Temporary password sent to sub-admin email.');
      setRefreshKey((k) => k + 1);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Unable to reset password.';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            placeholder={`Search ${activeFilter.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
          />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {loading && <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg"><p className="text-muted-foreground">Loading users...</p></Card>}
        
        {!loading && filteredUsers.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border-0 shadow-lg">
            <UserX className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-1">No users found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filter.</p>
          </div>
        )}

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
              {isSuperAdmin && user.role === 'admin' && user.adminType === 'sub' && (
                <Button
                  onClick={() => openPermissionsEditor(user)}
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 rounded-xl border-2"
                  title="Edit permissions"
                >
                  <Settings2 size={16} />
                </Button>
              )}
              {isSuperAdmin && user.role === 'admin' && user.adminType === 'sub' && (
                <Button
                  onClick={() => resetSubAdminPassword(user._id)}
                  variant="outline"
                  size="sm"
                  className="h-10 px-4 rounded-xl border-2"
                  title="Send temporary password"
                >
                  <KeyRound size={16} />
                </Button>
              )}
              {user.status === 'active' ? (
                <Button
                  onClick={() => suspend(user._id)}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 rounded-xl border-2"
                  disabled={!canSuspendUsers || (isSubAdmin && user.role === 'admin')}
                  title={
                    !canSuspendUsers
                      ? 'Permission required'
                      : (isSubAdmin && user.role === 'admin')
                        ? 'Sub-admins cannot suspend admin accounts'
                        : 'Suspend user'
                  }
                >
                  <UserX size={16} className="mr-2" />
                  Suspend
                </Button>
              ) : (
                <Button
                  onClick={() => activate(user._id)}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 rounded-xl border-2"
                  disabled={!canSuspendUsers || (isSubAdmin && user.role === 'admin')}
                  title={
                    !canSuspendUsers
                      ? 'Permission required'
                      : (isSubAdmin && user.role === 'admin')
                        ? 'Sub-admins cannot update admin accounts'
                        : 'Activate user'
                  }
                >
                  <UserCheck size={16} className="mr-2" />
                  Activate
                </Button>
              )}
              <Button
                onClick={() => remove(user._id)}
                variant="outline"
                size="sm"
                className="h-10 px-4 rounded-xl border-2"
                disabled={!canDeleteUsers || (isSubAdmin && user.role === 'admin')}
                title={
                  !canDeleteUsers
                    ? 'Permission required'
                    : (isSubAdmin && user.role === 'admin')
                      ? 'Sub-admins cannot delete admin accounts'
                      : 'Delete user'
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {permissionsDialogOpen && (
        <div className="fixed inset-0 z-[1000]">
          <button
            type="button"
            aria-label="Close permissions modal"
            className="absolute inset-0 bg-black/55"
            onClick={() => setPermissionsDialogOpen(false)}
          />

          <div className="relative z-[1001] w-full h-full flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl p-6">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-foreground">Edit Sub-Admin Permissions</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {editingSubAdmin ? `Update access rights for ${displayName(editingSubAdmin)}.` : 'Select permissions.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div className="rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={editingPermissions.canVerifyManufacturers}
                      onCheckedChange={(val) => {
                        setEditingPermissions((prev) => ({ ...prev, canVerifyManufacturers: val === true }));
                      }}
                    />
                    <div>
                      <p className="font-semibold text-foreground">Manufacturer Verification</p>
                      <p className="text-sm text-muted-foreground">Review and approve manufacturer applications.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={editingPermissions.canManageKnowledge}
                      onCheckedChange={(val) => {
                        setEditingPermissions((prev) => ({ ...prev, canManageKnowledge: val === true }));
                      }}
                    />
                    <div>
                      <p className="font-semibold text-foreground">Knowledge Library</p>
                      <p className="text-sm text-muted-foreground">Publish and manage knowledge articles.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={editingPermissions.canSuspendUsers}
                      onCheckedChange={(val) => {
                        setEditingPermissions((prev) => ({ ...prev, canSuspendUsers: val === true }));
                      }}
                    />
                    <div>
                      <p className="font-semibold text-foreground">Suspend Users</p>
                      <p className="text-sm text-muted-foreground">Pause accounts that violate platform policy.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={editingPermissions.canDeleteUsers}
                      onCheckedChange={(val) => {
                        setEditingPermissions((prev) => ({ ...prev, canDeleteUsers: val === true }));
                      }}
                    />
                    <div>
                      <p className="font-semibold text-foreground">Delete Users</p>
                      <p className="text-sm text-muted-foreground">Permanently remove accounts.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)} disabled={savingPermissions}>
                  Cancel
                </Button>
                <Button onClick={savePermissions} disabled={savingPermissions}>
                  {savingPermissions ? 'Saving...' : 'Save Permissions'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
