import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ArrowLeft, Upload, Trash2 } from 'lucide-react';

interface EditProductProps {
  productId: number;
  onBack: () => void;
  onSave: (productData: any) => void;
}

export default function EditProduct({ productId, onBack, onSave }: EditProductProps) {
  const [formData, setFormData] = useState({
    name: 'Premium Cement - 50kg',
    category: 'Building Materials',
    price: 45,
    stock: 150,
    description: 'High-quality Portland cement suitable for all types of construction projects.',
    specifications: 'Weight: 50kg\nType: Portland Cement\nGrade: Grade 42.5',
  });
  const [images, setImages] = useState<string[]>(['product1.jpg', 'product2.jpg']);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onBack();
  };

  return (
    <div className="space-y-8">
      <Button variant="ghost" onClick={onBack} className="hover:bg-white rounded-xl">
        <ArrowLeft size={20} className="mr-2" />
        Back to Products
      </Button>

      <Card className="p-10 bg-white rounded-2xl border-0 shadow-lg max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-foreground mb-8">Edit Product</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base font-semibold">Product Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="category" className="text-base font-semibold">Category</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              >
                <option>Building Materials</option>
                <option>Construction Steel</option>
                <option>Finishing Materials</option>
                <option>Electrical</option>
                <option>Plumbing</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price" className="text-base font-semibold">Price (TND)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock" className="text-base font-semibold">Stock Quantity</Label>
            <Input
              id="stock"
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-base font-semibold">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="specifications" className="text-base font-semibold">Technical Specifications</Label>
            <Textarea
              id="specifications"
              value={formData.specifications}
              onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
              rows={6}
              placeholder="Enter specifications (one per line)"
              className="rounded-xl border-2 border-gray-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Product Images</Label>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {images.map((image, index) => (
                <div key={index} className="relative aspect-square rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50">
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    {image}
                  </div>
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, i) => i !== index))}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-destructive text-white hover:bg-destructive/90"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-primary transition-colors bg-gray-50">
              <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground mb-2">Upload Product Images</p>
              <p className="text-xs text-muted-foreground mb-3">PNG, JPG (Max 5MB each)</p>
              <Input
                type="file"
                accept="image/*"
                multiple
                className="max-w-xs mx-auto"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
            >
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
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
