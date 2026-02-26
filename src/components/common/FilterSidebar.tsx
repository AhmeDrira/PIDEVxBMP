import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { X, SlidersHorizontal } from 'lucide-react';
import { Badge } from '../ui/badge';

interface FilterSidebarProps {
  categories: string[];
  manufacturers: string[];
  onApplyFilters: (filters: FilterState) => void;
  onClearFilters: () => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export interface FilterState {
  categories: string[];
  priceMin: string;
  priceMax: string;
  manufacturers: string[];
  minRating: number;
  inStockOnly: boolean;
}

export default function FilterSidebar({ 
  categories, 
  manufacturers, 
  onApplyFilters, 
  onClearFilters,
  isMobile = false,
  isOpen = false,
  onClose
}: FilterSidebarProps) {
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    priceMin: '',
    priceMax: '',
    manufacturers: [],
    minRating: 0,
    inStockOnly: false,
  });

  const toggleCategory = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const toggleManufacturer = (manufacturer: string) => {
    setFilters(prev => ({
      ...prev,
      manufacturers: prev.manufacturers.includes(manufacturer)
        ? prev.manufacturers.filter(m => m !== manufacturer)
        : [...prev.manufacturers, manufacturer]
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    if (isMobile && onClose) onClose();
  };

  const handleClear = () => {
    setFilters({
      categories: [],
      priceMin: '',
      priceMax: '',
      manufacturers: [],
      minRating: 0,
      inStockOnly: false,
    });
    onClearFilters();
    if (isMobile && onClose) onClose();
  };

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={20} className="text-primary" />
          <h3 className="text-xl font-bold text-foreground">Filters</h3>
        </div>
        {isMobile && onClose && (
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Category */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Category</Label>
        <div className="space-y-2">
          {categories.map((category) => (
            <label key={category} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={filters.categories.includes(category)}
                onChange={() => toggleCategory(category)}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{category}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Price Range (TND)</Label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            placeholder="Min"
            value={filters.priceMin}
            onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
            className="h-11 rounded-xl border-2 border-gray-200"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="number"
            placeholder="Max"
            value={filters.priceMax}
            onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
            className="h-11 rounded-xl border-2 border-gray-200"
          />
        </div>
      </div>

      {/* Manufacturer */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Manufacturer</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {manufacturers.map((manufacturer) => (
            <label key={manufacturer} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={filters.manufacturers.includes(manufacturer)}
                onChange={() => toggleManufacturer(manufacturer)}
                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{manufacturer}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Minimum Rating</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              onClick={() => setFilters({ ...filters, minRating: rating })}
              className={`flex-1 h-11 rounded-xl border-2 font-semibold transition-all ${
                filters.minRating === rating
                  ? 'bg-secondary text-white border-secondary'
                  : 'border-gray-200 text-foreground hover:border-secondary'
              }`}
            >
              {rating}★
            </button>
          ))}
        </div>
      </div>

      {/* Availability */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer p-3 hover:bg-gray-50 rounded-xl">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => setFilters({ ...filters, inStockOnly: e.target.checked })}
            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-foreground">In Stock Only</span>
        </label>
      </div>

      {/* Active Filters */}
      {(filters.categories.length > 0 || filters.manufacturers.length > 0 || filters.minRating > 0) && (
        <div>
          <Label className="text-base font-semibold mb-3 block">Active Filters</Label>
          <div className="flex flex-wrap gap-2">
            {filters.categories.map((cat) => (
              <Badge key={cat} className="bg-primary/10 text-primary px-3 py-1 border-0">
                {cat}
                <button onClick={() => toggleCategory(cat)} className="ml-2">
                  <X size={14} />
                </button>
              </Badge>
            ))}
            {filters.manufacturers.map((man) => (
              <Badge key={man} className="bg-secondary/10 text-secondary px-3 py-1 border-0">
                {man}
                <button onClick={() => toggleManufacturer(man)} className="ml-2">
                  <X size={14} />
                </button>
              </Badge>
            ))}
            {filters.minRating > 0 && (
              <Badge className="bg-accent/10 text-accent px-3 py-1 border-0">
                {filters.minRating}★ & up
                <button onClick={() => setFilters({ ...filters, minRating: 0 })} className="ml-2">
                  <X size={14} />
                </button>
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t-2 border-gray-100">
        <Button
          onClick={handleClear}
          variant="outline"
          className="flex-1 h-12 rounded-xl border-2"
        >
          Clear All
        </Button>
        <Button
          onClick={handleApply}
          className="flex-1 h-12 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md"
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl overflow-y-auto">
              <div className="p-6">
                <FilterContent />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg sticky top-8">
      <FilterContent />
    </Card>
  );
}
