import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowRight, MapPin, Briefcase, Calendar, Star, MessageSquare, Phone, Mail, Award } from 'lucide-react';
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

interface ArtisanPortfolioItem {
  id: string;
  title: string;
  description: string;
  image: string;
  completedDate: string;
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
  portfolio: ArtisanPortfolioItem[];
}

export default function ViewArtisanProfile({ artisanId, onBack, onContact }: ViewArtisanProfileProps) {
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

        // Récupération du profil de l'artisan
        const response = await axios.get(`http://localhost:5000/api/artisans/${artisanId}`);
        const data = response.data;

        // Initialisation du profil artisan
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
          skills: data.skills || [
            'Masonry',
            'Concrete Work',
            'Foundation Building',
            'Brickwork',
            'Stone Work',
            'Plastering',
          ],
          certifications: data.certifications || [
            'Licensed General Contractor',
            'OSHA Safety Certified',
            'Advanced Masonry Techniques',
          ],
          portfolio: [], // sera rempli par l'appel API suivant
          profileImage: data.profileImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
        };

        setArtisan(mappedArtisan);

        // Récupération des projets depuis la table projects
        const projectsResponse = await axios.get(`http://localhost:5000/api/projects/artisan/${artisanId}`);
        const projectsData = projectsResponse.data;

        const portfolioItems: ArtisanPortfolioItem[] = projectsData.map((proj: any) => ({
          id: proj._id,
          title: proj.title,
          description: proj.description,
          image: proj.image || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
          completedDate: proj.endDate,
        }));

        setArtisan(prev => prev ? { ...prev, portfolio: portfolioItems } : prev);

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
          <div className="flex-shrink-0">
            <div className="w-40 h-40 rounded-2xl overflow-hidden ring-4 ring-gray-100 shadow-lg">
              <ImageWithFallback
                src={artisan.profileImage}
                alt={`${artisan.firstName} ${artisan.lastName}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex-1">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">{artisan.firstName} {artisan.lastName}</h1>
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

              <Button
                onClick={onContact}
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
              >
                <MessageSquare size={20} className="mr-2" />
                Contact Artisan
              </Button>
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

      {/* Contact + Skills + Certifications */}
      <div className="grid lg:grid-cols-3 gap-6">
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

        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-xl font-bold text-foreground mb-4">Skills & Expertise</h2>
            <div className="flex flex-wrap gap-3">
              {artisan.skills.map((skill, idx) => (
                <Badge key={idx} className="bg-primary/10 text-primary border-0 px-4 py-2 text-sm font-medium">
                  {skill}
                </Badge>
              ))}
            </div>
          </Card>

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

      {/* Portfolio Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-6">Portfolio</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {artisan.portfolio.map((project) => (
            <Card key={project.id} className="group bg-white rounded-2xl border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="aspect-video relative overflow-hidden bg-gray-100">
                <ImageWithFallback
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-foreground mb-2">{project.title}</h3>
                <p className="text-muted-foreground mb-4">{project.description}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar size={16} />
                  <span>Completed: {new Date(project.completedDate).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}