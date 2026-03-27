import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ArrowRight, Upload, Save, X } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface EditProductPageProps {
  productId?: string;
  onBack?: () => void;
  onSave?: (data: any) => void;
}

export default function EditProductPage({ productId, onBack, onSave }: EditProductPageProps) {
  // Mock product data - in real app this would come from API/props
  const [formData, setFormData] = useState({
    name: 'Premium Cement - 50kg',
    category: 'Building Materials',
    price: 45,
    description: 'High-quality premium cement suitable for all types of construction work. Our cement offers excellent binding properties and durability.',
    stock: 150,
  });

  const [productImages, setProductImages] = useState([
    'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=400&h=300&fit=crop',
    'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&h=300&fit=crop',
  ]);

  const [newImageFile, setNewImageFile] = useState<string>('');

  const categories = [
    'Building Materials',
    'Construction Steel',
    'Finishing Materials',
    'Electrical',
    'Plumbing',
    'Carpentry',
    'Insulation',
    'Tools & Equipment'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      onSave({ ...formData, images: productImages });
    }
    alert('Product updated successfully!');
    if (onBack) onBack();
  };

  const removeImage = (index: number) => {
    setProductImages(productImages.filter((_, i) => i !== index));
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
          Back to Products
        </Button>
      )}

      <Card className="p-8 bg-white rounded-2xl border-0 shadow-lg">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Edit Product</h1>
          <p className="text-lg text-muted-foreground">Update product details and inventory</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base font-semibold text-foreground">
              Product Name *
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., Premium Cement - 50kg"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-base font-semibold text-foreground">
                Category *
              </Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:outline-none"
                required
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price" className="text-base font-semibold text-foreground">
                Price (TND) *
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
                required
              />
            </div>
          </div>

          {/* Stock */}
          <div className="space-y-2">
            <Label htmlFor="stock" className="text-base font-semibold text-foreground">
              Stock Quantity *
            </Label>
            <Input
              id="stock"
              type="number"
              placeholder="0"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
              className="h-12 rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
            <p className="text-sm text-muted-foreground">Current stock level available for sale</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-base font-semibold text-foreground">
              Product Description *
            </Label>
            <Textarea
              id="description"
              placeholder="Detailed product description..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              className="rounded-xl border-2 border-gray-200 focus:border-primary"
              required
            />
          </div>

          {/* Product Images */}
          <div className="space-y-4">
            <Label className="text-base font-semibold text-foreground">
              Product Images
            </Label>

            {/* Current Images */}
            {productImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {productImages.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <div className="aspect-video rounded-xl overflow-hidden border-2 border-gray-200">
                      <ImageWithFallback
                        src={img}
                        alt={`Product image ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-destructive/90"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Image */}
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-primary transition-colors bg-gray-50">
              <Upload size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-base font-medium text-foreground mb-2">
                {newImageFile || 'Upload new product image'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                JPG, PNG (Max 5MB per image)
              </p>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setNewImageFile(e.target.files?.[0]?.name || '')}
                className="max-w-xs mx-auto"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="h-12 px-8 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
            >
              <Save size={20} className="mr-2" />
              Save Changes
            </Button>
            {onBack && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onBack}
                className="h-12 px-8 rounded-xl border-2"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
