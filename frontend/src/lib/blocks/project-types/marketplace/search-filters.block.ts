import type { BlockContext, BlockResult } from '../../types';
import { createDesignTokens } from '../../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/MarketplaceFilters.tsx': `'use client';

import { useState } from 'react';
import { SlidersHorizontal, X, ChevronDown, RotateCcw } from 'lucide-react';

export interface FilterValues {
  category: string;
  minPrice: string;
  maxPrice: string;
  sortBy: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'rating';
  location: string;
}

interface MarketplaceFiltersProps {
  onFilterChange: (filters: FilterValues) => void;
  categories?: string[];
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
] as const;

const DEFAULT_CATEGORIES = [
  'All Categories',
  'Electronics',
  'Services',
  'Digital Products',
  'Home & Garden',
  'Fashion',
  'Sports',
  'Other',
];

export default function MarketplaceFilters({
  onFilterChange,
  categories = DEFAULT_CATEGORIES,
}: MarketplaceFiltersProps) {
  const [filters, setFilters] = useState<FilterValues>({
    category: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'newest',
    location: '',
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const updateFilter = (key: keyof FilterValues, value: string) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    onFilterChange(updated);
  };

  const resetFilters = () => {
    const defaults: FilterValues = {
      category: '',
      minPrice: '',
      maxPrice: '',
      sortBy: 'newest',
      location: '',
    };
    setFilters(defaults);
    onFilterChange(defaults);
  };

  const hasActiveFilters =
    filters.category || filters.minPrice || filters.maxPrice || filters.sortBy !== 'newest' || filters.location;

  const filterContent = (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: '${t.text}' }}>
          Category
        </label>
        <div className="relative">
          <select
            value={filters.category}
            onChange={(e) => updateFilter('category', e.target.value)}
            className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl border focus:outline-none focus:ring-2 cursor-pointer"
            style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
          >
            <option value="">All Categories</option>
            {categories
              .filter((c) => c !== 'All Categories')
              .map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: '${t.text50}' }}
          />
        </div>
      </div>

      {/* Price Range */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: '${t.text}' }}>
          Price Range
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => updateFilter('minPrice', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-sm"
            style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
          />
          <span className="text-sm" style={{ color: '${t.text50}' }}>—</span>
          <input
            type="number"
            min="0"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => updateFilter('maxPrice', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-sm"
            style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
          />
        </div>
      </div>

      {/* Sort By */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: '${t.text}' }}>
          Sort By
        </label>
        <div className="relative">
          <select
            value={filters.sortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value)}
            className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl border focus:outline-none focus:ring-2 cursor-pointer"
            style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: '${t.text50}' }}
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: '${t.text}' }}>
          Location
        </label>
        <input
          type="text"
          placeholder="Any location"
          value={filters.location}
          onChange={(e) => updateFilter('location', e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-sm"
          style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
        />
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-white/5"
          style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}
        >
          <RotateCcw className="w-4 h-4" />
          Reset Filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium mb-4"
        style={{ borderColor: '${t.primary40}', color: '${t.text}' }}
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filters
        {hasActiveFilters && (
          <span className="w-2 h-2 rounded-full" style={{ background: '${t.accent}' }} />
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div
            className="absolute right-0 top-0 h-full w-80 max-w-[85vw] p-6 overflow-y-auto"
            style={{ background: '${t.bg}' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ fontFamily: '${t.headingFont}' }}>
                Filters
              </h2>
              <button onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5" style={{ color: '${t.text70}' }} />
              </button>
            </div>
            {filterContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div
          className="sticky top-6 rounded-2xl border p-5"
          style={{ borderColor: '${t.primary20}', background: '${t.primary10}' }}
        >
          <h2 className="text-lg font-semibold mb-5 flex items-center gap-2"
              style={{ fontFamily: '${t.headingFont}', color: '${t.text}' }}>
            <SlidersHorizontal className="w-5 h-5" style={{ color: '${t.primary}' }} />
            Filters
          </h2>
          {filterContent}
        </div>
      </div>
    </>
  );
}
`,
  };
}
