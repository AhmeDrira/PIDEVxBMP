import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { Building2, Mail, Phone, MapPin, Save, CheckCircle, AlertCircle, User, Camera, Loader2 } from 'lucide-react';
import FaceIdSection from '../common/FaceIdSection';
import { Badge } from '../ui/badge';
import axios from 'axios';
import { TUNISIA_STATES } from '../../lib/tunisiaStates';
import { useLanguage } from '../../context/LanguageContext';

export default function ManufacturerProfile() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    phone: '',
    location: '',
    description: '',
    certificationNumber: '',
    verificationStatus: 'pending',
    profilePhoto: ''
  });
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  const API_URL = '/api';

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) token = JSON.parse(userStorage).token;
    return token;
  };

  const initials = [formData.firstName?.[0], formData.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'M';

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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = getToken();
        if (!token) { setLoading(false); return; }

        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const userData = response.data;
        // 2. Mettre à jour l'état avec les prénoms et noms venant du backend
        const locationValue = userData.location || '';
        const parsedStates = locationValue
          .split(',')
          .map((state: string) => state.trim())
          .filter(Boolean);

        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          companyName: userData.companyName || '',
          email: userData.email || '',
          phone: userData.phone || '',
          location: locationValue,
          description: userData.description || '',
          certificationNumber: userData.certificationNumber || '',
          verificationStatus: userData.verificationStatus || 'pending',
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
            companyName: userData.companyName || '',
            profilePhoto: userData.profilePhoto || '',
          }));
          window.dispatchEvent(new Event('storage'));
        }

        setLoading(false);
      } catch (error) {
        console.error("Erreur lors du chargement du profil:", error);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = getToken();
      if (!token) return;

      await axios.put(`${API_URL}/auth/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setIsEditing(false);
      toast.success(tr('Profile updated successfully', 'Profil mis a jour avec succes', 'تم تحديث الملف الشخصي بنجاح'));

      const userStorage = localStorage.getItem('user');
      if (userStorage) {
        const userObj = JSON.parse(userStorage);
        userObj.firstName = formData.firstName;
        userObj.lastName = formData.lastName;
        userObj.companyName = formData.companyName;
        userObj.profilePhoto = formData.profilePhoto;
        localStorage.setItem('user', JSON.stringify(userObj));
        window.dispatchEvent(new Event("storage")); 
      }

    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error(tr('Failed to save profile', 'Echec de l\'enregistrement du profil'));
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">{tr('Loading profile...', 'Chargement du profil...', 'جاري تحميل الملف الشخصي...')}</div>;

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card shadow-lg border-0 rounded-2xl">
        <div className="flex items-start justify-between mb-6 border-b pb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
              <Avatar className="w-20 h-20">
                {formData.profilePhoto ? (
                  <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="text-2xl" style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}>
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 rounded-full text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#F59E0B' }}
                title={tr('Upload photo', 'Televerser une photo', 'تحميل صورة')}
              >
                <Camera size={16} />
              </button>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">{formData.companyName || tr('Company Name', 'Nom de l\'entreprise')}</h2>
              <div className="flex items-center gap-2">
                {formData.verificationStatus === 'approved' ? (
                  <Badge className="bg-green-100 text-green-700 px-3 py-1 flex items-center gap-1">
                    <CheckCircle size={14} /> {tr('Verified Manufacturer', 'Fabricant verifie', 'Verified Manufacturer')}
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-700 px-3 py-1 flex items-center gap-1">
                    <AlertCircle size={14} /> {tr('Verification Pending', 'Verification en attente', 'Verification Pending')}
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
            {isEditing ? tr('Cancel', 'Annuler', 'إلغاء') : tr('Edit Profile', 'Modifier le profil', 'تعديل الملف الشخصي')}
          </Button>
        </div>

        {isEditing ? (
          <form className="space-y-6" onSubmit={handleSave}>
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* --- NOUVEAUX CHAMPS FIRSTNAME ET LASTNAME --- */}
              <div className="space-y-2">
                <Label className="font-semibold">{tr('First Name', 'Prenom', 'الاسم الأول')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input className="pl-10 h-12 rounded-xl border-2" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} placeholder={tr('Enter your first name', 'Saisissez votre prenom', 'Enter your first name')} required />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="font-semibold">{tr('Last Name', 'Nom', 'الاسم الأخير')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input className="pl-10 h-12 rounded-xl border-2" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} placeholder={tr('Enter your last name', 'Saisissez votre nom', 'Enter your last name')} required />
                </div>
              </div>
              {/* ------------------------------------------- */}

              <div className="space-y-2">
                <Label className="font-semibold">{tr('Company Name', 'Nom de l\'entreprise')}</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input className="pl-10 h-12 rounded-xl border-2" value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} placeholder={tr('Enter your company name', 'Saisissez le nom de votre entreprise', 'Enter your company name')} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">{tr('Email', 'Email', 'البريد الإلكتروني')} <span className="text-xs font-normal text-muted-foreground">({tr('Read-only', 'Lecture seule', 'Read-only')})</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input type="email" className="pl-10 h-12 rounded-xl border-2 bg-muted/50" value={formData.email} readOnly />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">{tr('Phone', 'Telephone', 'الهاتف')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input className="pl-10 h-12 rounded-xl border-2" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder={tr('Enter your phone number', 'Saisissez votre numero de telephone', 'Enter your phone number')} />
                </div>
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label className="font-semibold">{tr('Location (Tunisia)', 'Localisation (Tunisie)', 'الموقع (تونس)')}</Label>
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
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">{tr('Description', 'Description', 'الوصف')}</Label>
              <Textarea className="rounded-xl border-2 resize-none" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={4} placeholder={tr('Describe your manufacturing business...', 'Decrivez votre activite de fabrication...', 'Describe your manufacturing business...')} />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">{tr('Certification Number', 'Numero de certification', 'Certification Number')}</Label>
              <Input className="h-12 rounded-xl border-2" value={formData.certificationNumber} onChange={(e) => setFormData({...formData, certificationNumber: e.target.value})} placeholder="e.g. CERT-2026-XYZ" />
            </div>

            {/* BOUTON CORRIGÉ : Utilise variant="default" pour forcer l'affichage de la couleur primaire */}
            <div className="pt-4">
              <Button type="submit" disabled={isLoading} variant="default" className="h-12 px-8 rounded-xl w-full md:w-auto">
                {isLoading ? <Loader2 size={20} className="mr-2 animate-spin" /> : <Save size={20} className="mr-2" />}
                {isLoading ? tr('Saving...', 'Enregistrement...', 'جاري الحفظ...') : tr('Save Changes', 'Enregistrer les modifications', 'حفظ التغييرات')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              
              {/* --- NOUVEAU CHAMP VIEW POUR FIRST/LAST NAME --- */}
              <div className="bg-muted/50 p-4 rounded-xl">
                <p className="text-sm mb-1 text-muted-foreground flex items-center gap-2"><User size={16}/> {tr('Contact Person', 'Personne de contact', 'Contact Person')}</p>
                <p className="font-semibold text-foreground">{formData.firstName} {formData.lastName}</p>
              </div>
              {/* --------------------------------------------- */}

              <div className="bg-muted/50 p-4 rounded-xl">
                <p className="text-sm mb-1 text-muted-foreground flex items-center gap-2"><Mail size={16}/> Email</p>
                <p className="font-semibold text-foreground">{formData.email}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl">
                <p className="text-sm mb-1 text-muted-foreground flex items-center gap-2"><Phone size={16}/> Phone</p>
                <p className="font-semibold text-foreground">{formData.phone}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl">
                <p className="text-sm mb-1 text-muted-foreground flex items-center gap-2"><MapPin size={16}/> Location</p>
                <p className="font-semibold text-foreground">{formData.location || tr('Not provided', 'Non renseigne', 'Not provided')}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl md:col-span-2">
                <p className="text-sm mb-1 text-muted-foreground flex items-center gap-2"><Building2 size={16}/> {tr('Certification Number', 'Numero de certification', 'Certification Number')}</p>
                <p className="font-semibold text-foreground">{formData.certificationNumber || tr('Not provided', 'Non renseigne', 'Not provided')}</p>
              </div>
            </div>

            <div>
              <p className="text-sm mb-2 text-muted-foreground font-medium">{tr('Company Description', 'Description de l\'entreprise')}</p>
              <div className="bg-muted/50 p-6 rounded-xl text-foreground leading-relaxed whitespace-pre-wrap">
                {formData.description || tr('No description provided yet.', 'Aucune description fournie pour le moment.', 'No description provided yet.')}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Face Recognition */}
      <FaceIdSection />
    </div>
  );
}