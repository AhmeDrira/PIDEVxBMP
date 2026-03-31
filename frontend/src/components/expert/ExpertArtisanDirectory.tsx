import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Search, MapPin, Star, MessageSquare, Briefcase, SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '../ui/badge';
import ViewArtisanProfile from './ViewArtisanProfile';
import ArtisanPortfolioPage from './ArtisanPortfolioPage';
import ExpertPortfolioItemPage from './ExpertPortfolioItemPage';

interface ExpertArtisanDirectoryProps {
  onNavigate: (view: string) => void;
}

interface Artisan {
  id: string;
  name: string;
  specialization: string;
  location: string;
  experience: string;
  bio: string;
  rating: number;
  reviews: number;
  completedProjects: number;
  skills: string[];
}

type Page =
  | { type: 'directory' }
  | { type: 'profile'; artisanId: string; artisanName: string; artisanDomain: string }
  | { type: 'portfolio'; artisanId: string; artisanName: string; artisanDomain: string }
  | { type: 'portfolioItem'; artisanId: string; artisanName: string; itemId: string };

interface ArtisanFilters {
  specializations: string[];
  locations: string[];
  minRating: number;
}

const SPECIALIZATIONS = [
  'Masonry', 'Concrete Work', 'Foundation Construction', 'Plumbing',
  'Electrical Installation', 'Carpentry', 'Painting', 'Tiling',
  'Plastering', 'Roofing', 'Waterproofing', 'HVAC', 'Metal Work', 'Aluminum Work',
];

const TUNISIA_LOCATIONS = [
  'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte',
  'Béja', 'Jendouba', 'Kef', 'Siliana', 'Kairouan', 'Kasserine', 'Sidi Bouzid',
  'Sousse', 'Monastir', 'Mahdia', 'Sfax', 'Gafsa', 'Tozeur', 'Kebili',
  'Gabès', 'Médenine', 'Tataouine',
];

