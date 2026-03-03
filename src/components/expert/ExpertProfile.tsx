import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { User, Mail, Phone, MapPin, Briefcase, Save, Camera, Award, Loader2 } from 'lucide-react';
import { LocationInput } from '../ui/location-input';
import { PhoneVerification } from '../ui/phone-verification';
import { EmailChangeSection } from '../ui/email-change';
import authService from '../../services/authService';
import { toast } from 'sonner';

export default function ExpertProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    isPhoneVerified: false,
    location: '',
    bio: '',
    specialization: '',
    credentials: '',
    institution: '',
    profilePhoto: ''
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        isPhoneVerified: user.isPhoneVerified || false,
        location: user.location || '',
        bio: user.bio || '',
        specialization: user.specialization || '',
        credentials: user.credentials || '',
        institution: user.institution || '',
        profilePhoto: user.profilePhoto || ''
      });
    }
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profilePhoto: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updatedUser = await authService.updateProfile(formData);
      const currentUser = authService.getCurrentUser();
      localStorage.setItem('user', JSON.stringify({ ...currentUser, ...updatedUser }));
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    { label: 'Articles Published', value: '0' },
    { label: 'Total Views', value: '0' },
    { label: 'Connections', value: '0' },
    { label: 'Years Experience', value: '0' }
  ];

  return (
    <div className="space-y-6">
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
                  <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <AvatarFallback
                    className="text-4xl"
                    style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}
                  >
                    {formData.firstName?.[0]}{formData.lastName?.[0]}
                  </AvatarFallback>
                )}
              </Avatar>
              <button
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
                  <Award size={16} />
                  {formData.credentials || 'No credentials set'}
                </p>
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

      <Card className="p-6 bg-white">
        <h3 className="text-xl mb-6" style={{ color: '#111827' }}>Profile Information</h3>
        
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Enter your first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Enter your last name"
                />
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
                <EmailChangeSection
                  currentEmail={formData.email}
                  onEmailChanged={(newEmail) => setFormData({ ...formData, email: newEmail })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <PhoneVerification
                  initialPhone={formData.phone}
                  isVerified={formData.isPhoneVerified}
                  onVerified={(newPhone) => setFormData({ ...formData, phone: newPhone, isPhoneVerified: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <LocationInput
                  id="location"
                  value={formData.location}
                  onChange={(val) => setFormData({ ...formData, location: val })}
                  placeholder="City, Region"
                />
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
              <div className="space-y-2">
                <Label htmlFor="credentials">Credentials</Label>
                <Input
                  id="credentials"
                  value={formData.credentials}
                  onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                  placeholder="e.g. PhD, PE, MBA"
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
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Save size={20} className="mr-2" />}
              Save Changes
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
                <p style={{ color: '#111827' }}>{formData.phone || 'Not set'} {formData.isPhoneVerified && <span className="text-green-600 text-xs ml-2">(Verified)</span>}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Location</p>
                <p style={{ color: '#111827' }}>{formData.location || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Specialization</p>
                <p style={{ color: '#111827' }}>{formData.specialization || <span className="text-muted-foreground italic">Not set</span>}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Credentials</p>
                <p style={{ color: '#111827' }}>{formData.credentials || 'Not set'}</p>
              </div>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Institution / Organization</p>
              <p style={{ color: '#111827' }}>{formData.institution || 'Not set'}</p>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Bio</p>
              <p style={{ color: '#111827' }}>{formData.bio || <span className="text-muted-foreground italic">No bio provided. Click 'Edit Profile' to add one.</span>}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
