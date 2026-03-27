import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { User, Mail, Phone, MapPin, Briefcase, Save, Camera, Loader2 } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import axios from 'axios';
import { TUNISIA_STATES } from '../../lib/tunisiaStates';

export default function ArtisanProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Use Vite proxy to avoid CORS issues in development
  const API_URL = '/api';

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    domain: '', // domain correspond à specialization
    yearsExperience: '',
    profilePhoto: ''
  });
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    }
  };

  // 1. Récupérer les données de l'artisan au chargement
  // 1. Récupérer les données de l'artisan au chargement
  useEffect(() => {
    const fetchProfile = async () => {
      try {// Remplace la partie "VÉRIFICATION DU TOKEN" par ceci :
  let token = null;
  
  // On cherche d'abord si la clé s'appelle directement 'token'
  const directToken = localStorage.getItem('token');
  
  // Sinon on regarde si c'est stocké dans un objet 'user'
  const userStorage = localStorage.getItem('user');

  if (directToken) {
    token = directToken;
  } else if (userStorage) {
    // Si c'est un objet, on le transforme en JSON pour extraire le token
    const parsedUser = JSON.parse(userStorage);
    token = parsedUser.token; // Assure-toi que c'est bien ".token" que le backend renvoie lors du login
  }

  console.log("1. Token extrait :", token);

  if (!token) {
    console.error("Toujours aucun token ! Il faut vérifier le authService.ts");
    setLoading(false);
    return;
  }

        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("2. Réponse du Backend :", response.data);

        // Adaptation si le backend renvoie { user: { ... } } ou directement les données
        const userData = response.data.user ? response.data.user : response.data;
        
        console.log("3. Données extraites :", userData);

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
          domain: userData.domain || '',
          yearsExperience: userData.yearsExperience?.toString() || '',
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

        setLoading(false);
      } catch (error: any) {
        console.error("Erreur détaillée lors du chargement du profil:", error.response?.data || error.message);
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

  // 2. Sauvegarder les modifications
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // --- ON RÉCUPÈRE LE TOKEN DE LA MÊME FAÇON ---
      let token = localStorage.getItem('token');
      const userStorage = localStorage.getItem('user');
      
      if (!token && userStorage) {
        const parsedUser = JSON.parse(userStorage);
        token = parsedUser.token; 
      }

      if (!token) {
        toast.error('Security error: Unable to find token.');
        return;
      }
      // ---------------------------------------------

      await axios.put(`${API_URL}/auth/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setIsEditing(false);
      toast.success('Profile updated successfully');

      const stored = localStorage.getItem('user');
      if (stored) {
        const userObj = JSON.parse(stored);
        localStorage.setItem('user', JSON.stringify({
          ...userObj,
          firstName: formData.firstName,
          lastName: formData.lastName,
          profilePhoto: formData.profilePhoto,
        }));
        window.dispatchEvent(new Event('storage'));
      }
      
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error('Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement du profil...</div>;

  const fullName = `${formData.firstName} ${formData.lastName}`;
  const initials = `${formData.firstName?.charAt(0) || ''}${formData.lastName?.charAt(0) || ''}`.toUpperCase();

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
                <h2 className="text-2xl mb-1" style={{ color: '#111827' }}>{fullName}</h2>
                <p className="flex items-center gap-2 mb-2" style={{ color: '#6B7280' }}>
                  <Briefcase size={16} />
                  {formData.domain}
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
                    placeholder="Enter your first name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
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
                    placeholder="Enter your last name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
                    placeholder="Enter your phone number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-10"
                  />
                </div>
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
                <Label htmlFor="domain">Specialization (Domain)</Label>
                <Input
                  id="domain"
                  placeholder="e.g., Electrical Wiring, Plumbing"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Years of Experience</Label>
                <Input
                  id="yearsExperience"
                  type="number"
                  placeholder="0"
                  value={formData.yearsExperience}
                  onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself, your skills, and experience..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
              />
            </div>

            <Button type="submit" disabled={isLoading} className="text-white" style={{ backgroundColor: '#10B981' }}>
              {isLoading ? <Loader2 size={20} className="mr-2 animate-spin" /> : <Save size={20} className="mr-2" />}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Full Name</p>
                <p style={{ color: '#111827' }}>{fullName}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Email Address</p>
                <p style={{ color: '#111827' }}>{formData.email} <span className="text-xs bg-gray-100 px-2 py-1 rounded ml-2">(Read-only)</span></p>
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
                <p style={{ color: '#111827' }}>{formData.domain || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Experience</p>
                <p style={{ color: '#111827' }}>{formData.yearsExperience ? `${formData.yearsExperience} years` : 'Not provided'}</p>
              </div>
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