const RATING_OPTIONS = [
  { label: 'All ratings', value: 0 },
  { label: '4★ & above', value: 4 },
  { label: '3★ & above', value: 3 },
  { label: '2★ & above', value: 2 },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ExpertArtisanDirectory({ onNavigate }: ExpertArtisanDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState<Page>({ type: 'directory' });
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ArtisanFilters>({ specializations: [], locations: [], minRating: 0 });
  const [pendingFilters, setPendingFilters] = useState<ArtisanFilters>({ specializations: [], locations: [], minRating: 0 });
  const [specExpanded, setSpecExpanded] = useState(false);
  const [locExpanded, setLocExpanded] = useState(false);

  const getToken = () => {
    let token: string | null = localStorage.getItem('token');
    if (!token) {
      try { token = JSON.parse(localStorage.getItem('user') || '{}').token || null; } catch {}
    }
    return token;
  };

  const fetchArtisans = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = searchQuery
        ? `${API_URL}/artisans/search?query=${encodeURIComponent(searchQuery)}`
        : `${API_URL}/artisans`;

      const response = await axios.get(endpoint);
      const data = Array.isArray(response.data) ? response.data : [];

      const mappedArtisans: Artisan[] = data.map((item: any) => ({
        id: item._id,
        name: `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim(),
        specialization: item.domain || '',
        location: item.location || '',
        experience: `${item.yearsExperience ?? 0} years`,
        bio: item.bio || '',
        rating: item.rating ?? 0,
        reviews: item.reviewCount ?? 0,
        completedProjects: item.portfolioCount ?? item.completedProjects ?? 0,
        skills: Array.isArray(item.skills) ? item.skills : [],
      }));

      setArtisans(mappedArtisans);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load artisans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchArtisans(); }, [searchQuery]);

  // Client-side filtering
  const filteredArtisans = useMemo(() => {
    return artisans.filter(a => {
      const matchSpec = filters.specializations.length === 0 || filters.specializations.includes(a.specialization);
      const matchLoc = filters.locations.length === 0 || filters.locations.some(loc =>
        a.location.toLowerCase().includes(loc.toLowerCase())
      );
      const matchRating = filters.minRating === 0 || a.rating >= filters.minRating;
      return matchSpec && matchLoc && matchRating;
    });
  }, [artisans, filters]);

  const activeFilterCount = filters.specializations.length + filters.locations.length + (filters.minRating > 0 ? 1 : 0);

  const handleApplyFilters = () => {
    setFilters({ ...pendingFilters });
  };

  const handleClearFilters = () => {
    const empty = { specializations: [], locations: [], minRating: 0 };
    setPendingFilters(empty);
    setFilters(empty);
  };

  const toggleSpec = (s: string) => {
    setPendingFilters(prev => ({
      ...prev,
      specializations: prev.specializations.includes(s)
        ? prev.specializations.filter(x => x !== s)
        : [...prev.specializations, s],
    }));
  };

  const toggleLoc = (l: string) => {
    setPendingFilters(prev => ({
      ...prev,
      locations: prev.locations.includes(l)
        ? prev.locations.filter(x => x !== l)
        : [...prev.locations, l],
    }));
  };

  const handleContact = async (artisanId: string) => {
    try {
      const token = getToken();
      if (!token) { alert('Please login first'); return; }
      const response = await axios.post(
        `${API_URL}/conversations`,
        { participantId: artisanId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const conversation = response.data;
      localStorage.setItem('selectedConversationId', conversation._id || conversation.id);
      onNavigate('messages');
    } catch (err: any) {
      alert(`Failed to create conversation: ${axios.isAxiosError(err) ? err.response?.data?.message || err.message : 'Unknown error'}`);
    }
  };

  // ── Portfolio item gallery page ──
  if (page.type === 'portfolioItem') {
    return (
      <ExpertPortfolioItemPage
        artisanId={page.artisanId}
        itemId={page.itemId}
        artisanName={page.artisanName}
        onBack={() => setPage({ type: 'portfolio', artisanId: page.artisanId, artisanName: page.artisanName, artisanDomain: '' })}
      />
    );
  }

  // ── Portfolio page ──
  if (page.type === 'portfolio') {
    return (
      <ArtisanPortfolioPage
        artisanId={page.artisanId}
        artisanName={page.artisanName}
        artisanDomain={page.artisanDomain}
        onBack={() => setPage({ type: 'profile', artisanId: page.artisanId, artisanName: page.artisanName, artisanDomain: page.artisanDomain })}
        onViewItem={itemId => setPage({ type: 'portfolioItem', artisanId: page.artisanId, artisanName: page.artisanName, itemId })}
      />
    );
  }

  // ── Profile page ──
  if (page.type === 'profile') {
    return (
      <ViewArtisanProfile
        artisanId={page.artisanId}
        onBack={() => setPage({ type: 'directory' })}
        onContact={() => handleContact(page.artisanId)}
        onViewPortfolio={() => setPage({ type: 'portfolio', artisanId: page.artisanId, artisanName: page.artisanName, artisanDomain: page.artisanDomain })}
      />
    );
  }

  // ── Filter sidebar panel ──
  const filterPanel = (
    <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg sticky top-8 border-t-4 border-t-primary w-full lg:w-80 flex-shrink-0 animate-in slide-in-from-left-3 fade-in duration-200">
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={20} className="text-primary" />
            <h3 className="text-xl font-bold text-foreground">Filters</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-muted-foreground hover:text-primary">
            Clear All
          </Button>
        </div>

        {/* Specialization */}
        <div>
          <button
            type="button"
            onClick={() => setSpecExpanded(prev => !prev)}
            className="w-full flex items-center justify-between mb-2 group"
          >
            <Label className="text-sm font-bold text-foreground uppercase tracking-wider cursor-pointer group-hover:text-primary transition-colors">
              Specialization
              {pendingFilters.specializations.length > 0 && (
                <span className="ml-2 text-[10px] font-bold bg-primary dark:bg-blue-600 text-white rounded-full px-1.5 py-0.5 normal-case tracking-normal">
                  {pendingFilters.specializations.length}
                </span>
              )}
            </Label>
            {specExpanded
              ? <ChevronUp size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              : <ChevronDown size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
            }
          </button>

          {specExpanded && (
            <div className="space-y-1 pr-1 mt-2 animate-in slide-in-from-top-1 fade-in duration-150">
              {SPECIALIZATIONS.map(s => (
                <label key={s} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted/50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={pendingFilters.specializations.includes(s)}
                    onChange={() => toggleSpec(s)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">{s}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <button
            type="button"
            onClick={() => setLocExpanded(prev => !prev)}
            className="w-full flex items-center justify-between mb-2 group"
          >
            <Label className="text-sm font-bold text-foreground uppercase tracking-wider cursor-pointer group-hover:text-primary transition-colors">
              Location
              {pendingFilters.locations.length > 0 && (
                <span className="ml-2 text-[10px] font-bold bg-primary dark:bg-blue-600 text-white rounded-full px-1.5 py-0.5 normal-case tracking-normal">
                  {pendingFilters.locations.length}
                </span>
              )}
            </Label>
            {locExpanded
              ? <ChevronUp size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              : <ChevronDown size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
            }
          </button>

          {locExpanded && (
            <div className="space-y-1 pr-1 mt-2 animate-in slide-in-from-top-1 fade-in duration-150">
              {TUNISIA_LOCATIONS.map(l => (
                <label key={l} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted/50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={pendingFilters.locations.includes(l)}
                    onChange={() => toggleLoc(l)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">{l}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Rating */}
        <div>
          <Label className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 block">Minimum Rating</Label>
          <select
            value={pendingFilters.minRating}
            onChange={e => setPendingFilters(prev => ({ ...prev, minRating: Number(e.target.value) }))}
            className="w-full h-11 px-4 rounded-xl border-2 border-border bg-muted/50 focus:border-primary focus:bg-card transition-colors outline-none cursor-pointer text-sm"
          >
            {RATING_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-4 border-t-2 border-border">
          <Button onClick={handleClearFilters} variant="outline" className="flex-1 h-11 rounded-xl border-2">
            Reset
          </Button>
          <Button onClick={handleApplyFilters} className="flex-1 h-11 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md">
            Apply
          </Button>
        </div>
      </div>
    </Card>
  );

  // ── Search toolbar ──
  const searchToolbar = (
    <Card className="p-4 bg-card rounded-2xl border border-border shadow-lg w-full">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            placeholder="Search by name, skill, or location..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl border-2 border-border focus:border-primary"
          />
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          className={`h-12 px-6 rounded-xl border-2 shrink-0 relative ${showFilters ? 'text-white bg-primary hover:bg-primary/90' : ''}`}
          onClick={() => setShowFilters(prev => !prev)}
        >
          <SlidersHorizontal size={18} className="mr-2" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {!showFilters && activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 text-[10px] font-bold rounded-full bg-primary dark:bg-blue-600 text-white flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>
    </Card>
  );

  // ── Directory page ──
  return (
    <div className="space-y-6">
      {!showFilters && searchToolbar}

      <div className={showFilters ? 'flex flex-col lg:flex-row gap-8 items-start' : 'w-full'}>
        {showFilters && filterPanel}

        <div className="flex-1 min-w-0 space-y-6">
          {showFilters && searchToolbar}

          {/* Active filter badges */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.specializations.map(s => (
                <span key={s} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">
                  {s}
                  <button onClick={() => { setFilters(f => ({ ...f, specializations: f.specializations.filter(x => x !== s) })); setPendingFilters(f => ({ ...f, specializations: f.specializations.filter(x => x !== s) })); }}>
                    <X size={11} />
                  </button>
                </span>
              ))}
              {filters.locations.map(l => (
                <span key={l} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                  <MapPin size={10} /> {l}
                  <button onClick={() => { setFilters(f => ({ ...f, locations: f.locations.filter(x => x !== l) })); setPendingFilters(f => ({ ...f, locations: f.locations.filter(x => x !== l) })); }}>
                    <X size={11} />
                  </button>
                </span>
              ))}
              {filters.minRating > 0 && (
                <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold">
                  <Star size={10} /> {filters.minRating}★+
                  <button onClick={() => { setFilters(f => ({ ...f, minRating: 0 })); setPendingFilters(f => ({ ...f, minRating: 0 })); }}>
                    <X size={11} />
                  </button>
                </span>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground">{filteredArtisans.length} artisan(s) found</p>

          {loading && <p className="text-sm text-muted-foreground">Loading artisans...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="grid md:grid-cols-2 gap-6">
            {filteredArtisans.map(artisan => (
              <Card key={artisan.id} className="p-6 bg-card rounded-2xl border border-border shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="w-16 h-16 ring-4 ring-white shadow-lg">
                    <AvatarFallback className="bg-primary text-white font-bold text-xl">
                      {artisan.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-1">{artisan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                      <Briefcase size={13} /> {artisan.specialization}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin size={13} /> {artisan.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star size={13} className={artisan.rating > 0 ? 'text-secondary fill-secondary' : 'text-gray-300'} />
                        <span className="font-semibold text-foreground">
                          {artisan.rating > 0 ? artisan.rating.toFixed(1) : '—'}
                        </span>
                        <span>({artisan.reviews})</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{artisan.bio}</p>

                <div className="grid grid-cols-2 gap-4 mb-4 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Experience</p>
                    <p className="text-sm font-bold text-foreground">{artisan.experience}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Portfolio</p>
                    <p className="text-sm font-bold text-foreground">{artisan.completedProjects} projects</p>
                  </div>
                </div>

                {artisan.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {artisan.skills.slice(0, 3).map(skill => (
                      <Badge key={skill} className="bg-primary/10 text-primary px-3 py-1 text-xs font-semibold border-0">{skill}</Badge>
                    ))}
                    {artisan.skills.length > 3 && (
                      <Badge className="bg-muted text-muted-foreground px-3 py-1 text-xs font-semibold border-0">+{artisan.skills.length - 3}</Badge>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    className="flex-1 h-11 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md"
                    onClick={() => handleContact(artisan.id)}
                  >
                    <MessageSquare size={16} className="mr-2" />
                    Contact
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 px-6 rounded-xl border-2"
                    onClick={() => setPage({ type: 'profile', artisanId: artisan.id, artisanName: artisan.name, artisanDomain: artisan.specialization })}
                  >
                    View Profile
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {!loading && filteredArtisans.length === 0 && !error && (
            <Card className="p-12 bg-card rounded-2xl border border-border shadow-lg text-center">
              <p className="text-xl font-semibold text-muted-foreground">No artisans found</p>
              <p className="text-muted-foreground mt-1">Try adjusting your search or filters.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
