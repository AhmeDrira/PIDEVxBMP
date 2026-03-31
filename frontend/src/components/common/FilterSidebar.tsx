import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { SlidersHorizontal } from 'lucide-react';

interface FilterSidebarProps {
  categories: string[];
  onApplyFilters: (filters: KnowledgeFilters) => void;
  onClearFilters: () => void;
}

export interface KnowledgeFilters {
  categories: string[];
  dateRange: 'newest' | 'oldest' | 'alltime';
  viewsSort: 'most_viewed' | 'least_viewed' | 'default';
}

export default function FilterSidebar({
  categories,
  onApplyFilters,
  onClearFilters,
}: FilterSidebarProps) {
  const [filters, setFilters] = useState<KnowledgeFilters>({
    categories: [],
    dateRange: 'alltime',
    viewsSort: 'default',
  });

  const toggleCategory = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
  };

  const handleClear = () => {
    setFilters({
      categories: [],
      dateRange: 'alltime',
      viewsSort: 'default',
    });
    onClearFilters();
  };

  return (
    <Card className="p-6 bg-card rounded-2xl border border-border shadow-lg sticky top-8 border-t-4 border-t-primary max-h-[calc(100vh-6rem)] overflow-y-auto w-full max-w-full min-w-0">
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={20} className="text-primary" />
            <h3 className="text-xl font-bold text-foreground">Filters</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-primary">
            Clear All
          </Button>
        </div>

        <div>
          <Label className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 block">Category</Label>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {categories.map((category) => (
              <label key={category} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted/50 rounded-lg">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category)}
                  onChange={() => toggleCategory(category)}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">{category}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 block">Date Range</Label>
          <select
            value={filters.dateRange}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                dateRange: e.target.value as KnowledgeFilters['dateRange'],
              }))
            }
            className="w-full h-11 px-4 rounded-xl border-2 border-border bg-muted/50 focus:border-primary focus:bg-card transition-colors outline-none cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="alltime">AllTime</option>
          </select>
        </div>

        <div>
          <Label className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 block">Views</Label>
          <select
            value={filters.viewsSort}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                viewsSort: e.target.value as KnowledgeFilters['viewsSort'],
              }))
            }
            className="w-full h-11 px-4 rounded-xl border-2 border-border bg-muted/50 focus:border-primary focus:bg-card transition-colors outline-none cursor-pointer"
          >
            <option value="most_viewed">Les plus vus</option>
            <option value="least_viewed">Les moins vus</option>
            <option value="default">default</option>
          </select>
        </div>

        <div className="flex gap-3 pt-4 border-t-2 border-border">
          <Button onClick={handleClear} variant="outline" className="flex-1 h-12 rounded-xl border-2">
            Réinitialiser
          </Button>
          <Button onClick={handleApply} className="flex-1 h-12 text-white bg-primary hover:bg-primary/90 rounded-xl shadow-md">
            Appliquer
          </Button>
        </div>
      </div>
    </Card>
  );
}
