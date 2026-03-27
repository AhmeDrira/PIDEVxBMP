import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Camera, Loader2, Phone, User as UserIcon, Mail } from 'lucide-react';

interface AdminProfileForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhoto: string;
  adminType?: string;
}

const API_URL = '/api';

const getToken = () => {
  const storedToken = localStorage.getItem('token');
  if (storedToken) return storedToken;
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    try {
      return JSON.parse(storedUser).token;
    } catch (err) {
      console.warn('Unable to parse user token from storage', err);
    }
  }
  return null;
};

export default function AdminProfile() {
  const [formData, setFormData] = useState<AdminProfileForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    profilePhoto: '',
    adminType: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = getToken();
        if (!token) {
          toast.error('Authentication required to load profile');
          setLoading(false);
          return;
        }

        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const userData = response.data.user ?? response.data;
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          phone: userData.phone || '',
          profilePhoto: userData.profilePhoto || '',
          adminType: userData.adminType || 'admin',
        });

        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem(
            'user',
            JSON.stringify({
              ...parsed,
              firstName: userData.firstName || parsed.firstName,
              lastName: userData.lastName || parsed.lastName,
              profilePhoto: userData.profilePhoto || parsed.profilePhoto,
              phone: userData.phone || parsed.phone,
              adminType: userData.adminType || parsed.adminType,
            }),
          );
          window.dispatchEvent(new Event('storage'));
        }
      } catch (error) {
        console.error('Failed to load admin profile', error);
        toast.error('Unable to load profile information');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Please choose an image under 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setFormData((prev) => ({ ...prev, profilePhoto: base64 }));

      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem('user', JSON.stringify({ ...parsed, profilePhoto: base64 }));
        window.dispatchEvent(new Event('storage'));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const token = getToken();
      if (!token) {
        toast.error('Authentication expired');
        setIsSaving(false);
        return;
      }

      await axios.put(
        `${API_URL}/auth/profile`,
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          profilePhoto: formData.profilePhoto,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem(
          'user',
          JSON.stringify({
            ...parsed,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            profilePhoto: formData.profilePhoto,
          }),
        );
        window.dispatchEvent(new Event('storage'));
      }

      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error: any) {
      console.error('Failed to update admin profile', error);
      const message = error.response?.data?.message || 'Unable to update profile. Please try again.';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading profile...</div>;
  }

  const initials = `${formData.firstName?.[0] ?? ''}${formData.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="space-y-8">
      <Card className="p-8 bg-white rounded-3xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex flex-col items-center">
            <div className="relative">
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              <Avatar className="w-32 h-32">
                {formData.profilePhoto ? (
                  <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="text-3xl" style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}>
                    {initials || 'A'}
                  </AvatarFallback>
                )}
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 rounded-full p-2 shadow-md text-white"
                style={{ backgroundColor: '#1F3A8A' }}
                title="Upload photo"
              >
                <Camera size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Upload a square image (max 5 MB)</p>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="text-2xl font-semibold text-foreground">
                {formData.firstName || 'Admin'} {formData.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Admin Type</p>
              <p className="text-lg font-medium capitalize">{formData.adminType || 'admin'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-lg font-medium">{formData.email}</p>
            </div>
            <div>
              <Button
                type="button"
                onClick={() => setIsEditing((prev) => !prev)}
                className="rounded-xl text-white"
                style={{ backgroundColor: '#1F3A8A' }}
              >
                {isEditing ? 'Cancel editing' : 'Edit profile'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-8 bg-white rounded-3xl border-0 shadow-lg">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Enter first name"
                  className="pl-10"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Enter last name"
                  className="pl-10"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input id="email" value={formData.email} disabled className="pl-10 bg-gray-50" />
              </div>
              <p className="text-xs text-muted-foreground">Email updates are handled by the platform owner.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Add a contact phone"
                  className="pl-10"
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!isEditing || isSaving}
              className="rounded-xl text-white"
              style={{ backgroundColor: '#1F3A8A' }}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
