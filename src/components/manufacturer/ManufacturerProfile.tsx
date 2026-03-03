import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Save, Upload, Loader2, Camera } from 'lucide-react';
import { LocationInput } from '../ui/location-input';
import { PhoneVerification } from '../ui/phone-verification';
import { EmailChangeSection } from '../ui/email-change';
import authService from '../../services/authService';
import { toast } from 'sonner';

export default function ManufacturerProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    phone: '',
    isPhoneVerified: false,
    location: '',
    description: '',
    certificationNumber: '',
    profilePhoto: '',
  });

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setFormData({
        companyName: user.companyName || '',
        email: user.email || '',
        phone: user.phone || '',
        isPhoneVerified: user.isPhoneVerified || false,
        location: user.location || '',
        description: user.description || '',
        certificationNumber: user.certificationNumber || '',
        profilePhoto: user.profilePhoto || '',
      });
    }
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    try {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profilePhoto: reader.result as string });
      };
      reader.readAsDataURL(file);
      toast.success('Photo uploaded successfully. Click Save to apply changes.');
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setIsLoading(false);
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

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-white">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
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
                    {formData.companyName ? formData.companyName[0].toUpperCase() : 'M'}
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
            <p className="text-sm mt-2" style={{ color: '#6B7280' }}>Click to change logo</p>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl mb-2" style={{ color: '#111827' }}>{formData.companyName || 'Unnamed Company'}</h2>
                <p style={{ color: '#6B7280' }}>Verified Manufacturer</p>
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
          </div>
        </div>

        {isEditing ? (
          <form className="space-y-6" onSubmit={handleSave}>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} placeholder="Enter your company name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} disabled className="bg-gray-50" />
                <EmailChangeSection
                  currentEmail={formData.email}
                  onEmailChanged={(newEmail) => setFormData({ ...formData, email: newEmail })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <PhoneVerification
                  initialPhone={formData.phone}
                  isVerified={formData.isPhoneVerified}
                  onVerified={(newPhone) => setFormData({ ...formData, phone: newPhone, isPhoneVerified: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <LocationInput
                  value={formData.location}
                  onChange={(val) => setFormData({ ...formData, location: val })}
                  placeholder="Industrial Zone, City"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Describe your company, products, certifications, and what sets you apart..." rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Update Certification</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{ borderColor: '#E5E7EB' }}>
                <Upload size={32} className="mx-auto mb-2" style={{ color: '#6B7280' }} />
                <Input type="file" accept=".pdf,.doc,.docx" />
              </div>
            </div>
            <Button type="submit" disabled={isLoading} className="text-white" style={{ backgroundColor: '#10B981' }}>
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Save size={20} className="mr-2" />}
              Save Changes
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Company Name</p>
                <p style={{ color: '#111827' }}>{formData.companyName || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Email</p>
                <p style={{ color: '#111827' }}>{formData.email}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Phone</p>
                <p style={{ color: '#111827' }}>{formData.phone || 'Not set'} {formData.isPhoneVerified && <span className="text-green-600 text-xs ml-2">(Verified)</span>}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Location</p>
                <p style={{ color: '#111827' }}>{formData.location || 'Not set'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Description</p>
              <p style={{ color: '#111827' }}>{formData.description || <span className="text-muted-foreground italic">No description provided. Click 'Edit Profile' to add one.</span>}</p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Certification Number</p>
              <p style={{ color: '#111827' }}>{formData.certificationNumber || 'Not set'}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
