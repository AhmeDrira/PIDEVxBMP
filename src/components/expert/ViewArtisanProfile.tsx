import React from 'react';
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

export default function ViewArtisanProfile({ artisanId, onBack, onContact }: ViewArtisanProfileProps) {
  // Mock artisan data - in real app this would come from API/props
  const artisan = {
    id: artisanId || '1',
    firstName: 'Ahmed',
    lastName: 'Ben Salah',
    domain: 'General Construction & Masonry',
    location: 'Tunis, Tunisia',
    yearsExperience: 12,
    rating: 4.8,
    reviewCount: 47,
    completedProjects: 156,
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    bio: 'Experienced construction artisan specializing in residential and commercial projects. Committed to quality workmanship and client satisfaction. Licensed and insured professional with extensive experience in modern building techniques.',
    contact: {
      phone: '+216 98 765 432',
      email: 'ahmed.bensalah@email.com'
    },
    skills: [
      'Masonry',
      'Concrete Work',
      'Foundation Building',
      'Brickwork',
      'Stone Work',
      'Plastering'
    ],
    certifications: [
      'Licensed General Contractor',
      'OSHA Safety Certified',
      'Advanced Masonry Techniques'
    ],
    portfolio: [
      {
        id: 1,
        title: 'Villa Residence - Carthage',
        description: 'Complete masonry and foundation work',
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
        completedDate: '2026-01-15'
      },
      {
        id: 2,
        title: 'Commercial Building - La Marsa',
        description: 'Structural masonry for 3-story building',
        image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop',
        completedDate: '2025-12-10'
      },
      {
        id: 3,
        title: 'Residential Complex - Sousse',
        description: 'Foundation and brickwork for 10 units',
        image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&h=300&fit=crop',
        completedDate: '2025-11-20'
      },
      {
        id: 4,
        title: 'Historic Renovation - Medina',
        description: 'Traditional stonework restoration',
        image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=400&h=300&fit=crop',
        completedDate: '2025-10-05'
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {onBack && (
        <Button 
          variant="outline" 
          onClick={onBack} 
          className="rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Artisan Directory
        </Button>
      )}

      {/* Profile Header */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Profile Image */}
          <div className="flex-shrink-0">
            <div className="w-40 h-40 rounded-2xl overflow-hidden ring-4 ring-gray-100 shadow-lg">
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

      {/* Portfolio Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-6">Portfolio</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {artisan.portfolio.map((project) => (
            <Card 
              key={project.id}
              className="group bg-white rounded-2xl border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
            >
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
