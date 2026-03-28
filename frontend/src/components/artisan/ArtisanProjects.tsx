import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Search, Filter, MapPin, Calendar, DollarSign, Eye, Edit, ShoppingCart, FileText, Receipt, ArrowRight, FolderKanban } from 'lucide-react';
import { Badge } from '../ui/badge';
import axios from 'axios';
import { toast } from 'sonner';
import { useSubscriptionGuard } from './SubscriptionGuard';

// Composant d'autocomplétion pour la localisation
const LocationInput = ({ value, onChange, onSelect, error, onBlur, allowedStates = []  }: {
  value: string; 
  onChange: (value: string) => void; 
  onSelect: (location: string) => void;
  error?: string;
  onBlur?: () => void;
  allowedStates?: string[];
}) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const isSuggestionInAllowedStates = (displayName: string) => {
    if (!allowedStates.length) return false;

    const normalizedDisplayName = normalizeText(displayName);
    return allowedStates.some((state) => normalizedDisplayName.includes(normalizeText(state)));
  };

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=tn&addressdetails=1&limit=10`
      );

      const filteredSuggestions = response.data.filter((item: any) =>
        isSuggestionInAllowedStates(item.display_name || '')
      );

      setSuggestions(filteredSuggestions.slice(0, 6));
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
  }, [value, allowedStates.join(',')]);

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
        onBlur={() => {
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
      {showSuggestions && !loading && value.length >= 3 && suggestions.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-muted-foreground">
          Aucune ville trouvee pour vos gouvernorats de profil.
        </div>
      )}
      {loading && <div className="absolute right-3 top-3 text-sm text-gray-400">Chargement...</div>}
    </div>
  );
};

export default function ArtisanProjects() {
  // Vues
  const [view, setView] = useState<'list' | 'create' | 'details' | 'edit' | 'materials'>('list');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  // Données
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { guard, PopupElement } = useSubscriptionGuard();

  // --- Quantités locales pour la vue matériaux (avant confirmation) ---
  const [localQuantities, setLocalQuantities] = useState<Record<string, number>>({});
  const [confirmingMaterialId, setConfirmingMaterialId] = useState<string | null>(null);

  // --- Redirection depuis marketplace (viewMaterials param) ---
  const [pendingViewMaterialsId, setPendingViewMaterialsId] = useState<string | null>(null);

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
  const [artisanProfileLocation, setArtisanProfileLocation] = useState('');

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [addingToPortfolio, setAddingToPortfolio] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const fetchProjects = async () => {
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
    if (view !== 'list') return;
    fetchProjects();
  }, [view, API_URL]);

  // --- Lecture du param viewMaterials (depuis la marketplace) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vmId = params.get('viewMaterials');
    if (vmId) {
      setPendingViewMaterialsId(vmId);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // --- Quand les projets chargent + pendingViewMaterialsId défini → aller à la vue matériaux ---
  useEffect(() => {
    if (!pendingViewMaterialsId || projects.length === 0) return;
    const found = projects.find((p: any) => String(p._id) === pendingViewMaterialsId);
    if (found) {
      setSelectedProject(found);
      setView('materials');
      setPendingViewMaterialsId(null);
    }
  }, [projects, pendingViewMaterialsId]);

  // --- Initialisation des quantités locales à l'entrée de la vue matériaux ---
  useEffect(() => {
    if (view === 'materials' && selectedProject) {
      const initial: Record<string, number> = {};
      const mats = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
      mats.forEach((mat: any) => {
        const id = String((mat && (mat._id || mat)) || '');
        if (id) initial[id] = (initial[id] || 0) + 1;
      });
      setLocalQuantities(initial);
    }
  }, [view, selectedProject?._id]);

  // --- Chargement de la localisation du profil artisan ---
  useEffect(() => {
    const fetchArtisanProfileLocation = async () => {
      try {
        const token = getToken();
        if (!token) return;

        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const userData = response.data?.user ? response.data.user : response.data;
        const location = (userData?.location || '').trim();
        setArtisanProfileLocation(location);
      } catch (error) {
        console.error('Erreur lors du chargement de la localisation profil:', error);
      }
    };

    fetchArtisanProfileLocation();
  }, [API_URL]);

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

  const getProfileLocations = () =>
    artisanProfileLocation
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

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
        if (!value) return 'La localisation est obligatoire';
        const allowedLocations = getProfileLocations();
        if (!allowedLocations.length) {
          return 'Aucune localisation detectee dans votre profil artisan';
        }
        if (!locationSelected) {
          return `Selectionnez une ville valide de: ${allowedLocations.join(', ')}`;
        }
        return '';
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
    const fieldsToValidate = ['title', 'description', 'location', 'startDate', 'endDate'];

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
      const payload = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        // Keep creation compatible with legacy backend checks that reject 0 via falsy validation.
        budget: 1,
        startDate: formData.startDate,
        endDate: formData.endDate,
        progress: 0,
        tasks: [],
      };

      await axios.post(
        `${API_URL}/projects`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setFormData({ title: '', description: '', location: '', budget: '', startDate: '', endDate: '', progress: 0 });
      setLocationSelected(false);
      toast.success('Project created successfully');
      setView('list');
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      const backendMessage = error?.response?.data?.message;
      const missingFields = Array.isArray(error?.response?.data?.missingFields)
        ? ` Missing: ${error.response.data.missingFields.join(', ')}`
        : '';
      toast.error(`${backendMessage || 'Erreur lors de la création du projet.'}${missingFields}`);
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

  const normalizeTasks = (tasks: any[] | undefined) => {
    if (!Array.isArray(tasks)) return [];
    return tasks.map((task) => ({
      _id: task._id || `${Date.now()}-${Math.random()}`,
      title: task.title || '',
      status: task.status || 'todo',
    }));
  };

  const computeProgressFromTasks = (tasks: any[]) => {
    if (!tasks.length) return 0;
    const doneCount = tasks.filter((task) => task.status === 'done').length;
    return Math.round((doneCount / tasks.length) * 100);
  };

  const updateProjectLocally = (updatedProject: any) => {
    setSelectedProject(updatedProject);
    setProjects((prev) => prev.map((p) => (p._id === updatedProject._id ? updatedProject : p)));
  };

  const persistProjectUpdate = async (projectId: string, payload: any) => {
    const token = getToken();
    const response = await axios.put(`${API_URL}/projects/${projectId}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    updateProjectLocally(response.data);
    return response.data;
  };

  const handleAddTask = async () => {
    if (!selectedProject || !newTaskTitle.trim()) return;

    const tasks = normalizeTasks(selectedProject.tasks);
    const updatedTasks = [...tasks, { title: newTaskTitle.trim(), status: 'todo' }];
    const updatedProgress = computeProgressFromTasks(updatedTasks);

    try {
      await persistProjectUpdate(selectedProject._id, {
        tasks: updatedTasks,
        progress: updatedProgress,
      });
      setNewTaskTitle('');
    } catch (error) {
      console.error('Erreur lors de lajout de la tache:', error);
      alert('Impossible dajouter la tache.');
    }
  };

  const handleTaskStatusChange = async (taskId: string, status: 'todo' | 'in_progress' | 'done') => {
    if (!selectedProject) return;

    const tasks = normalizeTasks(selectedProject.tasks);
    const updatedTasks = tasks.map((task) => (task._id === taskId ? { ...task, status } : task));
    const updatedProgress = computeProgressFromTasks(updatedTasks);

    try {
      await persistProjectUpdate(selectedProject._id, {
        tasks: updatedTasks,
        progress: updatedProgress,
      });
    } catch (error) {
      console.error('Erreur lors de la mise a jour du statut de la tache:', error);
      alert('Impossible de mettre a jour le statut de la tache.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedProject) return;

    const tasks = normalizeTasks(selectedProject.tasks);
    const updatedTasks = tasks.filter((task) => task._id !== taskId);
    const updatedProgress = computeProgressFromTasks(updatedTasks);

    try {
      await persistProjectUpdate(selectedProject._id, {
        tasks: updatedTasks,
        progress: updatedProgress,
      });
    } catch (error) {
      console.error('Erreur lors de la suppression de la tache:', error);
      alert('Impossible de supprimer la tache.');
    }
  };

  const handleSaveTaskEdit = async (taskId: string) => {
    if (!selectedProject || !editingTaskTitle.trim()) return;

    const tasks = normalizeTasks(selectedProject.tasks);
    const updatedTasks = tasks.map((task) =>
      task._id === taskId ? { ...task, title: editingTaskTitle.trim() } : task
    );
    const updatedProgress = computeProgressFromTasks(updatedTasks);

    try {
      await persistProjectUpdate(selectedProject._id, {
        tasks: updatedTasks,
        progress: updatedProgress,
      });
      setEditingTaskId(null);
      setEditingTaskTitle('');
    } catch (error) {
      console.error('Erreur lors de la modification de la tache:', error);
      alert('Impossible de modifier la tache.');
    }
  };

  const getProjectProgress = (project: any) => {
    const tasks = normalizeTasks(project.tasks);
    return tasks.length ? computeProgressFromTasks(tasks) : project.progress || 0;
  };

  const handleAddProjectToPortfolio = async (projectId: string) => {
    try {
      setAddingToPortfolio(true);
      const token = getToken();
      await axios.post(
        `${API_URL}/artisans/me/portfolio/from-project/${projectId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Project added to portfolio. You can now enrich it with images and videos in Portfolio.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to add this project to portfolio.');
    } finally {
      setAddingToPortfolio(false);
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

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || (project.status || 'active') === statusFilter;
    const matchesPriority = priorityFilter === 'all' || (project.priority || 'medium') === priorityFilter;

    return Boolean(matchesSearch && matchesStatus && matchesPriority);
  });

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

            {/* Localisation */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-semibold">
                Localisation <span style={{ color: 'red' }}>*</span>
              </Label>
              <LocationInput
                value={formData.location}
                onChange={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(false);
                  if (touched.location) setErrors((prev) => ({ ...prev, location: validateField('location', value) }));
                }}
                onSelect={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(true);
                  if (touched.location) setErrors((prev) => ({ ...prev, location: '' }));
                }}
                onBlur={() => handleBlur('location')}
                allowedStates={getProfileLocations()}
                error={touched.location && errors.location ? errors.location : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Saisissez une ville; seules les villes dans vos gouvernorats de profil sont acceptees.
              </p>
              {touched.location && errors.location && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.location}</p>}
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

            {/* Localisation */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-semibold">
                Localisation <span style={{ color: 'red' }}>*</span>
              </Label>
              <LocationInput
                value={formData.location}
                onChange={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(false);
                  if (touched.location) setErrors((prev) => ({ ...prev, location: validateField('location', value) }));
                }}
                onSelect={(value) => {
                  setFormData({ ...formData, location: value });
                  setLocationSelected(true);
                  if (touched.location) setErrors((prev) => ({ ...prev, location: '' }));
                }}
                onBlur={() => handleBlur('location')}
                allowedStates={getProfileLocations()}
                error={touched.location && errors.location ? errors.location : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Saisissez une ville; seules les villes dans vos gouvernorats de profil sont acceptees.
              </p>
              {touched.location && errors.location && <p style={{ color: 'red', fontSize: '0.875rem' }}>{errors.location}</p>}
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
    const tasks = normalizeTasks(selectedProject.tasks);
    const todoTasks = tasks.filter((task) => task.status !== 'done');
    const doneTasks = tasks.filter((task) => task.status === 'done');
    const progress = getProjectProgress(selectedProject);

    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Projects
        </Button>
        <div className="grid lg:grid-cols-1 gap-6">
          <div className="space-y-6">
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
                  onClick={() => guard(() => setView('edit'))}
                >
                  <Edit size={16} className="mr-2" /> Edit
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-foreground mb-3">Description</h4>
                  <p className="text-muted-foreground leading-relaxed">{selectedProject.description}</p>
                </div>

                <div className="pt-6 border-t-2 border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-foreground">Project Progress</h4>
                    <span className="text-4xl font-bold text-primary">{progress}%</span>
                  </div>
                  <div className="h-4 rounded-full overflow-hidden bg-gray-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-gray-100 space-y-4">
                  <h4 className="text-lg font-semibold text-foreground">Tasks</h4>
                  <div className="flex flex-col md:flex-row gap-3">
                    <Input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Add a new task..."
                      className="h-11 rounded-xl border-2 border-gray-200"
                    />
                    <Button
                      type="button"
                      className="h-11 px-6 rounded-xl bg-primary text-white hover:bg-primary/90"
                      onClick={handleAddTask}
                      disabled={!newTaskTitle.trim()}
                    >
                      Add Task
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-semibold text-foreground">To Do</h5>
                    {todoTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tasks in To Do.</p>
                    ) : (
                      todoTasks.map((task) => (
                        <div key={task._id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/60">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            {editingTaskId === task._id ? (
                              <Input
                                value={editingTaskTitle}
                                onChange={(e) => setEditingTaskTitle(e.target.value)}
                                className="h-10 rounded-lg border-2 border-gray-200"
                              />
                            ) : (
                              <div className="flex items-center gap-3">
                                <p className="font-medium text-foreground">{task.title}</p>
                                <Badge className="bg-gray-100 text-gray-700 border border-gray-200">
                                  {task.status === 'in_progress' ? 'In Progress' : 'To Do'}
                                </Badge>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {task.status === 'todo' && (
                                <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleTaskStatusChange(task._id, 'in_progress')}>
                                  In Progress
                                </Button>
                              )}
                              {task.status === 'in_progress' && (
                                <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleTaskStatusChange(task._id, 'done')}>
                                  Done
                                </Button>
                              )}
                              {editingTaskId === task._id ? (
                                <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleSaveTaskEdit(task._id)}>
                                  Save
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-lg"
                                  onClick={() => {
                                    setEditingTaskId(task._id);
                                    setEditingTaskTitle(task.title);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button type="button" variant="outline" className="h-9 rounded-lg text-red-600 hover:text-red-700" onClick={() => handleDeleteTask(task._id)}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-semibold text-foreground">Done</h5>
                    {doneTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
                    ) : (
                      doneTasks.map((task) => (
                        <div key={task._id} className="p-4 rounded-xl border border-green-200 bg-green-50/50">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            {editingTaskId === task._id ? (
                              <Input
                                value={editingTaskTitle}
                                onChange={(e) => setEditingTaskTitle(e.target.value)}
                                className="h-10 rounded-lg border-2 border-gray-200"
                              />
                            ) : (
                              <div className="flex items-center gap-3">
                                <p className="font-medium text-foreground">{task.title}</p>
                                <Badge className="bg-green-100 text-green-700 border border-green-200">Done</Badge>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleTaskStatusChange(task._id, 'in_progress')}>
                                In Progress
                              </Button>
                              {editingTaskId === task._id ? (
                                <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => handleSaveTaskEdit(task._id)}>
                                  Save
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 rounded-lg"
                                  onClick={() => {
                                    setEditingTaskId(task._id);
                                    setEditingTaskTitle(task.title);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button type="button" variant="outline" className="h-9 rounded-lg text-red-600 hover:text-red-700" onClick={() => handleDeleteTask(task._id)}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
        {PopupElement}
      </div>
    );
  }

  // =========================================================================
  // VUE 5 : PROJECT MATERIALS
  // =========================================================================
  if (view === 'materials' && selectedProject) {
    const selectedProjectProgress = getProjectProgress(selectedProject);
    const isSelectedProjectCompleted = selectedProjectProgress >= 100;
    const materialsList = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
    const groupedMaterials = Object.values(
      materialsList.reduce((acc: Record<string, { item: any; quantity: number }>, mat: any) => {
        const matId = String((mat && (mat._id || mat)) || '');
        if (!matId) return acc;
        if (!acc[matId]) {
          acc[matId] = { item: mat, quantity: 0 };
        }
        acc[matId].quantity += 1;
        return acc;
      }, {})
    );

    const buildMaterialLookup = () => {
      const map: Record<string, any> = {};
      const source = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
      source.forEach((mat: any) => {
        const id = String((mat && (mat._id || mat)) || '');
        if (id) map[id] = mat;
      });
      return map;
    };

    // +/- local uniquement (sans appel API)
    const handleAdjustLocalQuantity = (materialId: string, delta: number) => {
      const sourceMaterials = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
      const currentCount = localQuantities[materialId] ?? 1;

      if (delta < 0 && currentCount <= 1) return;

      if (delta > 0) {
        const mat = sourceMaterials.find((m: any) => String((m && (m._id || m)) || '') === materialId);
        const maxStock = Number(mat?.stock || 0);
        if (maxStock > 0 && currentCount >= maxStock) {
          toast.warning(`Maximum stock reached (${maxStock} units available).`);
          return;
        }
      }

      setLocalQuantities(prev => ({ ...prev, [materialId]: currentCount + delta }));
    };

    // Confirme la quantité choisie → sauvegarde en base
    const confirmMaterialQuantity = async (materialId: string) => {
      try {
        setConfirmingMaterialId(materialId);
        let token = localStorage.getItem('token');
        if (!token && localStorage.getItem('user')) token = JSON.parse(localStorage.getItem('user')!).token;

        const newQty = localQuantities[materialId] ?? 1;
        const sourceMaterials = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
        const allIds = sourceMaterials.map((mat: any) => String((mat && (mat._id || mat)) || '')).filter(Boolean);

        const otherIds = allIds.filter((id: string) => id !== materialId);
        const updatedIds = [...otherIds, ...Array(newQty).fill(materialId)];

        const res = await axios.put(
          `${API_URL}/projects/${selectedProject._id}`,
          { materials: updatedIds },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // res.data.materials is already populated by the backend (.populate('materials'))
        // Use it directly — no manual hydration needed
        setSelectedProject(res.data);

        // Re-compute localQuantities from the saved data
        const savedMats = Array.isArray(res.data.materials) ? res.data.materials : [];
        const newLocal: Record<string, number> = {};
        savedMats.forEach((mat: any) => {
          const id = String((mat && (mat._id || mat)) || '');
          if (id) newLocal[id] = (newLocal[id] || 0) + 1;
        });
        setLocalQuantities(newLocal);

        await fetchProjects();
        toast.success('Quantity confirmed!');
      } catch (err) {
        console.error('Failed to confirm quantity', err);
        toast.error('Error saving quantity');
      } finally {
        setConfirmingMaterialId(null);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setView('list')} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" /> Back to Projects
          </Button>
          <h2 className="text-2xl font-bold">Materials for {selectedProject.title}</h2>
          {!isSelectedProjectCompleted ? (
            <Button onClick={() => guard(() => { window.location.href = '/?artisanView=marketplace&projectId=' + selectedProject._id; })} className="rounded-xl bg-secondary hover:bg-secondary/90 text-white">
              <ShoppingCart size={20} className="mr-2" /> Add More
            </Button>
          ) : (
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
              Project completed
            </span>
          )}
        </div>
        <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
          {groupedMaterials.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No materials added to this project yet.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {groupedMaterials.map((entry: any, i: number) => {
                const m = entry.item;
                const quantity = entry.quantity;
                const materialId = String((m && (m._id || m)) || '');
                return (
                <div key={materialId || i} className="border p-5 rounded-2xl flex flex-col justify-between items-start gap-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    {m.image && <img src={m.image} alt={m.name} className="w-16 h-16 object-cover rounded-xl shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base leading-tight truncate">{m.name || 'Material'}</p>
                      <p className="text-sm font-semibold text-primary mt-0.5">{m.price ? m.price + ' TND / unit' : ''}</p>
                      {m.stock !== undefined && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Stock available: <span className="font-semibold">{m.stock}</span>
                        </p>
                      )}
                      {/* Quantity adjuster */}
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-muted-foreground">Qty:</span>
                        <div className="flex items-center gap-1 rounded-xl border-2 border-gray-200 overflow-hidden">
                          <button
                            type="button"
                            className="h-8 w-8 flex items-center justify-center text-base font-bold hover:bg-gray-100 transition-colors disabled:opacity-40"
                            disabled={(localQuantities[materialId] ?? quantity) <= 1}
                            onClick={() => handleAdjustLocalQuantity(materialId, -1)}
                          >
                            −
                          </button>
                          <div className="min-w-[32px] text-center font-bold text-sm">
                            {localQuantities[materialId] ?? quantity}
                          </div>
                          <button
                            type="button"
                            className="h-8 w-8 flex items-center justify-center text-base font-bold hover:bg-gray-100 transition-colors"
                            onClick={() => handleAdjustLocalQuantity(materialId, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {/* Saved quantity indicator */}
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Saved: {quantity} unit{quantity > 1 ? 's' : ''} · Total: {((m.price || 0) * quantity).toFixed(2)} TND
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full mt-2">
                    {/* Confirm button — also always visible at bottom for convenience */}
                    <button
                      type="button"
                      disabled={confirmingMaterialId === materialId || (localQuantities[materialId] ?? quantity) === quantity}
                      onClick={() => confirmMaterialQuantity(materialId)}
                      className="flex-1 rounded-xl py-2 text-sm font-semibold border border-emerald-600 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: (localQuantities[materialId] ?? quantity) !== quantity ? '#10b981' : '#d1fae5', color: (localQuantities[materialId] ?? quantity) !== quantity ? 'white' : '#065f46' }}
                    >
                      {confirmingMaterialId === materialId ? 'Saving…' : (localQuantities[materialId] ?? quantity) !== quantity ? '✓ Confirm Qty' : '✓ Saved'}
                    </button>
                    <Button variant="outline" className="flex-1 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 rounded-xl py-2 text-sm" onClick={async () => {
                      try {
                        let token = localStorage.getItem('token'); if (!token && localStorage.getItem('user')) token = JSON.parse(localStorage.getItem('user')!).token;
                        const sourceMaterials = Array.isArray(selectedProject.materials) ? selectedProject.materials : [];
                        const updatedMaterials = sourceMaterials
                          .map((mat: any) => mat._id || mat)
                          .filter((id: any) => String(id) !== materialId);
                        const res = await axios.put(`${API_URL}/projects/${selectedProject._id}`, { materials: updatedMaterials }, { headers: { Authorization: `Bearer ${token}` } });
                        setSelectedProject(res.data);
                        await fetchProjects();
                      } catch (err) { console.error('Failed to remove', err); toast.error('Error removing material'); }
                    }}>🗑 Remove</Button>
                  </div>
                </div>
              )})}
            </div>
          )}
        </Card>
        {PopupElement}
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
        <Button onClick={() => guard(handleCreateView)} className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg">
          <Plus size={20} className="mr-2" /> Create Project
        </Button>
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
          <div className="flex-1 h-12 rounded-xl border-2 border-gray-200 bg-white px-3 flex items-center gap-2">
            <Search className="text-muted-foreground shrink-0" size={18} />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-full px-0"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:w-auto">
            <div className="h-12 rounded-xl border-2 border-gray-200 bg-white px-3 flex items-center gap-2 min-w-[170px] overflow-hidden focus-within:border-gray-300 transition-colors">
              <Filter className="text-muted-foreground shrink-0" size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'pending' | 'completed')}
                className="h-full w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0 outline-none cursor-pointer"
                style={{ WebkitAppearance: 'none', appearance: 'none', background: 'transparent' }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="h-12 rounded-xl border-2 border-gray-200 bg-white px-3 flex items-center min-w-[170px] overflow-hidden focus-within:border-gray-300 transition-colors">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'all' | 'low' | 'medium' | 'high')}
                className="h-full w-full border-none bg-transparent text-sm focus:outline-none focus:ring-0 outline-none cursor-pointer"
                style={{ WebkitAppearance: 'none', appearance: 'none', background: 'transparent' }}
              >
                <option value="all">All Priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
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
            const projectProgress = getProjectProgress(project);
            const isProjectCompleted = status === 'completed' || projectProgress >= 100;
            
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
                    <span className="text-2xl font-bold text-primary">{projectProgress}%</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden bg-gray-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${projectProgress}%` }} />
                  </div>
                </div>

                {isProjectCompleted && (
                  <Button
                    type="button"
                    className="w-full h-10 rounded-xl bg-primary text-white hover:bg-primary/90 mb-4"
                    onClick={() => guard(() => handleAddProjectToPortfolio(project._id))}
                    disabled={addingToPortfolio}
                  >
                    {addingToPortfolio ? 'Adding...' : 'Add to Portfolio'}
                  </Button>
                )}

                <div className="space-y-2 mb-4">
                  {!isProjectCompleted && (
                    <Button onClick={() => guard(() => { window.location.href = '/?artisanView=marketplace&projectId=' + project._id; })} className="w-full h-10 justify-start text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-md">
                      <ShoppingCart size={16} className="mr-2" /> Add Material
                    </Button>
                  )}
                  {project.materials && project.materials.length > 0 && (
                    <Button onClick={() => guard(() => { setSelectedProject(project); setView('materials'); })} className="w-full h-10 justify-start text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md">
                      <FolderKanban size={16} className="mr-2" /> View Materials
                    </Button>
                  )}
                  <Button
                    className="w-full h-10 justify-start text-white bg-accent hover:bg-accent/90 rounded-xl shadow-md"
                    onClick={() => guard(() => {
                      window.location.href = '/?artisanView=quotes&projectId=' + project._id;
                    })}
                  >
                    <FileText size={16} className="mr-2" /> Create Quote
                  </Button>
                  <Button
                    className="w-full h-10 justify-start text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md"
                    onClick={() => guard(() => {
                      // Generate Invoice action
                    })}
                  >
                    <Receipt size={16} className="mr-2" /> Generate Invoice
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-2 hover:bg-primary hover:text-white hover:border-primary"
                    onClick={() => guard(() => { setSelectedProject(project); setView('details'); })}
                  >
                    <Eye size={16} className="mr-2" /> View
                  </Button>
                  <Button
  variant="outline"
  className="h-11 px-4 rounded-xl border-2 hover:bg-primary hover:text-white hover:border-primary"
  onClick={() => guard(() => {
    setSelectedProject(project);
    setView('edit');
  })}
>
  <Edit size={16} />
</Button>
                  
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {PopupElement}
    </div>
  );
}