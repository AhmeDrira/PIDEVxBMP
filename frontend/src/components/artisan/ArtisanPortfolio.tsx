import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isSubscriptionActive, SubscriptionPopup } from './SubscriptionGuard';
import axios from 'axios';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Image as ImageIcon,
  Plus,
  Star,
  Trash2,
  Upload,
  Video,
  View,
} from 'lucide-react';

interface PortfolioMedia {
  type: 'image' | 'video';
  url: string;
}

interface PortfolioItem {
  _id: string;
  title: string;
  description: string;
  location?: string;
  completedDate?: string;
  source: 'project' | 'manual';
  sourceProject?: string;
  media: PortfolioMedia[];
}

interface ProjectSummary {
  _id: string;
  title: string;
  description: string;
  location?: string;
  status?: string;
  progress?: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 120 * 1024 * 1024;
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, '');

const emptyForm = {
  title: '',
  description: '',
  location: '',
  completedDate: '',
};

interface ArtisanPortfolioProps {
  onViewReviews?: () => void;
  onViewGallery?: (itemId: string) => void;
}

export default function ArtisanPortfolio({ onViewReviews, onViewGallery }: ArtisanPortfolioProps = {}) {
  const [subLocked] = useState(() => !isSubscriptionActive());
  const [showSubPopup, setShowSubPopup] = useState(subLocked);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;


  const [form, setForm] = useState(emptyForm);
  const [manualFiles, setManualFiles] = useState<File[]>([]);
  const [draftFilesByItem, setDraftFilesByItem] = useState<Record<string, File[]>>({});

  const manualFileInputRef = useRef<HTMLInputElement | null>(null);
  const itemFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getToken = () => {
    let token = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) {
      token = JSON.parse(userStorage).token;
    }
    return token;
  };

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  const getFileType = (file: File): 'image' | 'video' =>
    file.type.startsWith('video/') ? 'video' : 'image';

  const resolveMediaUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `${BACKEND_ORIGIN}${url}`;
    }
    return `${BACKEND_ORIGIN}/${url}`;
  };

  const validateFiles = (files: File[]) => {
    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
      if (file.size > maxSize) {
        const label = isVideo ? 'video' : 'image';
        const maxMB = isVideo ? 120 : 15;
        return `${file.name}: ${label} exceeds ${maxMB}MB limit.`;
      }
    }
    return '';
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [portfolioRes, projectsRes] = await Promise.all([
        axios.get(`${API_URL}/artisans/me/portfolio`, authHeaders()),
        axios.get(`${API_URL}/projects`, authHeaders()),
      ]);
      setPortfolio(Array.isArray(portfolioRes.data) ? portfolioRes.data.reverse() : []);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
    } catch (error) {
      console.error('Error loading portfolio data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const paginatedPortfolio = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return portfolio.slice(startIndex, startIndex + itemsPerPage);
  }, [portfolio, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(portfolio.length / itemsPerPage);
  }, [portfolio, itemsPerPage]);


  const handleAddFromProject = async (projectId: string) => {
    try {
      setSubmitting(true);
      await axios.post(`${API_URL}/artisans/me/portfolio/from-project/${projectId}`, {}, authHeaders());
      await loadData();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Unable to add project to portfolio');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const validationMessage = validateFiles(files);
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    setManualFiles((prev) => [...prev, ...files]);

    if (manualFileInputRef.current) {
      manualFileInputRef.current.value = '';
    }
  };

  const handleCreateManualProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      alert('Project title and description are required.');
      return;
    }

    try {
      setSubmitting(true);
      await axios.post(
        `${API_URL}/artisans/me/portfolio`,
        (() => {
          const formData = new FormData();
          formData.append('title', form.title.trim());
          formData.append('description', form.description.trim());
          formData.append('location', form.location.trim());
          if (form.completedDate) formData.append('completedDate', form.completedDate);
          for (const file of manualFiles) {
            formData.append('mediaFiles', file);
          }
          return formData;
        })(),
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setForm(emptyForm);
      setManualFiles([]);
      setViewMode('list');
      await loadData();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Unable to create portfolio project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePortfolioItem = async (itemId: string) => {
    try {
      await axios.delete(`${API_URL}/artisans/me/portfolio/${itemId}`, authHeaders());
      await loadData();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Unable to delete portfolio project');
    }
  };

  const handleItemFilesSelected = (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const validationMessage = validateFiles(files);
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    setDraftFilesByItem((prev) => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), ...files],
    }));

    if (itemFileInputRefs.current[itemId]) {
      itemFileInputRefs.current[itemId]!.value = '';
    }
  };

  const handleUploadToExistingItem = async (item: PortfolioItem) => {
    const files = draftFilesByItem[item._id] || [];
    if (!files.length) {
      alert('Please select image or video files first.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      for (const file of files) {
        formData.append('mediaFiles', file);
      }

      await axios.post(
        `${API_URL}/artisans/me/portfolio/${item._id}/media`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      setDraftFilesByItem((prev) => ({ ...prev, [item._id]: [] }));
      await loadData();
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      const fallback = error?.message || 'Unable to upload files to this project';
      alert(backendMessage || fallback);
    } finally {
      setSubmitting(false);
    }
  };

  if (viewMode === 'create') {
    return (
      <div className="space-y-6">
        <Button variant="outline" className="rounded-xl border-2" onClick={() => setViewMode('list')}>
          <ArrowLeft size={18} className="mr-2" /> Back to Portfolio
        </Button>

        <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
          <h1 className="text-3xl font-bold text-foreground mb-2">Add New Portfolio Project</h1>
          <p className="text-muted-foreground mb-8">Add an external project and upload local images/videos from your computer.</p>

          <form className="space-y-6" onSubmit={handleCreateManualProject}>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Project Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Villa Residence - Carthage"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="City, Governorate"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the project scope, quality of execution and outcomes"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2 md:max-w-xs">
              <Label>Completed Date</Label>
              <Input
                type="date"
                value={form.completedDate}
                onChange={(e) => setForm((prev) => ({ ...prev, completedDate: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-3">
              <Label>Project Media (local files)</Label>
              <input
                ref={manualFileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleManualFilesChange}
                className="hidden"
              />
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => manualFileInputRef.current?.click()}>
                <Upload size={16} className="mr-2" /> Import Images / Videos From PC
              </Button>
              <p className="text-xs text-muted-foreground">
                Formats supportes: images et videos. Vous pouvez selectionner plusieurs fichiers.
                Taille max: 15MB/image, 120MB/video.
              </p>

              {manualFiles.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {manualFiles.map((file, index) => (
                    <div key={index} className="rounded-xl border border-border bg-muted/50 p-2">
                      <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-2">
                        {getFileType(file) === 'video' ? (
                          <video src={URL.createObjectURL(file)} className="w-full h-full object-cover" controls />
                        ) : (
                          <img src={URL.createObjectURL(file)} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge className="bg-primary/10 text-primary border-0">{getFileType(file) === 'video' ? 'Video' : 'Image'}</Badge>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-2"
                          onClick={() => setManualFiles((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="h-11 rounded-xl bg-primary dark:bg-blue-600 text-white hover:bg-primary/90" disabled={submitting}>
              {submitting ? 'Saving...' : 'Publish Portfolio Project'}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Portfolio Projects</h1>
          <p className="text-lg text-muted-foreground">Show your best completed work with strong visual proof.</p>
        </div>
        <Button className="h-11 px-6 rounded-xl bg-primary dark:bg-blue-600 text-white hover:bg-primary/90" onClick={() => {
          if (subLocked) { setShowSubPopup(true); return; }
          setViewMode('create');
        }}>
          <FolderPlus size={18} className="mr-2" /> Add New Project
        </Button>
      </div>

      {loading ? (
        <Card className="p-8 bg-card rounded-2xl border border-border shadow-lg">
          <p className="text-muted-foreground">Loading portfolio...</p>
        </Card>
      ) : portfolio.length === 0 ? (
        <Card className="p-10 bg-card rounded-2xl border border-border shadow-lg text-center">
          <p className="text-lg font-semibold text-foreground mb-2">No portfolio project yet</p>
          <p className="text-muted-foreground mb-6">Add your first project to improve visibility for experts.</p>
          <Button className="h-11 px-6 rounded-xl bg-primary dark:bg-blue-600 text-white hover:bg-primary/90" onClick={() => {
            if (subLocked) { setShowSubPopup(true); return; }
            setViewMode('create');
          }}>
            <Plus size={18} className="mr-2" /> Create First Portfolio Project
          </Button>
        </Card>
      ) : (
        <>
        <div className="grid lg:grid-cols-2 gap-6">
          {paginatedPortfolio.map((item) => {
            const coverMedia = item.media?.[0];
            const selectedFiles = draftFilesByItem[item._id] || [];
            return (
              <Card key={item._id} className="overflow-hidden bg-card rounded-2xl border border-border shadow-lg hover:shadow-xl transition-shadow">
                <div className="aspect-video bg-muted overflow-hidden">
                  {coverMedia ? (
                    coverMedia.type === 'video' ? (
                      <video src={resolveMediaUrl(coverMedia.url)} className="w-full h-full object-cover" controls />
                    ) : (
                      <img src={resolveMediaUrl(coverMedia.url)} alt={item.title} className="w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ImageIcon size={22} className="mr-2" /> No media
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-bold text-foreground">{item.title}</h3>
                    <Badge className="bg-primary/10 text-primary border-0">{item.source === 'project' ? 'From Project' : 'Manual'}</Badge>
                  </div>

                  <p className="text-muted-foreground text-sm h-10 overflow-hidden">{item.description}</p>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    {item.location && (
                      <div className="flex items-center gap-2">
                        <span>{item.location}</span>
                      </div>
                    )}
                    {item.completedDate && (
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        <span>{new Date(item.completedDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <ImageIcon size={16} />
                      <span>{item.media.filter((m) => m.type === 'image').length} Images</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Video size={16} />
                      <span>{item.media.filter((m) => m.type === 'video').length} Videos</span>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                       <Button
                        variant="outline"
                        className="w-full rounded-lg"
                        onClick={() => onViewGallery?.(item._id)}
                      >
                        <View size={16} className="mr-2" /> View Gallery
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <input
                        ref={(el) => (itemFileInputRefs.current[item._id] = el)}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={(e) => handleItemFilesSelected(item._id, e)}
                        className="hidden"
                      />

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 rounded-lg"
                          onClick={() => itemFileInputRefs.current[item._id]?.click()}
                        >
                          <Upload size={16} className="mr-2" /> Select Files
                        </Button>
                        <Button
                          type="button"
                          className="flex-1 rounded-lg"
                          onClick={() => handleUploadToExistingItem(item)}
                          disabled={submitting || selectedFiles.length === 0}
                        >
                          Upload Media
                        </Button>
                      </div>

                      {selectedFiles.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {selectedFiles.length} file(s) selected. Click Upload Media to save.
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Selectionnez des images ou videos puis cliquez sur Upload Media.
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <Button
                      variant="destructive"
                      className="w-full rounded-lg"
                      onClick={() => handleDeletePortfolioItem(item._id)}
                    >
                      <Trash2 size={16} className="mr-2" /> Remove
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
         {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft />
              </Button>
              <span className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Subscription lock overlay */}
      {showSubPopup && (
        <SubscriptionPopup onClose={() => setShowSubPopup(false)} />
      )}
    </div>
  );
}
