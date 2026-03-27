import React from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Check, SlidersHorizontal, X } from 'lucide-react';

export interface KnowledgeFilterState {
  categories: string[];
  dateRange: {
    type: 'today' | 'week' | 'month' | 'year' | 'custom' | null;
    startDate?: string;
    endDate?: string;
  };
  readTime: {
    type: 'less5' | '5-10' | '10-15' | 'more15' | null;
  };
  sortBy: 'views_desc' | 'views_asc' | 'date_desc' | 'date_asc' | 'likes_desc' | null;
}

interface FilterDrawerProps {
  isOpen: boolean;
  filters: KnowledgeFilterState;
  categories: string[];
  onChange: (filters: KnowledgeFilterState) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}

const dateOptions: Array<{ id: KnowledgeFilterState['dateRange']['type']; label: string }> = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'week', label: 'Cette semaine' },
  { id: 'month', label: 'Ce mois' },
  { id: 'year', label: 'Cette année' },
  { id: 'custom', label: 'Personnalisé' },
];

const readTimeOptions: Array<{ id: KnowledgeFilterState['readTime']['type']; label: string }> = [
  { id: 'less5', label: 'Moins de 5 min' },
  { id: '5-10', label: '5-10 min' },
  { id: '10-15', label: '10-15 min' },
  { id: 'more15', label: 'Plus de 15 min' },
];

const sortOptions: Array<{ id: KnowledgeFilterState['sortBy']; label: string }> = [
  { id: 'views_desc', label: 'Les plus vus' },
  { id: 'views_asc', label: 'Moins vus' },
  { id: 'date_desc', label: 'Date (plus récent)' },
  { id: 'date_asc', label: 'Date (plus ancien)' },
  { id: 'likes_desc', label: 'Likes (décroissant)' },
];

function toggleCategory(categories: string[], category: string) {
  if (categories.includes(category)) return categories.filter((c) => c !== category);
  return [...categories, category];
}

export default function FilterDrawer({
  isOpen,
  filters,
  categories,
  onChange,
  onApply,
  onReset,
  onClose,
}: FilterDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close filters overlay"
      />

      <div className="absolute left-0 top-0 h-full w-80 max-w-[90vw] animate-in slide-in-from-left-6 duration-200">
        <Card className="h-full rounded-none md:rounded-r-2xl border-0 shadow-2xl bg-white p-6 flex flex-col border-t-4 border-t-primary">
          <div className="flex items-center justify-between mb-6 border-b pb-4">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal size={20} className="text-primary" />
              Filters
            </h3>
            <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-100">
              <X size={18} />
            </Button>
          </div>

          <div className="space-y-6 overflow-y-auto pr-1 flex-1">
            <div className="space-y-3">
              <Label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Category</Label>
              <div className="space-y-2">
                {categories.map((category) => {
                  const checked = filters.categories.includes(category);
                  return (
                    <label key={category} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          checked ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-primary'
                        }`}
                      >
                        {checked && <Check size={12} className="text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onChange({
                            ...filters,
                            categories: toggleCategory(filters.categories, category),
                          })
                        }
                        className="hidden"
                      />
                      <span className="text-sm text-foreground select-none">{category}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Date Range</Label>
              <div className="space-y-2">
                {dateOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="dateRange"
                      checked={filters.dateRange.type === option.id}
                      onChange={() =>
                        onChange({
                          ...filters,
                          dateRange: {
                            ...filters.dateRange,
                            type: option.id,
                          },
                        })
                      }
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
              {filters.dateRange.type === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.dateRange.startDate || ''}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        dateRange: {
                          ...filters.dateRange,
                          startDate: e.target.value,
                        },
                      })
                    }
                    className="h-10 px-2 rounded-lg border-2 border-gray-200"
                  />
                  <input
                    type="date"
                    value={filters.dateRange.endDate || ''}
                    onChange={(e) =>
                      onChange({
                        ...filters,
                        dateRange: {
                          ...filters.dateRange,
                          endDate: e.target.value,
                        },
                      })
                    }
                    className="h-10 px-2 rounded-lg border-2 border-gray-200"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Read Time</Label>
              <div className="space-y-2">
                {readTimeOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="readTime"
                      checked={filters.readTime.type === option.id}
                      onChange={() =>
                        onChange({
                          ...filters,
                          readTime: { type: option.id },
                        })
                      }
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Views / Sorting</Label>
              <div className="space-y-2">
                {sortOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sortBy"
                      checked={filters.sortBy === option.id}
                      onChange={() =>
                        onChange({
                          ...filters,
                          sortBy: option.id,
                        })
                      }
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t mt-4 flex items-center gap-2">
            <Button variant="outline" className="flex-1 rounded-xl border-2" onClick={onReset}>
              Réinitialiser
            </Button>
            <Button className="flex-1 rounded-xl text-white bg-primary hover:bg-primary/90" onClick={onApply}>
              Appliquer
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

