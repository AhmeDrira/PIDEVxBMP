import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Search, Filter, MapPin, Star, MessageSquare, Briefcase } from 'lucide-react';
import { Badge } from '../ui/badge';
import ViewArtisanProfile from './ViewArtisanProfile';

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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ExpertArtisanDirectory({ onNavigate }: ExpertArtisanDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtisanId, setSelectedArtisanId] = useState<string | null>(null);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fonction pour récupérer le token correctement
  const getToken = () => {
    let token: string | null = localStorage.getItem('token');
    const userStorage = localStorage.getItem('user');
    if (!token && userStorage) {
      const parsedUser = JSON.parse(userStorage);
      token = parsedUser.token;
    }
    console.log('Retrieved token:', token); // <-- console log pour vérifier le token
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
      console.log('Artisans API response:', response.data); // <-- console log pour vérifier la réponse

      const data = Array.isArray(response.data) ? response.data : [];

      const randomInt = (min: number, max: number) =>
        Math.floor(Math.random() * (max - min + 1)) + min;

      const mappedArtisans: Artisan[] = data.map((item: any) => ({
        id: item._id,
        name: `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim(),
        specialization: item.domain,
        location: item.location,
        experience: `${item.yearsExperience ?? 0} years`,
        bio: item.bio,
        rating: 4.8,
        reviews: randomInt(20, 60),
        completedProjects: randomInt(30, 100),
        skills: ['Construction', 'Project Management', 'Renovation'],
      }));

      setArtisans(mappedArtisans);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to load artisans';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtisans();
  }, [searchQuery]);

  const handleContact = async (artisanId: string) => {
    try {
      const token = getToken();
      console.log('Token used for creating conversation:', token);
      if (!token) {
        alert('Please login first');
        return;
      }
  
      console.log('Creating conversation with artisanId:', artisanId);
  
      const response = await axios.post(
        `${API_URL}/conversations`,
        { participantId: artisanId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      console.log('Conversation response:', response.data);
  
      const conversation = response.data;
      localStorage.setItem('selectedConversationId', conversation._id || conversation.id);
  
      onNavigate('messages');
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        console.error('Axios error:', err.response?.data || err.message);
        alert(`Failed to create conversation: ${err.response?.data?.message || err.message}`);
      } else {
        console.error('Unknown error:', err);
        alert('Failed to create conversation: Unknown error');
      }
    }
  };

  if (selectedArtisanId) {
    return (
      <ViewArtisanProfile
        artisanId={selectedArtisanId}
        onBack={() => setSelectedArtisanId(null)}
        onContact={() => handleContact(selectedArtisanId)}
      />
    );
  }

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

      {loading && <p className="text-sm text-muted-foreground">Loading artisans...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid md:grid-cols-2 gap-6">
        {artisans.map((artisan) => (
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

            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{artisan.bio}</p>

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
                onClick={() => handleContact(artisan.id)}
              >
                <MessageSquare size={16} className="mr-2" />
                Contact
              </Button>
              <Button 
                variant="outline" 
                className="h-11 px-6 rounded-xl border-2"
                onClick={() => setSelectedArtisanId(artisan.id)}
              >
                View Profile
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}