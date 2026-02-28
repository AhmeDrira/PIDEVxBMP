import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { User, Mail, Phone, MapPin, Briefcase, Save, Camera } from 'lucide-react';
import axios from 'axios';

export default function ArtisanProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // L'URL de notre API configurée dans le .env
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    domain: '', // domain correspond à specialization
    yearsExperience: '',
    licenseNumber: ''
  });

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

        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          phone: userData.phone || '',
          location: userData.location || '',
          bio: userData.bio || '',
          domain: userData.domain || '',
          yearsExperience: userData.yearsExperience?.toString() || '',
          licenseNumber: userData.licenseNumber || ''
        });
        setLoading(false);
      } catch (error: any) {
        console.error("Erreur détaillée lors du chargement du profil:", error.response?.data || error.message);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [API_URL]);

  // 2. Sauvegarder les modifications
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // --- ON RÉCUPÈRE LE TOKEN DE LA MÊME FAÇON ---
      let token = localStorage.getItem('token');
      const userStorage = localStorage.getItem('user');
      
      if (!token && userStorage) {
        const parsedUser = JSON.parse(userStorage);
        token = parsedUser.token; 
      }

      if (!token) {
        alert("Erreur de sécurité : Impossible de trouver le token.");
        return;
      }
      // ---------------------------------------------

      await axios.put(`${API_URL}/auth/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setIsEditing(false);
      alert('Profil mis à jour avec succès !');
      
      // Optionnel : tu peux recharger la page pour voir les changements confirmés
      // window.location.reload(); 
      
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      alert('Erreur lors de la sauvegarde. Regarde la console.');
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
              <Avatar className="w-32 h-32">
                <AvatarFallback
                  className="text-4xl"
                  style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}
                >
                  {initials}
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
                <Label htmlFor="domain">Specialization (Domain)</Label>
                <Input
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Years of Experience</Label>
                <Input
                  id="yearsExperience"
                  type="number"
                  value={formData.yearsExperience}
                  onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
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

            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }}>
              <Save size={20} className="mr-2" />
              Save Changes
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

            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>License Number</p>
              <p style={{ color: '#111827' }}>{formData.licenseNumber || 'Not provided'}</p>
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
