import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { User, Mail, Phone, MapPin, Briefcase, Save, Camera, Loader2, Plus, X, Award } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { TUNISIA_STATES } from '../../lib/tunisiaStates';

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
      if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
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
      if (!token) { toast.error('Security error: Unable to find token.'); return; }

      await axios.put(
        `${API_URL}/auth/profile`,
        { ...formData, yearsExperience: Number(formData.yearsExperience) || 0, skills, certifications },
        { headers: { Authorization: `Bearer ${token}` } }
      );

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
      console.error('Save error:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;

  const fullName = `${formData.firstName} ${formData.lastName}`;
  const initials = `${formData.firstName?.charAt(0) || ''}${formData.lastName?.charAt(0) || ''}`.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card className="p-6 bg-white">
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
            <p className="text-sm mt-2" style={{ color: '#6B7280' }}>Click to change photo</p>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl mb-1" style={{ color: '#111827' }}>{fullName}</h2>
                <p className="flex items-center gap-2 mb-1" style={{ color: '#6B7280' }}>
                  <Briefcase size={16} /> {formData.domain || '—'}
                </p>
                <p className="flex items-center gap-2" style={{ color: '#6B7280' }}>
                  <MapPin size={16} /> {formData.location || '—'}
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
              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
                  <Input id="firstName" placeholder="First name" value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="pl-10" />
                </div>
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
                  <Input id="lastName" placeholder="Last name" value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="pl-10" />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
                  <Input id="phone" placeholder="+216 XX XXX XXX" value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} className="pl-10" />
                </div>
              </div>

              {/* Years of Experience */}
              <div className="space-y-2">
                <Label htmlFor="yearsExperience">Years of Experience</Label>
                <Input id="yearsExperience" type="number" min="0" placeholder="0" value={formData.yearsExperience}
                  onChange={e => setFormData({ ...formData, yearsExperience: e.target.value })} />
              </div>

              {/* Specialization dropdown */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="domain">Specialization</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" size={18} style={{ color: '#6B7280' }} />
                  <select
                    id="domain"
                    value={formData.domain}
                    onChange={e => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary bg-white"
                  >
                    <option value="">Select a specialization…</option>
                    {SPECIALIZATIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location (Tunisia checkboxes) */}
              <div className="space-y-3 md:col-span-2">
                <Label>Location (Tunisia)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TUNISIA_STATES.map(state => (
                    <label key={state} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-foreground cursor-pointer">
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
                <p className="text-xs text-muted-foreground">Select one or more governorates.</p>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" placeholder="Tell us about yourself, your skills and experience..." value={formData.bio}
                onChange={e => setFormData({ ...formData, bio: e.target.value })} rows={4} />
            </div>

            {/* Skills */}
            <div className="space-y-3">
              <Label>Skills & Expertise</Label>
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
                  placeholder="Add a skill (e.g. Brickwork)..."
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
              <Label>Certifications</Label>
              <div className="flex flex-col gap-2 mb-2">
                {certifications.map((cert, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-accent/5 border border-gray-100">
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
                  placeholder="Add a certification (e.g. OSHA Safety Certified)..."
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

            {skills.length > 0 && (
              <div>
                <p className="text-sm mb-2" style={{ color: '#6B7280' }}>Skills & Expertise</p>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, idx) => (
                    <Badge key={idx} className="bg-primary/10 text-primary border-0 px-3 py-1 text-sm">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}

            {certifications.length > 0 && (
              <div>
                <p className="text-sm mb-2" style={{ color: '#6B7280' }}>Certifications</p>
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
