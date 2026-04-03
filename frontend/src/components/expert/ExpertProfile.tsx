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
import { useLanguage } from '../../context/LanguageContext';

export default function ExpertProfile() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
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
      toast.error(tr('Image must be less than 5MB', 'L\'image doit faire moins de 5 Mo'));
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
      if (!token) { toast.error(tr('Authentication error', 'Erreur d\'authentification')); return; }

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

      toast.success(tr('Profile updated successfully', 'Profil mis a jour avec succes', 'تم تحديث الملف الشخصي بنجاح'));
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || tr('Failed to update profile', 'Echec de la mise a jour du profil', 'Failed to update profile'));
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">{tr('Loading profile...', 'Chargement du profil...', 'جاري تحميل الملف الشخصي...')}</div>;

  const initials = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase();

  const stats = [
    { label: tr('Articles Published', 'Articles publies', 'Articles Published'), value: '0' },
    { label: tr('Total Views', 'Vues totales', 'Total Views'), value: '0' },
    { label: tr('Connections', 'Connexions', 'Connections'), value: '0' },
  ];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card className="p-6 bg-card">
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
                title={tr('Upload photo', 'Televerser une photo', 'تحميل صورة')}
              >
                <Camera size={20} />
              </button>
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>{tr('Click to change photo', 'Cliquez pour changer la photo', 'انقر لتغيير الصورة')}</p>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl mb-1" style={{ color: 'var(--foreground)' }}>{formData.firstName} {formData.lastName}</h2>
                <p className="flex items-center gap-2 mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  <Briefcase size={16} />
                  {formData.specialization || tr('No specialization set', 'Aucune specialisation definie', 'No specialization set')}
                </p>
                <p className="flex items-center gap-2" style={{ color: 'var(--muted-foreground)' }}>
                  <MapPin size={16} />
                  {formData.location || tr('No location set', 'Aucun emplacement defini', 'No location set')}
                </p>
              </div>
              <Button
                onClick={() => setIsEditing(!isEditing)}
                variant={isEditing ? 'outline' : 'default'}
                className={isEditing ? '' : 'text-white'}
                style={isEditing ? {} : { backgroundColor: '#1F3A8A' }}
              >
                {isEditing ? tr('Cancel', 'Annuler', 'إلغاء') : tr('Edit Profile', 'Modifier le profil', 'تعديل الملف الشخصي')}
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {stats.map((stat, index) => (
                <div key={index} className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F3F4F6' }}>
                  <p className="text-2xl mb-1" style={{ color: '#1F3A8A' }}>{stat.value}</p>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Profile Information */}
      <Card className="p-6 bg-card">
        <h3 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>{tr('Profile Information', 'Informations du profil', 'معلومات الملف الشخصي')}</h3>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">{tr('First Name', 'Prenom', 'الاسم الأول')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: 'var(--muted-foreground)' }} />
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder={tr('Enter your first name', 'Saisissez votre prenom', 'Enter your first name')}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">{tr('Last Name', 'Nom', 'الاسم الأخير')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: 'var(--muted-foreground)' }} />
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder={tr('Enter your last name', 'Saisissez votre nom', 'Enter your last name')}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{tr('Email Address', 'Adresse email', 'Email Address')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted/50"
                />
                <p className="text-xs text-muted-foreground">{tr('Email cannot be changed here', 'L\'email ne peut pas etre modifie ici')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{tr('Phone Number', 'Numero de telephone', 'رقم الهاتف')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={tr('Enter your phone number', 'Saisissez votre numero de telephone', 'Enter your phone number')}
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="location">{tr('Location (Tunisia)', 'Localisation (Tunisie)', 'الموقع (تونس)')}</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TUNISIA_STATES.map((state) => (
                    <label
                      key={state}
                      className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground"
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
                <p className="text-xs text-muted-foreground">{tr('Select one or more governorates.', 'Selectionnez un ou plusieurs gouvernorats.', 'اختر واحد أو أكثر من الولايات.')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization">{tr('Specialization', 'Specialisation', 'التخصص')}</Label>
                <Input
                  id="specialization"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder={tr('e.g. Structural Engineering, Architecture', 'ex: Genie structurel, Architecture', 'e.g. Structural Engineering, Architecture')}
                />
              </div>

            </div>

            <div className="space-y-2">
              <Label htmlFor="institution">{tr('Institution / Organization', 'Institution / Organisation', 'Institution / Organization')}</Label>
              <Input
                id="institution"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                placeholder={tr('e.g. University of Tunis, CSTB', 'ex: Universite de Tunis, CSTB', 'e.g. University of Tunis, CSTB')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">{tr('Bio', 'Bio', 'النبذة الشخصية')}</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder={tr('Describe your expertise, research areas, and professional background...', 'Decrivez votre expertise, vos domaines de recherche et votre parcours professionnel...', 'Describe your expertise, research areas, and professional background...')}
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
              {isLoading ? tr('Saving...', 'Enregistrement...', 'جاري الحفظ...') : tr('Save Changes', 'Enregistrer les modifications', 'حفظ التغييرات')}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Full Name', 'Nom complet', 'Full Name')}</p>
                <p style={{ color: 'var(--foreground)' }}>{formData.firstName} {formData.lastName}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Email Address', 'Adresse email', 'Email Address')}</p>
                <p style={{ color: 'var(--foreground)' }}>{formData.email}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Phone Number', 'Numero de telephone', 'رقم الهاتف')}</p>
                <p style={{ color: 'var(--foreground)' }}>{formData.phone || tr('Not provided', 'Non renseigne', 'Not provided')}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Location', 'Localisation', 'الموقع')}</p>
                <p style={{ color: 'var(--foreground)' }}>{formData.location || tr('Not provided', 'Non renseigne', 'Not provided')}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Specialization', 'Specialisation', 'التخصص')}</p>
                <p style={{ color: 'var(--foreground)' }}>{formData.specialization || tr('Not provided', 'Non renseigne', 'Not provided')}</p>
              </div>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Institution / Organization', 'Institution / Organisation', 'Institution / Organization')}</p>
              <p style={{ color: 'var(--foreground)' }}>{formData.institution || tr('Not provided', 'Non renseigne', 'Not provided')}</p>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Bio', 'Bio', 'النبذة الشخصية')}</p>
              <p style={{ color: 'var(--foreground)' }}>{formData.bio || tr('No bio written yet.', 'Aucune bio redigee pour le moment.', 'No bio written yet.')}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Security Settings */}
      <Card className="p-6 bg-card">
        <h3 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>{tr('Security Settings', 'Parametres de securite', 'Security Settings')}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p style={{ color: 'var(--foreground)' }}>{tr('Change Password', 'Changer le mot de passe', 'Change Password')}</p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{tr('Update your password regularly for security', 'Mettez votre mot de passe a jour regulierement pour plus de securite', 'Update your password regularly for security')}</p>
            </div>
            <Button variant="outline">{tr('Change', 'Changer', 'Change')}</Button>
          </div>
          <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid #E5E7EB' }}>
            <div>
              <p style={{ color: 'var(--foreground)' }}>{tr('Two-Factor Authentication', 'Authentification a deux facteurs', 'Two-Factor Authentication')}</p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{tr('Add an extra layer of security', 'Ajoutez une couche de securite supplementaire', 'Add an extra layer of security')}</p>
            </div>
            <Button variant="outline">{tr('Enable', 'Activer', 'Enable')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
