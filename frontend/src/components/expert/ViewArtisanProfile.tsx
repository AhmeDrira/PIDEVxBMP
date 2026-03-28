import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, MapPin, Briefcase, Calendar, Star, MessageSquare, Phone, Mail, Award, Image, Play, ArrowLeft } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface ViewArtisanProfileProps {
  artisanId?: string;
  onBack?: () => void;
  onContact?: () => void;
}

interface ArtisanContact {
  phone: string;
  email: string;
}

interface ArtisanProfile {
  firstName: string;
  lastName: string;
  domain: string;
  location: string;
  yearsExperience: number;
  rating: number;
  reviewCount: number;
  completedProjects: number;
  profileImage: string;
  bio: string;
  contact: ArtisanContact;
  skills: string[];
  certifications: string[];
}

const API_BASE = 'http://localhost:5000';

export default function ViewArtisanProfile({ artisanId, onBack, onContact }: ViewArtisanProfileProps) {
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'profile' | 'portfolio'>('profile');
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

  useEffect(() => {
    const fetchArtisan = async () => {
      if (!artisanId) {
        setError('Artisan not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(`${API_BASE}/api/artisans/${artisanId}`);
        const data = response.data;

        const mappedArtisan: ArtisanProfile = {
          firstName: data.firstName,
          lastName: data.lastName,
          domain: data.domain,
          location: data.location,
          yearsExperience: data.yearsExperience,
          bio: data.bio,
          contact: {
            phone: data.phone,
            email: data.email,
          },
          rating: 4.8,
          reviewCount: 47,
          completedProjects: 120,
          skills: [
            'Masonry',
            'Concrete Work',
            'Foundation Building',
            'Brickwork',
            'Stone Work',
            'Plastering',
          ],
          certifications: [
            'Licensed General Contractor',
            'OSHA Safety Certified',
            'Advanced Masonry Techniques',
          ],
          profileImage: data.profilePhoto
            ? (data.profilePhoto.startsWith('http') ? data.profilePhoto : `${API_BASE}/${data.profilePhoto.replace(/^\/+/, '')}`)
            : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
        };

        setArtisan(mappedArtisan);
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load artisan';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchArtisan();
  }, [artisanId]);

  const fetchPortfolio = async () => {
    if (!artisanId) return;
    try {
      setLoadingPortfolio(true);
      const response = await axios.get(`${API_BASE}/api/artisans/${artisanId}/portfolio`);
      setPortfolio(response.data || []);
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
      setPortfolio([]);
    } finally {
      setLoadingPortfolio(false);
    }
  };

  const handleViewPortfolio = () => {
    fetchPortfolio();
    setView('portfolio');
  };

  const getMediaUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_BASE}/${url.replace(/^\/+/, '')}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" />
            Back to Artisan Directory
          </Button>
        )}
        <p className="text-sm text-muted-foreground">Loading artisan profile...</p>
      </div>
    );
  }

  if (error || !artisan) {
    return (
      <div className="space-y-6">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
            <ArrowRight size={20} className="mr-2 rotate-180" />
            Back to Artisan Directory
          </Button>
        )}
        <p className="text-sm text-red-500">{error || 'Artisan not found'}</p>
      </div>
    );
  }

  // ── Portfolio View ──
  if (view === 'portfolio') {
    const images = portfolio.flatMap(item =>
      (item.media || []).filter((m: any) => m.type === 'image').map((m: any) => ({ ...m, projectTitle: item.title }))
    );
    const videos = portfolio.flatMap(item =>
      (item.media || []).filter((m: any) => m.type === 'video').map((m: any) => ({ ...m, projectTitle: item.title }))
    );

    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setView('profile')} className="rounded-xl border-2">
          <ArrowLeft size={20} className="mr-2" />
          Back to Profile
        </Button>

        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1f2937', margin: '0 0 4px' }}>
            {artisan.firstName} {artisan.lastName}'s Portfolio
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280' }}>{artisan.domain} &middot; {artisan.location}</p>
        </div>

        {loadingPortfolio ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Loading portfolio...</p>
        ) : portfolio.length === 0 ? (
          <Card className="p-12 bg-white rounded-2xl border-0 shadow-lg text-center">
            <Image size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-xl font-semibold text-gray-500">No portfolio items yet</p>
            <p className="text-muted-foreground mt-1">This artisan hasn't added any work to their portfolio.</p>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Portfolio Projects */}
            {portfolio.map((item: any, idx: number) => (
              <Card key={item._id || idx} className="bg-white rounded-2xl border-0 shadow-lg overflow-hidden">
                <div style={{ padding: '24px 28px 20px' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: '0 0 4px' }}>{item.title}</h3>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px' }}>{item.description}</p>
                  {item.location && <p style={{ fontSize: 13, color: '#9ca3af' }}><MapPin size={14} className="inline mr-1" />{item.location}</p>}
                  {item.completedDate && (
                    <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                      <Calendar size={14} className="inline mr-1" />
                      Completed: {new Date(item.completedDate).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>
                {(item.media || []).length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 4, padding: '0 4px 4px' }}>
                    {(item.media || []).map((m: any, mi: number) => (
                      <div key={mi} style={{ aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f3f4f6' }}>
                        {m.type === 'video' ? (
                          <video src={getMediaUrl(m.url)} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <img src={getMediaUrl(m.url)} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Profile View ──
  return (
    <div className="space-y-6">
      {/* Back Button */}
      {onBack && (
        <Button variant="outline" onClick={onBack} className="rounded-xl border-2">
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Artisan Directory
        </Button>
      )}

      {/* Profile Header */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Profile Image — smaller */}
          <div className="flex-shrink-0">
            <div style={{ width: 96, height: 96, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '3px solid #f3f4f6' }}>
              <ImageWithFallback
                src={artisan.profileImage}
                alt={`${artisan.firstName} ${artisan.lastName}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {artisan.firstName} {artisan.lastName}
                </h1>
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase size={20} className="text-primary" />
                  <span className="text-lg font-medium text-muted-foreground">{artisan.domain}</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={20} className="text-muted-foreground" />
                  <span className="text-muted-foreground">{artisan.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={20} className="text-muted-foreground" />
                  <span className="text-muted-foreground">{artisan.yearsExperience} years of experience</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleViewPortfolio}
                  variant="outline"
                  className="h-12 px-6 rounded-xl border-2"
                >
                  <Image size={18} className="mr-2" />
                  View Portfolio
                </Button>
                <Button
                  onClick={onContact}
                  className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
                >
                  <MessageSquare size={20} className="mr-2" />
                  Contact Artisan
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star size={20} className="text-secondary fill-secondary" />
                  <span className="text-2xl font-bold text-foreground">{artisan.rating}</span>
                </div>
                <p className="text-sm text-muted-foreground">{artisan.reviewCount} Reviews</p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-accent/5 to-accent/10 text-center">
                <p className="text-2xl font-bold text-foreground mb-1">{artisan.completedProjects}</p>
                <p className="text-sm text-muted-foreground">Projects Done</p>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/5 to-secondary/10 text-center">
                <p className="text-2xl font-bold text-foreground mb-1">{artisan.yearsExperience}</p>
                <p className="text-sm text-muted-foreground">Years Experience</p>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">{artisan.bio}</p>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Contact Information */}
        <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg lg:col-span-1">
          <h2 className="text-xl font-bold text-foreground mb-6">Contact Information</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Phone size={20} className="text-primary mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Phone</p>
                <p className="font-medium text-foreground">{artisan.contact.phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail size={20} className="text-primary mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium text-foreground">{artisan.contact.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin size={20} className="text-primary mt-1" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Location</p>
                <p className="font-medium text-foreground">{artisan.location}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Skills & Certifications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Skills */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-xl font-bold text-foreground mb-4">Skills & Expertise</h2>
            <div className="flex flex-wrap gap-3">
              {artisan.skills.map((skill, idx) => (
                <Badge
                  key={idx}
                  className="bg-primary/10 text-primary border-0 px-4 py-2 text-sm font-medium"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </Card>

          {/* Certifications */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-xl font-bold text-foreground mb-4">Certifications</h2>
            <div className="space-y-3">
              {artisan.certifications.map((cert, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-accent/5">
                  <Award size={20} className="text-accent" />
                  <span className="font-medium text-foreground">{cert}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
