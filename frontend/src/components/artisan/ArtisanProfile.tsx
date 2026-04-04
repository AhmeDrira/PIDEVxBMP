import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { User, Mail, Phone, MapPin, Briefcase, Save, Camera, Loader2, Plus, X, Award } from 'lucide-react';
import FaceIdSection from '../common/FaceIdSection';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { TUNISIA_STATES } from '../../lib/tunisiaStates';
import { useLanguage } from '../../context/LanguageContext';

const SPECIALIZATIONS = [
  'Masonry',
  'Concrete Work',
  'Foundation Construction',
  'Plumbing',
  'Electrical Installation',
  'Carpentry',
  'Painting',
  'Tiling',
  'Plastering',
  'Roofing',
  'Waterproofing',
  'HVAC',
  'Metal Work',
  'Aluminum Work',
];

export default function ArtisanProfile() {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) => (language === 'ar' ? ar : language === 'fr' ? fr : en);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const API_URL = '/api';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    domain: '',
    yearsExperience: '',
    profilePhoto: '',
  });
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [newCertification, setNewCertification] = useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast.error(tr('Image must be less than 5MB', 'L\'image doit etre inferieure a 5MB')); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        const newPhoto = reader.result as string;
        setFormData(prev => ({ ...prev, profilePhoto: newPhoto }));
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

  const getToken = () => {
    const direct = localStorage.getItem('token');
    if (direct) return direct;
    try { return JSON.parse(localStorage.getItem('user') || '{}').token || null; } catch { return null; }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = getToken();
        if (!token) { setLoading(false); return; }

        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const userData = response.data.user ?? response.data;

        const locationValue = userData.location || '';
        const parsedStates = locationValue.split(',').map((s: string) => s.trim()).filter(Boolean);

        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          phone: userData.phone || '',
          location: locationValue,
          bio: userData.bio || '',
          domain: userData.domain || '',
          yearsExperience: userData.yearsExperience?.toString() || '',
          profilePhoto: userData.profilePhoto || '',
        });
        setSelectedStates(parsedStates);
        setSkills(Array.isArray(userData.skills) ? userData.skills : []);
        setCertifications(Array.isArray(userData.certifications) ? userData.certifications : []);

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
      } catch (error: any) {
        console.error('Profile load error:', error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    setFormData(prev => ({ ...prev, location: selectedStates.join(', ') }));
  }, [selectedStates]);

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills(prev => [...prev, trimmed]);
      setNewSkill('');
    }
  };

  const handleAddCertification = () => {
    const trimmed = newCertification.trim();
    if (trimmed && !certifications.includes(trimmed)) {
      setCertifications(prev => [...prev, trimmed]);
      setNewCertification('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = getToken();
      if (!token) { toast.error(tr('Security error: Unable to find token.', 'Erreur de securite : token introuvable.', 'خطأ أمان: لا يمكن العثور على الرمز.')); return; }

      await axios.put(
        `${API_URL}/auth/profile`,
        { ...formData, yearsExperience: Number(formData.yearsExperience) || 0, skills, certifications },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsEditing(false);
      toast.success(tr('Profile updated successfully', 'Profil mis a jour avec succes', 'تم تحديث الملف الشخصي بنجاح'));

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
      console.error('Save error:', error);
      toast.error(tr('Failed to save profile', 'Echec de l\'enregistrement du profil'));
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">{tr('Loading profile...', 'Chargement du profil...', 'جاري تحميل الملف الشخصي...')}</div>;

  const fullName = `${formData.firstName} ${formData.lastName}`;
  const initials = `${formData.firstName?.charAt(0) || ''}${formData.lastName?.charAt(0) || ''}`.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card className="p-6 bg-card">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
              <Avatar className="w-32 h-32">
                {formData.profilePhoto ? (
                  <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="text-4xl" style={{ backgroundColor: '#1F3A8A', color: '#FFFFFF' }}>
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#F59E0B' }}
              >
                <Camera size={20} />
              </button>
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>Click to change photo</p>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl mb-1" style={{ color: 'var(--foreground)' }}>{fullName}</h2>
                <p className="flex items-center gap-2 mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  <Briefcase size={16} /> {formData.domain || '—'}
                </p>
                <p className="flex items-center gap-2" style={{ color: 'var(--muted-foreground)' }}>
                  <MapPin size={16} /> {formData.location || '—'}
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
          </div>
        </div>
      </Card>

      {/* Profile Information */}
      <Card className="p-6 bg-card">
        <h3 className="text-xl mb-6" style={{ color: 'var(--foreground)' }}>{tr('Profile Information', 'Informations du profil', 'معلومات الملف الشخصي')}</h3>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="firstName">{tr('First Name', 'Prenom', 'الاسم الأول')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: 'var(--muted-foreground)' }} />
                  <Input id="firstName" placeholder={tr('First name', 'Prenom', 'الاسم الأول')} value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="pl-10" />
                </div>
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <Label htmlFor="lastName">{tr('Last Name', 'Nom', 'الاسم الأخير')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: 'var(--muted-foreground)' }} />
                  <Input id="lastName" placeholder={tr('Last name', 'Nom', 'الاسم الأخير')} value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="pl-10" />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">{tr('Phone Number', 'Numero de telephone', 'رقم الهاتف')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: 'var(--muted-foreground)' }} />
                  <Input id="phone" placeholder="+216 XX XXX XXX" value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} className="pl-10" />
                </div>
              </div>

              {/* Years of Experience */}
              <div className="space-y-2">
                <Label htmlFor="yearsExperience">{tr('Years of Experience', 'Annees d\'experience')}</Label>
                <Input id="yearsExperience" type="number" min="0" placeholder="0" value={formData.yearsExperience}
                  onChange={e => setFormData({ ...formData, yearsExperience: e.target.value })} />
              </div>

              {/* Specialization dropdown */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="domain">{tr('Specialization', 'Specialisation', 'التخصص')}</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" size={18} style={{ color: 'var(--muted-foreground)' }} />
                  <select
                    id="domain"
                    value={formData.domain}
                    onChange={e => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary bg-card"
                  >
                    <option value="">{tr('Select a specialization...', 'Selectionnez une specialisation...', 'اختر التخصص...')}</option>
                    {SPECIALIZATIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location (Tunisia checkboxes) */}
              <div className="space-y-3 md:col-span-2">
                <Label>{tr('Location (Tunisia)', 'Localisation (Tunisie)', 'الموقع (تونس)')}</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TUNISIA_STATES.map(state => (
                    <label key={state} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground cursor-pointer">
                      <Checkbox
                        checked={selectedStates.includes(state)}
                        onCheckedChange={checked => {
                          setSelectedStates(prev => checked ? [...prev, state] : prev.filter(s => s !== state));
                        }}
                      />
                      <span>{state}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{tr('Select one or more governorates.', 'Selectionnez un ou plusieurs gouvernorats.', 'اختر واحد أو أكثر من الولايات.')}</p>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">{tr('Bio', 'Bio', 'النبذة الشخصية')}</Label>
              <Textarea id="bio" placeholder={tr('Tell us about yourself, your skills and experience...', 'Parlez de vous, de vos competences et de votre experience...', 'أخبرنا عنك ومهاراتك وخبرتك...')} value={formData.bio}
                onChange={e => setFormData({ ...formData, bio: e.target.value })} rows={4} />
            </div>

            {/* Skills */}
            <div className="space-y-3">
              <Label>{tr('Skills & Expertise', 'Competences et expertise', 'المهارات والخبرة')}</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {skills.map((skill, idx) => (
                  <span key={idx} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                    {skill}
                    <button type="button" onClick={() => setSkills(prev => prev.filter((_, i) => i !== idx))} className="ml-1 hover:text-red-500">
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={tr('Add a skill (e.g. Brickwork)...', 'Ajouter une competence (ex: maconnerie)...', 'أضف مهارة (مثل البناء بالطوب)...')}
                  value={newSkill}
                  onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={handleAddSkill} className="rounded-xl">
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            {/* Certifications */}
            <div className="space-y-3">
              <Label>{tr('Certifications', 'Certifications', 'الشهادات')}</Label>
              <div className="flex flex-col gap-2 mb-2">
                {certifications.map((cert, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-accent/5 border border-border">
                    <Award size={16} className="text-accent flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-foreground">{cert}</span>
                    <button type="button" onClick={() => setCertifications(prev => prev.filter((_, i) => i !== idx))} className="hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={tr('Add a certification (e.g. OSHA Safety Certified)...', 'Ajouter une certification (ex: certifie securite)...', 'أضف شهادة (مثل معتمد السلامة)...')}
                  value={newCertification}
                  onChange={e => setNewCertification(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCertification(); } }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={handleAddCertification} className="rounded-xl">
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="text-white" style={{ backgroundColor: '#10B981' }}>
              {isLoading ? <Loader2 size={20} className="mr-2 animate-spin" /> : <Save size={20} className="mr-2" />}
              {isLoading ? tr('Saving...', 'Enregistrement...', 'جاري الحفظ...') : tr('Save Changes', 'Enregistrer les modifications', 'حفظ التغييرات')}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Full Name', 'Nom complet', 'Full Name')}</p>
                <p style={{ color: 'var(--foreground)' }}>{fullName}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Email Address', 'Adresse email', 'Email Address')}</p>
                <p style={{ color: 'var(--foreground)' }}>{formData.email} <span className="text-xs bg-muted px-2 py-1 rounded ml-2">({tr('Read-only', 'Lecture seule', 'Read-only')})</span></p>
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
                <p style={{ color: 'var(--foreground)' }}>{formData.domain || tr('Not provided', 'Non renseigne', 'Not provided')}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Experience', 'Experience', 'Experience')}</p>
                <p style={{ color: 'var(--foreground)' }}>{formData.yearsExperience ? `${formData.yearsExperience} ${tr('years', 'ans', 'years')}` : tr('Not provided', 'Non renseigne', 'Not provided')}</p>
              </div>
            </div>

            <div>
              <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{tr('Bio', 'Bio', 'النبذة الشخصية')}</p>
              <p style={{ color: 'var(--foreground)' }}>{formData.bio || tr('No bio written yet.', 'Aucune bio pour le moment.', 'No bio written yet.')}</p>
            </div>

            {skills.length > 0 && (
              <div>
                <p className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>{tr('Skills & Expertise', 'Competences et expertise', 'المهارات والخبرة')}</p>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, idx) => (
                    <Badge key={idx} className="bg-primary/10 text-primary border-0 px-3 py-1 text-sm">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}

            {certifications.length > 0 && (
              <div>
                <p className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>{tr('Certifications', 'Certifications', 'الشهادات')}</p>
                <div className="space-y-2">
                  {certifications.map((cert, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-accent/5">
                      <Award size={16} className="text-accent" />
                      <span className="text-sm font-medium text-foreground">{cert}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{tr('Update your password regularly for security', 'Mettez a jour votre mot de passe regulierement pour plus de securite', 'Update your password regularly for security')}</p>
            </div>
            <Button variant="outline">{tr('Change', 'Modifier', 'Change')}</Button>
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

      {/* Face Recognition */}
      <FaceIdSection />
    </div>
  );
}
