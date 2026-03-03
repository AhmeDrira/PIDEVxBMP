import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Search, Filter, MapPin, Star, MessageSquare, Briefcase } from 'lucide-react';
import { Badge } from '../ui/badge';

interface ExpertArtisanDirectoryProps {
  onNavigate: (view: string) => void;
}

export default function ExpertArtisanDirectory({ onNavigate }: ExpertArtisanDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const artisans = [
    {
      id: 1,
      name: 'Ahmed Ben Salah',
      specialization: 'General Construction',
      location: 'Tunis',
      rating: 4.8,
      reviews: 42,
      experience: '10+ years',
      completedProjects: 47,
      bio: 'Experienced in residential and commercial construction with focus on quality and timely delivery.',
      skills: ['Construction', 'Renovation', 'Project Management']
    },
    {
      id: 2,
      name: 'Fatma Hamdi',
      specialization: 'Interior Design & Finishing',
      location: 'Sousse',
      rating: 4.9,
      reviews: 38,
      experience: '8 years',
      completedProjects: 35,
      bio: 'Specialized in modern interior design and high-quality finishing work.',
      skills: ['Interior Design', 'Finishing', 'Decoration']
    },
    {
      id: 3,
      name: 'Youssef Trabelsi',
      specialization: 'Electrical Systems',
      location: 'Sfax',
      rating: 4.7,
      reviews: 51,
      experience: '12 years',
      completedProjects: 62,
      bio: 'Expert in electrical installation and maintenance for residential and commercial buildings.',
      skills: ['Electrical', 'Wiring', 'Systems Integration']
    },
    {
      id: 4,
      name: 'Leila Gharbi',
      specialization: 'Plumbing & Sanitation',
      location: 'Tunis',
      rating: 4.6,
      reviews: 29,
      experience: '7 years',
      completedProjects: 33,
      bio: 'Professional plumbing services with expertise in modern sanitation systems.',
      skills: ['Plumbing', 'Sanitation', 'Water Systems']
    },
    {
      id: 5,
      name: 'Karim Jebali',
      specialization: 'Structural Engineering',
      location: 'Monastir',
      rating: 4.9,
      reviews: 44,
      experience: '15+ years',
      completedProjects: 58,
      bio: 'Structural engineer specialized in complex building projects and renovations.',
      skills: ['Structural Design', 'Engineering', 'Analysis']
    },
    {
      id: 6,
      name: 'Sonia Mahjoub',
      specialization: 'Painting & Decoration',
      location: 'Nabeul',
      rating: 4.8,
      reviews: 36,
      experience: '6 years',
      completedProjects: 41,
      bio: 'Creative painting and decoration specialist with attention to detail.',
      skills: ['Painting', 'Decoration', 'Color Consultation']
    },
  ];

  const filteredArtisans = artisans.filter(artisan =>
    artisan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    artisan.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
    artisan.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Artisan Directory</h1>
        <p className="text-lg text-muted-foreground">Connect with skilled construction professionals</p>
      </div>

      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search by name, skill, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
            />
          </div>
          <Button variant="outline" className="h-12 px-6 rounded-xl border-2">
            <Filter size={20} className="mr-2" />
            Filter
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {filteredArtisans.map((artisan) => (
          <Card key={artisan.id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start gap-4 mb-4">
              <Avatar className="w-16 h-16 ring-4 ring-white shadow-lg">
                <AvatarFallback className="bg-primary text-white font-bold text-xl">
                  {artisan.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground mb-2">{artisan.name}</h3>
                <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <Briefcase size={14} />
                  {artisan.specialization}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin size={14} />
                    {artisan.location}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star size={14} className="text-secondary fill-secondary" />
                    <span className="font-semibold text-foreground">{artisan.rating}</span>
                    <span>({artisan.reviews})</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {artisan.bio}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Experience</p>
                <p className="text-sm font-bold text-foreground">{artisan.experience}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Projects</p>
                <p className="text-sm font-bold text-foreground">{artisan.completedProjects}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {artisan.skills.map((skill) => (
                <Badge
                  key={skill}
                  className="bg-primary/10 text-primary px-3 py-1 text-xs font-semibold border-0"
                >
                  {skill}
                </Badge>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 h-11 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md"
                onClick={() => onNavigate('messages')}
              >
                <MessageSquare size={16} className="mr-2" />
                Contact
              </Button>
              <Button variant="outline" className="h-11 px-6 rounded-xl border-2">
                View Profile
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
