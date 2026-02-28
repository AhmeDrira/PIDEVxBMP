import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Search, Filter, MapPin, Calendar, DollarSign, Eye, Edit, ShoppingCart, FileText, Receipt, ArrowRight, FolderKanban } from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';

// Composant d'autocomplétion pour la localisation
const LocationInput = ({ value, onChange, onSelect, error, onBlur  }: { 
  value: string; 
  onChange: (value: string) => void; 
  onSelect: (location: string) => void;
  error?: string;
  onBlur?: () => void;
}) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=tn&limit=5`
      );
      setSuggestions(response.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des suggestions', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value) fetchSuggestions(value);
    }, 500);
    return () => clearTimeout(timer);
  }, [value]);

  const handleSelect = (suggestion: any) => {
    const displayName = suggestion.display_name;
    onChange(displayName);
    onSelect(displayName);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={(e) => {
          onBlur?.();         // <-- appel de la fonction parent
          setTimeout(() => setShowSuggestions(false), 200);
        }}
        placeholder="Entrez une ville ou un lieu en Tunisie"
        className={`h-12 rounded-xl border-2 focus:border-primary ${error ? 'border-red-500' : 'border-gray-200'}`}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.place_id}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleSelect(suggestion)}
            >
              {suggestion.display_name}
            </li>
          ))}
        </ul>
      )}
      {loading && <div className="absolute right-3 top-3 text-sm text-gray-400">Chargement...</div>}
    </div>
  );
};

export default function ArtisanProjects() {
  // Vues
  const [view, setView] = useState<'list' | 'create' | 'details' | 'edit'>('list');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Données
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // État du formulaire (partagé entre création et édition)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    budget: '',
    startDate: '',
    endDate: '',
    progress: 0,
  });

  // État pour savoir si une localisation valide a été sélectionnée
  const [locationSelected, setLocationSelected] = useState(false);

  // État pour les erreurs de validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // --- Récupération du token ---
  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) {
      token = JSON.parse(userStorage).token;
    }
    return token;
  };

  // --- Chargement des projets ---
  useEffect(() => {
    const fetchProjects = async () => {
      if (view !== 'list') return;
      try {
        setIsLoading(true);
        const token = getToken();
        if (!token) return;

        const response = await axios.get(`${API_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProjects(response.data);
      } catch (error) {
        console.error('Erreur lors du chargement des projets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [view, API_URL]);

  // --- Pré-remplissage du formulaire d'édition ---
  useEffect(() => {
    if (view === 'edit' && selectedProject) {
      setFormData({
        title: selectedProject.title,
        description: selectedProject.description,
        location: selectedProject.location,
        budget: selectedProject.budget,
        startDate: selectedProject.startDate?.substring(0, 10),
        endDate: selectedProject.endDate?.substring(0, 10),
        progress: selectedProject.progress || 0,
      });
      setLocationSelected(true); // La localisation existante est considérée valide
    }
  }, [view, selectedProject]);

  // --- Réinitialisation du formulaire quand on passe en création ---
  const handleCreateView = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      budget: '',
      startDate: '',
      endDate: '',
      progress: 0,
    });
    setLocationSelected(false);
    setErrors({});
    setTouched({});
    setView('create');
  };

  // --- Validation d'un champ ---
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'title':
        return !value ? 'Le titre est obligatoire' : '';
      case 'description':
        if (!value) return 'La description est obligatoire';
        if (value.length < 10) return 'La description doit contenir au moins 10 caractères';
        return '';
      case 'location':
        return !value ? 'La localisation est obligatoire' : '';
      case 'budget':
        if (!value) return 'Le budget est obligatoire';
        if (isNaN(Number(value)) || Number(value) <= 0) return 'Le budget doit être un nombre positif';
        return '';
      case 'startDate':
        return !value ? 'La date de début est obligatoire' : '';
      case 'endDate':
        if (!value) return 'La date de fin est obligatoire';
        if (formData.startDate && new Date(value) <= new Date(formData.startDate)) {
          return 'La date de fin doit être postérieure à la date de début';
        }
        return '';
      default:
        return '';
    }
  };

  // --- Validation globale du formulaire ---
  const validateForm = (): boolean => {
  const fieldsToValidate = ['title', 'description', 'location', 'budget', 'startDate', 'endDate'];
  for (const field of fieldsToValidate) {
    const error = validateField(field, formData[field as keyof typeof formData]);
    if (error) return false;
  }
  return locationSelected;
};

  // --- Gestion du blur pour marquer un champ comme touché ---
  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof typeof formData]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  // --- Soumission création ---
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const token = getToken();
      await axios.post(`${API_URL}/projects`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFormData({ title: '', description: '', location: '', budget: '', startDate: '', endDate: '', progress: 0 });
      setLocationSelected(false);
      setView('list');
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      alert('Erreur lors de la création du projet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Soumission modification ---
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const token = getToken();
      const response = await axios.put(
        `${API_URL}/projects/${selectedProject._id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedProject(response.data);
      setProjects((prev) => prev.map((p) => (p._id === response.data._id ? response.data : p)));
      setView('details');
    } catch (error) {
      console.error('Erreur update:', error);
      alert('Erreur lors de la modification.');
    }
  };

  // --- Utilitaires d'affichage ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-accent/10 text-accent border-accent/20';
      case 'pending':
        return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'completed':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Vue Création ---
  if (view === 'create') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setView('list')} className="mb-6 rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Retour aux projets
        </Button>
        <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">Créer un nouveau projet</h2>
          <form className="space-y-6" onSubmit={handleCreateProject}>
            {/* Titre */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-semibold">
                Titre du projet <span style={{ color: 'red' }}>*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value });
                  if (touched.title) setErrors((prev) => ({ ...prev, title: validateField('title', e.target.value) }));
                }}
                onBlur={() => handleBlur('title')}
                placeholder="Entrez le titre du projet"
                className={`h-12 rounded-xl border-2 focus:border-primary ${touched.title && errors.title ? 'border-red-500' : 'border-gray-200'}`}
              />
              {touched.title && errors.title && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.title}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">
                Description <span style={{ color: 'red' }}>*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (touched.description) setErrors((prev) => ({ ...prev, description: validateField('description', e.target.value) }));
                }}
                onBlur={() => handleBlur('description')}
                placeholder="Décrivez votre projet (minimum 10 caractères)"
                rows={4}
                className={`rounded-xl border-2 focus:border-primary ${touched.description && errors.description ? 'border-red-500' : 'border-gray-200'}`}
              />
              {touched.description && errors.description && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.description}</p>}
            </div>

            {/* Localisation avec autocomplétion */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-semibold">
                Localisation (please select from the suggestions) <span style={{ color: 'red' }}>*</span>
              </Label>
              <LocationInput
                value={formData.location}
                onChange={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(false);
                  if (touched.location) {
                    setErrors((prev) => ({ ...prev, location: '' }));
                  }
                }}
                onSelect={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(true);
                  if (touched.location) setErrors((prev) => ({ ...prev, location: '' }));
                }}
                onBlur={() => handleBlur('location')}
                error={touched.location && errors.location ? errors.location : undefined}
              />
              {touched.location && (
                <>
                  {errors.location && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.location}</p>}
                  {!locationSelected && formData.location && !errors.location && (
                    <p style={{ color: 'red' }}>Veuillez sélectionner une localisation valide dans la liste</p>
                  )}
                </>
              )}
            </div>

            {/* Budget seul */}
            <div className="space-y-2">
              <Label htmlFor="budget" className="text-base font-semibold">
                Budget estimé (TND) <span style={{ color: 'red' }}>*</span>
              </Label>
              <Input
                id="budget"
                type="number"
                value={formData.budget}
                onChange={(e) => {
                  setFormData({ ...formData, budget: e.target.value });
                  if (touched.budget) setErrors((prev) => ({ ...prev, budget: validateField('budget', e.target.value) }));
                }}
                onBlur={() => handleBlur('budget')}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={`h-12 rounded-xl border-2 focus:border-primary ${touched.budget && errors.budget ? 'border-red-500' : 'border-gray-200'}`}
              />
              {touched.budget && errors.budget && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.budget}</p>}
            </div>

            {/* Dates côte à côte */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Date de début */}
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-base font-semibold">
                  Date de début <span style={{ color: 'red' }}>*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    setFormData({ ...formData, startDate: e.target.value });
                    if (touched.startDate) setErrors((prev) => ({ ...prev, startDate: validateField('startDate', e.target.value) }));
                    // Revalider endDate si elle existe
                    if (formData.endDate) {
                      const endError = validateField('endDate', formData.endDate);
                      setErrors((prev) => ({ ...prev, endDate: endError }));
                    }
                  }}
                  onBlur={() => handleBlur('startDate')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.startDate && errors.startDate ? 'border-red-500' : 'border-gray-200'}`}
                />
                {touched.startDate && errors.startDate && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.startDate}</p>}
              </div>

              {/* Date de fin */}
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-base font-semibold">
                  Date de fin <span style={{ color: 'red' }}>*</span>
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => {
                    setFormData({ ...formData, endDate: e.target.value });
                    if (touched.endDate) setErrors((prev) => ({ ...prev, endDate: validateField('endDate', e.target.value) }));
                  }}
                  onBlur={() => handleBlur('endDate')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.endDate && errors.endDate ? 'border-red-500' : 'border-gray-200'}`}
                />
                {touched.endDate && errors.endDate && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.endDate}</p>}
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !validateForm()}
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Création...' : 'Créer le projet'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setView('list')} className="h-12 px-8 rounded-xl border-2">
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // --- Vue Édition ---
  if (view === 'edit' && selectedProject) {
    return (
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setView('details')} className="mb-6 rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Retour au projet
        </Button>
        <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">Modifier le projet</h2>
          <form className="space-y-6" onSubmit={handleUpdateProject}>
            {/* Titre */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-semibold">
                Titre du projet <span style={{ color: 'red' }}>*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value });
                  if (touched.title) setErrors((prev) => ({ ...prev, title: validateField('title', e.target.value) }));
                }}
                onBlur={() => handleBlur('title')}
                placeholder="Entrez le titre du projet"
                className={`h-12 rounded-xl border-2 focus:border-primary ${touched.title && errors.title ? 'border-red-500' : 'border-gray-200'}`}
              />
              {touched.title && errors.title && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.title}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">
                Description <span style={{ color: 'red' }}>*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (touched.description) setErrors((prev) => ({ ...prev, description: validateField('description', e.target.value) }));
                }}
                onBlur={() => handleBlur('description')}
                placeholder="Décrivez votre projet (minimum 10 caractères)"
                rows={4}
                className={`rounded-xl border-2 focus:border-primary ${touched.description && errors.description ? 'border-red-500' : 'border-gray-200'}`}
              />
              {touched.description && errors.description && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.description}</p>}
            </div>

            {/* Localisation avec autocomplétion */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-semibold">
                Localisation (please select from the suggestions) <span style={{ color: 'red' }}>*</span>
              </Label>
              <LocationInput
                value={formData.location}
                onChange={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(false);
                  if (touched.location) {
                    setErrors((prev) => ({ ...prev, location: '' }));
                  }
                }}
                onSelect={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(true);
                  if (touched.location) setErrors((prev) => ({ ...prev, location: '' }));
                }}
                onBlur={() => handleBlur('location')}
                error={touched.location && errors.location ? errors.location : undefined}
              />
              {touched.location && (
                <>
                  {errors.location && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.location}</p>}
                  {!locationSelected && formData.location && !errors.location && (
                    <p style={{ color: 'red', fontSize: '0.875rem' }}>Veuillez sélectionner une localisation valide dans la liste</p>
                  )}
                </>
              )}
            </div>

            {/* Grille budget / dates / progression */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Budget */}
              <div className="space-y-2">
                <Label htmlFor="budget" className="text-base font-semibold">
                  Budget estimé (TND) <span style={{ color: 'red' }}>*</span>
                </Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) => {
                    setFormData({ ...formData, budget: e.target.value });
                    if (touched.budget) setErrors((prev) => ({ ...prev, budget: validateField('budget', e.target.value) }));
                  }}
                  onBlur={() => handleBlur('budget')}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.budget && errors.budget ? 'border-red-500' : 'border-gray-200'}`}
                />
                {touched.budget && errors.budget && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.budget}</p>}
              </div>

              {/* Progression */}
              <div className="space-y-2">
                <Label htmlFor="progress" className="text-base font-semibold">
                  Progression (%)
                </Label>
                <Input
                  id="progress"
                  type="number"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                  placeholder="0 - 100"
                  min={0}
                  max={100}
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                />
              </div>
            </div>

            {/* Grille budget / dates / progression */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Date de début */}
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-base font-semibold">
                  Date de début <span style={{ color: 'red' }}>*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    setFormData({ ...formData, startDate: e.target.value });
                    if (touched.startDate) setErrors((prev) => ({ ...prev, startDate: validateField('startDate', e.target.value) }));
                    if (formData.endDate) {
                      const endError = validateField('endDate', formData.endDate);
                      setErrors((prev) => ({ ...prev, endDate: endError }));
                    }
                  }}
                  onBlur={() => handleBlur('startDate')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.startDate && errors.startDate ? 'border-red-500' : 'border-gray-200'}`}
                />
                {touched.startDate && errors.startDate && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.startDate}</p>}
              </div>


              {/* Date de fin */}
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-base font-semibold">
                  Date de fin <span style={{ color: 'red' }}>*</span>
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => {
                    setFormData({ ...formData, endDate: e.target.value });
                    if (touched.endDate) setErrors((prev) => ({ ...prev, endDate: validateField('endDate', e.target.value) }));
                  }}
                  onBlur={() => handleBlur('endDate')}
                  className={`h-12 rounded-xl border-2 focus:border-primary ${touched.endDate && errors.endDate ? 'border-red-500' : 'border-gray-200'}`}
                />
                {touched.endDate && errors.endDate && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.endDate}</p>}
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4 justify-center">
              <Button
                type="submit"
                disabled={!validateForm()}
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enregistrer les modifications
              </Button>
              <Button type="button" variant="outline" onClick={() => setView('list')} className="h-12 px-8 rounded-xl border-2">
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // VUE 3 : DÉTAILS
  // =========================================================================
  if (view === 'details' && selectedProject) {
    const status = selectedProject.status || 'active';
    const priority = selectedProject.priority || 'medium';

    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Projects
        </Button>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-foreground mb-3">{selectedProject.title}</h2>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusColor(status)} px-4 py-1.5 text-sm font-semibold border-2`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                    <Badge className={`${getPriorityColor(priority)} px-4 py-1.5 text-sm font-semibold border-2`}>
                      {priority}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl border-2"
                  onClick={() => setView('edit')}
                >
                  <Edit size={16} className="mr-2" /> Edit
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-foreground mb-3">Description</h4>
                  <p className="text-muted-foreground leading-relaxed">{selectedProject.description}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 pt-6 border-t-2 border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><MapPin size={24} className="text-primary" /></div>
                    <div><p className="text-sm text-muted-foreground font-medium">Location</p><p className="text-foreground font-semibold">{selectedProject.location}</p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center"><DollarSign size={24} className="text-accent" /></div>
                    <div><p className="text-sm text-muted-foreground font-medium">Budget</p><p className="text-foreground font-semibold">{selectedProject.budget?.toLocaleString() || 0} TND</p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center"><Calendar size={24} className="text-secondary" /></div>
                    <div><p className="text-sm text-muted-foreground font-medium">Start Date</p><p className="text-foreground font-semibold">{formatDate(selectedProject.startDate)}</p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center"><Calendar size={24} className="text-destructive" /></div>
                    <div><p className="text-sm text-muted-foreground font-medium">End Date</p><p className="text-foreground font-semibold">{formatDate(selectedProject.endDate)}</p></div>
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-foreground">Project Progress</h4>
                    <span className="text-4xl font-bold text-primary">{selectedProject.progress || 0}%</span>
                  </div>
                  <div className="h-4 rounded-full overflow-hidden bg-gray-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${selectedProject.progress || 0}%` }} />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
              <h3 className="text-xl font-bold text-foreground mb-6">Quick Actions</h3>
              <div className="space-y-3">
                <Button className="w-full h-12 justify-start text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-md"><ShoppingCart size={18} className="mr-2" /> Buy Materials</Button>
                <Button className="w-full h-12 justify-start text-white bg-accent hover:bg-accent/90 rounded-xl shadow-md"><FileText size={18} className="mr-2" /> Create Quote</Button>
                <Button className="w-full h-12 justify-start text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md"><Receipt size={18} className="mr-2" /> Generate Invoice</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VUE 4 : LISTE PRINCIPALE (Par défaut)
  // =========================================================================
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">My Projects</h1>
          <p className="text-lg text-muted-foreground">Manage and track all your construction projects</p>
        </div>
        <Button onClick={() => setView('create')} className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
          <Plus size={20} className="mr-2" /> Create Project
        </Button>
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary" />
          </div>
          <Button variant="outline" className="h-12 px-6 rounded-xl border-2">
            <Filter size={20} className="mr-2" /> Filter
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading your projects...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl shadow-lg border border-gray-100">
          <FolderKanban className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-xl font-semibold text-gray-500">No projects found.</p>
          <p className="text-gray-400 mt-2">Click "Create Project" to get started!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredProjects.map((project) => {
            const status = project.status || 'active';
            const priority = project.priority || 'medium';
            
            return (
              <Card key={project._id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-3">{project.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(status)} px-3 py-1 text-xs font-semibold border-2`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                      <Badge className={`${getPriorityColor(priority)} px-3 py-1 text-xs font-semibold border-2`}>
                        {priority}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6 leading-relaxed line-clamp-2">
                  {project.description}
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <MapPin size={16} className="text-primary" /> {project.location}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <DollarSign size={16} className="text-accent" /> 
                    Budget: <strong className="text-foreground">{project.budget?.toLocaleString() || 0} TND</strong>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Calendar size={16} className="text-secondary" />
                    {formatDate(project.startDate)} - {formatDate(project.endDate)}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Progress</span>
                    <span className="text-2xl font-bold text-primary">{project.progress || 0}%</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden bg-gray-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${project.progress || 0}%` }} />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-2 hover:bg-primary hover:text-white hover:border-primary"
                    onClick={() => { setSelectedProject(project); setView('details'); }}
                  >
                    <Eye size={16} className="mr-2" /> View
                  </Button>
                  <Button
  variant="outline"
  className="h-11 px-4 rounded-xl border-2 hover:bg-primary hover:text-white hover:border-primary"
  onClick={() => {
    setSelectedProject(project); // ⚡ définir le projet à éditer
    setView('edit');             // puis passer en edit
  }}
>
  <Edit size={16} />
</Button>
                  
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}