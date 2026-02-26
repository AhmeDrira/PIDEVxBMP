import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Building2, Mail, Phone, MapPin, Save, Upload } from 'lucide-react';

export default function ManufacturerProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    companyName: 'BuildMaster Ltd',
    email: 'contact@buildmaster.com',
    phone: '+216 71 123 456',
    location: 'Industrial Zone, Tunis',
    description: 'Leading construction materials supplier with over 15 years of experience.',
    certificationNumber: 'CERT-TN-2010-1234',
  });

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl mb-2" style={{ color: '#111827' }}>{formData.companyName}</h2>
            <p style={{ color: '#6B7280' }}>Verified Manufacturer</p>
          </div>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? 'outline' : 'default'}
            className={isEditing ? '' : 'text-white'}
            style={isEditing ? {} : { backgroundColor: '#1F3A8A' }}
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </Button>
        </div>

        {isEditing ? (
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); setIsEditing(false); }}>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Update Certification</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center" style={{ borderColor: '#E5E7EB' }}>
                <Upload size={32} className="mx-auto mb-2" style={{ color: '#6B7280' }} />
                <Input type="file" accept=".pdf,.doc,.docx" />
              </div>
            </div>
            <Button type="submit" className="text-white" style={{ backgroundColor: '#10B981' }}>
              <Save size={20} className="mr-2" />
              Save Changes
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Company Name</p>
                <p style={{ color: '#111827' }}>{formData.companyName}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Email</p>
                <p style={{ color: '#111827' }}>{formData.email}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Phone</p>
                <p style={{ color: '#111827' }}>{formData.phone}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Location</p>
                <p style={{ color: '#111827' }}>{formData.location}</p>
              </div>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Description</p>
              <p style={{ color: '#111827' }}>{formData.description}</p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#6B7280' }}>Certification Number</p>
              <p style={{ color: '#111827' }}>{formData.certificationNumber}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
