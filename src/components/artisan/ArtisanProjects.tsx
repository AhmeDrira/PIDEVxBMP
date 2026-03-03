import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Search, Filter, MapPin, Calendar, DollarSign, Eye, Edit, ShoppingCart, FileText, Receipt, ArrowRight, TrendingUp } from 'lucide-react';
import { Badge } from '../ui/badge';

export default function ArtisanProjects() {
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const projects = [
    {
      id: 1,
      title: 'Villa Construction - Tunis',
      description: 'Complete villa construction with modern architecture and sustainable materials',
      location: 'La Marsa, Tunis',
      startDate: '2026-01-15',
      endDate: '2026-06-15',
      budget: 150000,
      status: 'active',
      progress: 65,
      priority: 'high'
    },
    {
      id: 2,
      title: 'Office Renovation',
      description: 'Full office space renovation and modernization',
      location: 'Centre Ville, Tunis',
      startDate: '2026-02-01',
      endDate: '2026-04-20',
      budget: 45000,
      status: 'active',
      progress: 30,
      priority: 'medium'
    },
    {
      id: 3,
      title: 'Apartment Restoration',
      description: 'Historic apartment restoration project',
      location: 'Sousse',
      startDate: '2026-03-01',
      endDate: '2026-08-10',
      budget: 80000,
      status: 'pending',
      progress: 10,
      priority: 'low'
    },
    {
      id: 4,
      title: 'Shopping Mall Extension',
      description: 'Extension and modernization of shopping complex',
      location: 'Sfax',
      startDate: '2025-11-01',
      endDate: '2026-01-30',
      budget: 250000,
      status: 'completed',
      progress: 100,
      priority: 'high'
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-accent/10 text-accent border-accent/20';
      case 'pending': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'completed': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filteredProjects = projects.filter(project =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (view === 'create') {
    return (
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="outline" 
          onClick={() => setView('list')} 
          className="mb-6 rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Projects
        </Button>
        <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg">
          <h2 className="text-3xl font-bold text-foreground mb-8">Create New Project</h2>
          <form className="space-y-6" onSubmit={(e) => {
            e.preventDefault();
            setView('list');
          }}>
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-semibold">Project Title</Label>
              <Input 
                id="title" 
                placeholder="Enter project title" 
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your project..."
                rows={4}
                className="rounded-xl border-2 border-gray-200 focus:border-primary"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="location" className="text-base font-semibold">Location</Label>
                <Input 
                  id="location" 
                  placeholder="City, Region" 
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget" className="text-base font-semibold">Estimated Budget (TND)</Label>
                <Input 
                  id="budget" 
                  type="number" 
                  placeholder="0.00" 
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-base font-semibold">Start Date</Label>
                <Input 
                  id="startDate" 
                  type="date" 
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-base font-semibold">End Date</Label>
                <Input 
                  id="endDate" 
                  type="date" 
                  className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                  required 
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
              >
                Create Project
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setView('list')}
                className="h-12 px-8 rounded-xl border-2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  if (view === 'details' && selectedProject) {
    return (
      <div className="space-y-6">
        <Button 
          variant="outline" 
          onClick={() => setView('list')} 
          className="rounded-xl border-2"
        >
          <ArrowRight size={20} className="mr-2 rotate-180" />
          Back to Projects
        </Button>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-foreground mb-3">{selectedProject.title}</h2>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusColor(selectedProject.status)} px-4 py-1.5 text-sm font-semibold border-2`}>
                      {selectedProject.status.charAt(0).toUpperCase() + selectedProject.status.slice(1)}
                    </Badge>
                    <Badge className={`${getPriorityColor(selectedProject.priority)} px-4 py-1.5 text-sm font-semibold border-2`}>
                      {selectedProject.priority}
                    </Badge>
                  </div>
                </div>
                <Button variant="outline" className="rounded-xl border-2">
                  <Edit size={16} className="mr-2" />
                  Edit
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-foreground mb-3">Description</h4>
                  <p className="text-muted-foreground leading-relaxed">{selectedProject.description}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 pt-6 border-t-2 border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MapPin size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Location</p>
                      <p className="text-foreground font-semibold">{selectedProject.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                      <DollarSign size={24} className="text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Budget</p>
                      <p className="text-foreground font-semibold">{selectedProject.budget.toLocaleString()} TND</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                      <Calendar size={24} className="text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Start Date</p>
                      <p className="text-foreground font-semibold">{selectedProject.startDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                      <Calendar size={24} className="text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">End Date</p>
                      <p className="text-foreground font-semibold">{selectedProject.endDate}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-foreground">Project Progress</h4>
                    <span className="text-4xl font-bold text-primary">{selectedProject.progress}%</span>
                  </div>
                  <div className="h-4 rounded-full overflow-hidden bg-gray-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                      style={{ width: `${selectedProject.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
              <h3 className="text-xl font-bold text-foreground mb-6">Quick Actions</h3>
              <div className="space-y-3">
                <Button className="w-full h-12 justify-start text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-md">
                  <ShoppingCart size={18} className="mr-2" />
                  Buy Materials
                </Button>
                <Button className="w-full h-12 justify-start text-white bg-accent hover:bg-accent/90 rounded-xl shadow-md">
                  <FileText size={18} className="mr-2" />
                  Create Quote
                </Button>
                <Button className="w-full h-12 justify-start text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md">
                  <Receipt size={18} className="mr-2" />
                  Generate Invoice
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">My Projects</h1>
          <p className="text-lg text-muted-foreground">Manage and track all your construction projects</p>
        </div>
        <Button
          onClick={() => setView('create')}
          className="h-12 px-6 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
        >
          <Plus size={20} className="mr-2" />
          Create Project
        </Button>
      </div>

      {/* Search and Filter */}
      <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search projects..."
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

      {/* Projects Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground mb-3">{project.title}</h3>
                <div className="flex items-center gap-2">
                  <Badge className={`${getStatusColor(project.status)} px-3 py-1 text-xs font-semibold border-2`}>
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </Badge>
                  <Badge className={`${getPriorityColor(project.priority)} px-3 py-1 text-xs font-semibold border-2`}>
                    {project.priority}
                  </Badge>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground mb-6 leading-relaxed">
              {project.description}
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <MapPin size={16} className="text-primary" />
                {project.location}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <DollarSign size={16} className="text-accent" />
                Budget: <strong className="text-foreground">{project.budget.toLocaleString()} TND</strong>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Calendar size={16} className="text-secondary" />
                {project.startDate} - {project.endDate}
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Progress</span>
                <span className="text-2xl font-bold text-primary">{project.progress}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden bg-gray-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-2 hover:bg-primary hover:text-white hover:border-primary"
                onClick={() => {
                  setSelectedProject(project);
                  setView('details');
                }}
              >
                <Eye size={16} className="mr-2" />
                View
              </Button>
              <Button variant="outline" className="h-11 px-4 rounded-xl border-2 hover:bg-primary hover:text-white hover:border-primary">
                <Edit size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
