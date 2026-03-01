import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
// Ajout de l'icône User pour afficher le nom et prénom
import { Building2, Mail, Phone, MapPin, Save, Upload, CheckCircle, AlertCircle, User } from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';

export default function ManufacturerProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 1. Ajout de firstName et lastName dans le State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    phone: '',
    location: '',
    description: '',
    certificationNumber: '',
    verificationStatus: 'pending' // Juste pour l'affichage (Read-only)
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = getToken();
        if (!token) return;

        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const userData = response.data;
        // 2. Mettre à jour l'état avec les prénoms et noms venant du backend
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          companyName: userData.companyName || '',
          email: userData.email || '',
          phone: userData.phone || '',
          location: userData.location || '',
          description: userData.description || '',
          certificationNumber: userData.certificationNumber || '',
          verificationStatus: userData.verificationStatus || 'pending'
        });
        setLoading(false);
      } catch (error) {
        console.error("Erreur lors du chargement du profil:", error);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [API_URL]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getToken();
      if (!token) return;

      await axios.put(`${API_URL}/auth/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setIsEditing(false);
      alert('Profile successfully updated!');

      const userStorage = localStorage.getItem('user');
      if (userStorage) {
        const userObj = JSON.parse(userStorage);
        // Sauvegarder aussi dans le storage local si le nom a changé
        userObj.firstName = formData.firstName;
        userObj.lastName = formData.lastName;
        userObj.companyName = formData.companyName;
        localStorage.setItem('user', JSON.stringify(userObj));
        window.dispatchEvent(new Event("storage")); 
      }

    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      alert('Erreur lors de la sauvegarde.');
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading profile...</div>;

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-white shadow-lg border-0 rounded-2xl">
        <div className="flex items-start justify-between mb-6 border-b pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
              <Building2 size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">{formData.companyName || 'Company Name'}</h2>
              <div className="flex items-center gap-2">
                {formData.verificationStatus === 'approved' ? (
                  <Badge className="bg-green-100 text-green-700 px-3 py-1 flex items-center gap-1">
                    <CheckCircle size={14} /> Verified Manufacturer
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-700 px-3 py-1 flex items-center gap-1">
                    <AlertCircle size={14} /> Verification Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? 'outline' : 'default'}
            className={`rounded-xl ${!isEditing ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </Button>
        </div>

        {isEditing ? (
          <form className="space-y-6" onSubmit={handleSave}>
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* --- NOUVEAUX CHAMPS FIRSTNAME ET LASTNAME --- */}
              <div className="space-y-2">
                <Label className="font-semibold">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input className="pl-10 h-12 rounded-xl border-2" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} required />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="font-semibold">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input className="pl-10 h-12 rounded-xl border-2" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} required />
                </div>
              </div>
              {/* ------------------------------------------- */}

              <div className="space-y-2">
                <Label className="font-semibold">Company Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input className="pl-10 h-12 rounded-xl border-2" value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Email <span className="text-xs font-normal text-gray-400">(Read-only)</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input type="email" className="pl-10 h-12 rounded-xl border-2 bg-gray-50" value={formData.email} readOnly />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input className="pl-10 h-12 rounded-xl border-2" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input className="pl-10 h-12 rounded-xl border-2" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Description</Label>
              <Textarea className="rounded-xl border-2 resize-none" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={4} placeholder="Describe your manufacturing business..." />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Certification Number</Label>
              <Input className="h-12 rounded-xl border-2" value={formData.certificationNumber} onChange={(e) => setFormData({...formData, certificationNumber: e.target.value})} placeholder="e.g. CERT-2026-XYZ" />
            </div>
            
            <div className="space-y-2">
              <Label className="font-semibold">Update Certification File</Label>
              <div className="border-2 border-dashed rounded-xl p-6 text-center border-gray-300 hover:border-primary transition-colors cursor-pointer bg-gray-50">
                <Upload size={32} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">Click to upload new certification PDF</p>
                <Input type="file" accept=".pdf,.doc,.docx" className="hidden" />
              </div>
            </div>

            {/* BOUTON CORRIGÉ : Utilise variant="default" pour forcer l'affichage de la couleur primaire */}
            <div className="pt-4">
              <Button type="submit" variant="default" className="h-12 px-8 rounded-xl w-full md:w-auto">
                <Save size={20} className="mr-2" /> Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              
              {/* --- NOUVEAU CHAMP VIEW POUR FIRST/LAST NAME --- */}
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm mb-1 text-muted-foreground flex items-center gap-2"><User size={16}/> Contact Person</p>
                <p className="font-semibold text-foreground">{formData.firstName} {formData.lastName}</p>
              </div>
              {/* --------------------------------------------- */}

              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm mb-1 text-muted-foreground flex items-center gap-2"><Mail size={16}/> Email</p>
                <p className="font-semibold text-foreground">{formData.email}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm mb-1 text-muted-foreground flex items-center gap-2"><Phone size={16}/> Phone</p>
                <p className="font-semibold text-foreground">{formData.phone}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm mb-1 text-muted-foreground flex items-center gap-2"><MapPin size={16}/> Location</p>
                <p className="font-semibold text-foreground">{formData.location || 'Not provided'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl md:col-span-2">
                <p className="text-sm mb-1 text-muted-foreground flex items-center gap-2"><Building2 size={16}/> Certification Number</p>
                <p className="font-semibold text-foreground">{formData.certificationNumber || 'Not provided'}</p>
              </div>
            </div>
            
            <div>
              <p className="text-sm mb-2 text-muted-foreground font-medium">Company Description</p>
              <div className="bg-gray-50 p-6 rounded-xl text-foreground leading-relaxed whitespace-pre-wrap">
                {formData.description || 'No description provided yet.'}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}