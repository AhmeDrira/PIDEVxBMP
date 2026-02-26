import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { User, Mail, Phone, MapPin, Briefcase, Save, Camera } from 'lucide-react';

export default function ArtisanProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: 'Ahmed Ben Salah',
    email: 'ahmed.bensalah@example.com',
    phone: '+216 98 123 456',
    location: 'Tunis, Tunisia',
    bio: 'Experienced construction artisan with over 10 years of expertise in residential and commercial projects.',
    specialization: 'General Construction, Renovation',
    experience: '10+ years',
    licenseNumber: 'LIC-TN-2014-5678'
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    // In a real app, this would save to backend
  };

  const stats = [
    { label: 'Completed Projects', value: '47' },
    { label: 'Client Rating', value: '4.8/5' },
    { label: 'Years Experience', value: '10+' },
    { label: 'Active Projects', value: '5' }
  ];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card className="p-6 bg-white">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="w-32 h-32">
                <AvatarFallback
                  className="text-4xl"
                  style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}
                >
                  AB
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute bottom-0 right-0 p-2 rounded-full text-white"
                style={{ backgroundColor: '#F59E0B' }}
              >
                <Camera size={20} />
              </button>
            </div>
            <p className="text-sm mt-2" style={{ color: '#6B7280' }}>Click to change photo</p>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl mb-1" style={{ color: '#111827' }}>{formData.name}</h2>
                <p className="flex items-center gap-2 mb-2" style={{ color: '#6B7280' }}>
                  <Briefcase size={16} />
                  {formData.specialization}
                </p>
                <p className="flex items-center gap-2" style={{ color: '#6B7280' }}>
                  <MapPin size={16} />
                  {formData.location}
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
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience">Experience</Label>
                <Input
                  id="experience"
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="license">License Number</Label>
              <Input
                id="license"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="text-white"
              style={{ backgroundColor: '#10B981' }}
            >
              <Save size={20} className="mr-2" />
              Save Changes
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Full Name</p>
                <p style={{ color: '#111827' }}>{formData.name}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Email Address</p>
                <p style={{ color: '#111827' }}>{formData.email}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Phone Number</p>
                <p style={{ color: '#111827' }}>{formData.phone}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Location</p>
                <p style={{ color: '#111827' }}>{formData.location}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Specialization</p>
                <p style={{ color: '#111827' }}>{formData.specialization}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Experience</p>
                <p style={{ color: '#111827' }}>{formData.experience}</p>
              </div>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Bio</p>
              <p style={{ color: '#111827' }}>{formData.bio}</p>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>License Number</p>
              <p style={{ color: '#111827' }}>{formData.licenseNumber}</p>
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
