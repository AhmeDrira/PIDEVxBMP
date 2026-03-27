import React, { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { User, MapPin, Briefcase, Save, Camera, Loader2 } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import axios from 'axios';
import { TUNISIA_STATES } from '../../lib/tunisiaStates';

export default function ExpertProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const API_URL = '/api';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    specialization: '',
    institution: '',
    profilePhoto: ''
  });
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const getToken = () => {
    const direct = localStorage.getItem('token');
    if (direct) return direct;
    const stored = localStorage.getItem('user');
    if (stored) return JSON.parse(stored).token;
    return null;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = getToken();
        if (!token) { setLoading(false); return; }

        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const userData = response.data.user ? response.data.user : response.data;
        const locationValue = userData.location || '';
        const parsedStates = locationValue
          .split(',')
          .map((state: string) => state.trim())
          .filter(Boolean);

        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          phone: userData.phone || '',
          location: locationValue,
          bio: userData.bio || '',
          specialization: userData.domain || userData.specialization || '',
          institution: userData.institution || '',
          profilePhoto: userData.profilePhoto || ''
        });

        setSelectedStates(parsedStates);

        // Sync localStorage so header/dropdown avatars reflect the DB photo on load
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          localStorage.setItem('user', JSON.stringify({
            ...parsedUser,
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            profilePhoto: userData.profilePhoto || '',
          }));
          window.dispatchEvent(new Event('storage'));
        }
      } catch (err) {
        console.error('Failed to load expert profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [API_URL]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      location: selectedStates.join(', '),
    }));
  }, [selectedStates]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const newPhoto = reader.result as string;
      setFormData(prev => ({ ...prev, profilePhoto: newPhoto }));
      // Sync immediately so header/dropdown avatars update right away
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem('user', JSON.stringify({ ...parsed, profilePhoto: newPhoto }));
        window.dispatchEvent(new Event('storage'));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = getToken();
      if (!token) { toast.error('Authentication error'); return; }

      await axios.put(`${API_URL}/auth/profile`, {
        ...formData,
        domain: formData.specialization,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const stored = localStorage.getItem('user');
      if (stored) {
        const userObj = JSON.parse(stored);
        localStorage.setItem('user', JSON.stringify({ ...userObj, ...formData }));
        window.dispatchEvent(new Event('storage'));
      }

      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;

  const initials = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase();

  const stats = [
    { label: 'Articles Published', value: '0' },
    { label: 'Total Views', value: '0' },
    { label: 'Connections', value: '0' },
  ];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card className="p-6 bg-white">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
              <Avatar className="w-32 h-32">
                {formData.profilePhoto ? (
                  <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback
                    className="text-4xl"
                    style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}
                  >
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#F59E0B' }}
                title="Upload Photo"
              >
                <Camera size={20} />
              </button>
            </div>
            <p className="text-sm mt-2" style={{ color: '#6B7280' }}>Click to change photo</p>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl mb-1" style={{ color: '#111827' }}>{formData.firstName} {formData.lastName}</h2>
                <p className="flex items-center gap-2 mb-2" style={{ color: '#6B7280' }}>
                  <Briefcase size={16} />
                  {formData.specialization || 'No specialization set'}
                </p>
                <p className="flex items-center gap-2" style={{ color: '#6B7280' }}>
                  <MapPin size={16} />
                  {formData.location || 'No location set'}
                </p>
              </div>
              <Button
                onClick={() => setIsEditing(!isEditing)}
                variant={isEditing ? 'outline' : 'default'}
                className={isEditing ? '' : 'text-white'}
                style={isEditing ? {} : { backgroundColor: '#1F3A8A' }}
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {stats.map((stat, index) => (
                <div key={index} className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F3F4F6' }}>
                  <p className="text-2xl mb-1" style={{ color: '#1F3A8A' }}>{stat.value}</p>
                  <p className="text-sm" style={{ color: '#6B7280' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Profile Information */}
      <Card className="p-6 bg-white">
        <h3 className="text-xl mb-6" style={{ color: '#111827' }}>Profile Information</h3>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Enter your first name"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Enter your last name"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-400">Email cannot be changed here</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter your phone number"
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="location">Location (Tunisia)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TUNISIA_STATES.map((state) => (
                    <label
                      key={state}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-foreground"
                    >
                      <Checkbox
                        checked={selectedStates.includes(state)}
                        onCheckedChange={(checked) => {
                          const isChecked = Boolean(checked);
                          setSelectedStates((prev) => (
                            isChecked
                              ? [...prev, state]
                              : prev.filter((item) => item !== state)
                          ));
                        }}
                      />
                      <span>{state}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Select one or more governorates.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="e.g. Structural Engineering, Architecture"
                />
              </div>

            </div>

            <div className="space-y-2">
              <Label htmlFor="institution">Institution / Organization</Label>
              <Input
                id="institution"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                placeholder="e.g. University of Tunis, CSTB"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Describe your expertise, research areas, and professional background..."
                rows={4}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="text-white"
              style={{ backgroundColor: '#10B981' }}
            >
              {isLoading ? <Loader2 size={20} className="mr-2 animate-spin" /> : <Save size={20} className="mr-2" />}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Full Name</p>
                <p style={{ color: '#111827' }}>{formData.firstName} {formData.lastName}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Email Address</p>
                <p style={{ color: '#111827' }}>{formData.email}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Phone Number</p>
                <p style={{ color: '#111827' }}>{formData.phone || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Location</p>
                <p style={{ color: '#111827' }}>{formData.location || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Specialization</p>
                <p style={{ color: '#111827' }}>{formData.specialization || 'Not provided'}</p>
              </div>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Institution / Organization</p>
              <p style={{ color: '#111827' }}>{formData.institution || 'Not provided'}</p>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Bio</p>
              <p style={{ color: '#111827' }}>{formData.bio || 'No bio written yet.'}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Security Settings */}
      <Card className="p-6 bg-white">
        <h3 className="text-xl mb-6" style={{ color: '#111827' }}>Security Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p style={{ color: '#111827' }}>Change Password</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>Update your password regularly for security</p>
            </div>
            <Button variant="outline">Change</Button>
          </div>
          <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid #E5E7EB' }}>
            <div>
              <p style={{ color: '#111827' }}>Two-Factor Authentication</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>Add an extra layer of security</p>
            </div>
            <Button variant="outline">Enable</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
