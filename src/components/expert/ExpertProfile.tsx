import React, { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { User, Mail, Phone, MapPin, Briefcase, Save, Camera, Award } from 'lucide-react';
import axios from 'axios';

export default function ExpertProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const [formData, setFormData] = useState({
    name: 'Dr. Karim Mansour',
    email: 'k.mansour@expert.com',
    phone: '+216 98 654 321',
    location: 'Tunis, Tunisia',
    bio: 'Construction expert with PhD in Structural Engineering. Over 20 years of experience in consulting and research.',
    specialization: 'Structural Engineering, Safety Standards',
    credentials: 'PhD Structural Engineering, Licensed PE',
    institution: 'National Engineering School of Tunis'
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        let token: string | null = localStorage.getItem('token');
        const userStorage = localStorage.getItem('user');

        if (!token && userStorage) {
          const parsedUser = JSON.parse(userStorage);
          token = parsedUser.token;
        }

        console.log('ExpertProfile GET - Token:', token);

        if (!token) {
          console.error('ExpertProfile: no token found');
          return;
        }

        const response = await axios.get(`${API_URL}/experts/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log('ExpertProfile GET - Response:', response.data);

        const data = response.data;

        setFormData((prev) => ({
          ...prev,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || prev.name,
          email: data.email || prev.email,
          phone: data.phone || '',
          specialization: data.domain || '',
        }));
      } catch {
        // Silently fail for now; UI remains with default static data
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let token: string | null = localStorage.getItem('token');
      const userStorage = localStorage.getItem('user');

      if (!token && userStorage) {
        const parsedUser = JSON.parse(userStorage);
        token = parsedUser.token;
      }

      console.log('ExpertProfile PUT - Token:', token);

      if (!token) {
        setIsEditing(false);
        return;
      }

      const fullName = formData.name.trim();
      const [firstName, ...rest] = fullName.split(' ');
      const lastName = rest.join(' ');

      const response = await axios.put(
        `${API_URL}/experts/me`,
        {
          firstName: firstName || '',
          lastName: lastName || '',
          phone: formData.phone,
          domain: formData.specialization,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('ExpertProfile PUT - Response:', response.data);
    } finally {
      setIsEditing(false);
    }
  };

  const stats = [
    { label: 'Articles Published', value: '24' },
    { label: 'Total Views', value: '12.5K' },
    { label: 'Connections', value: '87' },
    { label: 'Years Experience', value: '20+' }
  ];

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-white">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="w-32 h-32">
                <AvatarFallback
                  className="text-4xl"
                  style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}
                >
                  KM
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
                  <Award size={16} />
                  {formData.credentials}
                </p>
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

      <Card className="p-6 bg-white">
        <h3 className="text-xl mb-6" style={{ color: '#111827' }}>Profile Information</h3>
        
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
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
                <Label htmlFor="credentials">Credentials</Label>
                <Input
                  id="credentials"
                  value={formData.credentials}
                  onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="institution">Institution / Organization</Label>
              <Input
                id="institution"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              />
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
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Credentials</p>
                <p style={{ color: '#111827' }}>{formData.credentials}</p>
              </div>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Institution / Organization</p>
              <p style={{ color: '#111827' }}>{formData.institution}</p>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Bio</p>
              <p style={{ color: '#111827' }}>{formData.bio}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
