import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ArrowLeft, Star, MapPin, Briefcase, Calendar, Award, MessageSquare, Mail, Phone } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface ArtisanProfileProps {
  artisanId: number;
  onBack: () => void;
  onSendMessage: (id: number) => void;
}

export default function ArtisanProfile({ artisanId, onBack, onSendMessage }: ArtisanProfileProps) {
  const artisan = {
    id: artisanId,
    name: 'Ahmed Ben Salah',
    specialization: 'General Construction',
    domain: 'Residential & Commercial Construction',
    location: 'Tunis, Tunisia',
    experience: '10+ years',
    rating: 4.8,
    reviews: 42,
    completedProjects: 47,
    email: 'ahmed.bensalah@example.com',
    phone: '+216 XX XXX XXX',
    joinedDate: '2024-01-15',
    bio: 'Experienced construction professional with over 10 years in residential and commercial building. Specialized in modern construction techniques with a focus on quality, timely delivery, and client satisfaction. Successfully completed 47 projects ranging from small renovations to large-scale commercial developments.',
    skills: ['Construction Management', 'Concrete Work', 'Structural Framing', 'Project Planning', 'Quality Control', 'Budget Management'],
    certifications: ['Licensed General Contractor', 'OSHA Safety Certified', 'Project Management Professional'],
    portfolio: [
      { id: 1, title: 'Modern Villa - La Marsa', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', description: 'Luxury villa with modern architecture', year: '2025' },
      { id: 2, title: 'Commercial Complex - Sousse', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800', description: 'Multi-story commercial building', year: '2024' },
      { id: 3, title: 'Residential Apartments - Sfax', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800', description: '12-unit residential complex', year: '2024' },
      { id: 4, title: 'Office Renovation - Tunis', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800', description: 'Complete office space renovation', year: '2023' },
    ]
  };

  return (
    <div className="space-y-8">
      <Button variant="ghost" onClick={onBack} className="hover:bg-white rounded-xl">
        <ArrowLeft size={20} className="mr-2" />
        Back to Directory
      </Button>

      {/* Profile Header */}
      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-8">
          <Avatar className="w-32 h-32 ring-4 ring-white shadow-2xl">
            <AvatarFallback className="bg-primary text-white font-bold text-5xl">
              {artisan.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-3">{artisan.name}</h1>
                <p className="text-xl text-muted-foreground mb-4">{artisan.specialization}</p>
                
                <div className="flex flex-wrap gap-3 mb-4">
                  <Badge className="bg-primary/10 text-primary px-4 py-2 text-sm font-semibold border-0">
                    {artisan.domain}
                  </Badge>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/10">
                    <Star size={20} className="text-secondary fill-secondary" />
                    <span className="text-lg font-bold text-foreground">{artisan.rating}</span>
                    <span className="text-sm text-muted-foreground">({artisan.reviews} reviews)</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => onSendMessage(artisan.id)}
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
              >
                <MessageSquare size={20} className="mr-2" />
                Send Message
              </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-6 pt-6 border-t-2 border-gray-100">
              <div className="flex items-center gap-3">
                <MapPin size={20} className="text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Location</p>
                  <p className="font-bold text-foreground">{artisan.location}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Briefcase size={20} className="text-secondary" />
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Experience</p>
                  <p className="font-bold text-foreground">{artisan.experience}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Award size={20} className="text-accent" />
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Completed Projects</p>
                  <p className="font-bold text-foreground">{artisan.completedProjects}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-6">About</h2>
            <p className="text-muted-foreground leading-relaxed">{artisan.bio}</p>
          </Card>

          {/* Skills */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-6">Skills & Expertise</h2>
            <div className="flex flex-wrap gap-3">
              {artisan.skills.map((skill, index) => (
                <Badge
                  key={index}
                  className="bg-primary/10 text-primary px-4 py-2 text-sm font-semibold border-0"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </Card>

          {/* Certifications */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-6">Certifications</h2>
            <div className="space-y-3">
              {artisan.certifications.map((cert, index) => (
                <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-accent/5 to-accent/10 border-2 border-accent/20">
                  <Award size={24} className="text-accent mt-0.5" />
                  <span className="font-semibold text-foreground">{cert}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Portfolio */}
          <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-6">Portfolio</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {artisan.portfolio.map((project) => (
                <div key={project.id} className="group cursor-pointer">
                  <div className="relative aspect-video rounded-xl overflow-hidden mb-4 bg-gray-100">
                    <ImageWithFallback
                      src={project.image}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Badge className="absolute top-3 right-3 bg-white text-foreground border-0 px-3 py-1">
                      {project.year}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-foreground text-lg mb-2">{project.title}</h4>
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Information */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Contact Information</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail size={20} className="text-primary mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Email</p>
                  <p className="font-semibold text-foreground break-all">{artisan.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone size={20} className="text-secondary mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Phone</p>
                  <p className="font-semibold text-foreground">{artisan.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar size={20} className="text-accent mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Member Since</p>
                  <p className="font-semibold text-foreground">{artisan.joinedDate}</p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => onSendMessage(artisan.id)}
              className="w-full h-12 mt-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md"
            >
              <MessageSquare size={18} className="mr-2" />
              Send Message
            </Button>
          </Card>

          {/* Statistics */}
          <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
            <h3 className="text-xl font-bold text-foreground mb-6">Statistics</h3>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground font-medium">Rating</p>
                  <div className="flex items-center gap-2">
                    <Star size={18} className="text-secondary fill-secondary" />
                    <span className="text-xl font-bold text-foreground">{artisan.rating}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${(artisan.rating / 5) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">Reviews</p>
                <p className="text-3xl font-bold text-foreground">{artisan.reviews}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">Completed Projects</p>
                <p className="text-3xl font-bold text-primary">{artisan.completedProjects}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
