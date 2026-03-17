import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/ProductCatalog.tsx': `'use client';

import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, Grid3X3, List, ChevronDown, Star, ShoppingCart } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  oldPrice?: number;
  image?: string;
  category?: string;
  rating?: number;
  badge?: string;
  inStock?: boolean;
}

interface ProductCatalogProps {
  products: Product[];
  categories?: string[];
  currency?: string;
  onAddToCart?: (product: Product) => void;
  onProductClick?: (product: Product) => void;
}

export default function ProductCatalog({
  products,
  categories = [],
  currency = '₽',
  onAddToCart,
  onProductClick,
}: ProductCatalogProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'default' | 'price_asc' | 'price_desc' | 'rating'>('default');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, Infinity]);
  const [showFilters, setShowFilters] = useState(false);

  const allCategories = useMemo(() => {
    if (categories.length > 0) return categories;
    return Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  }, [products, categories]);

  const maxPrice = useMemo(() => Math.max(...products.map(p => p.price), 0), [products]);

  const filtered = useMemo(() => {
    let result = [...products];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }

    if (category !== 'all') {
      result = result.filter(p => p.category === category);
    }

    if (priceRange[1] < Infinity) {
      result = result.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    }

    if (sort === 'price_asc') result.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') result.sort((a, b) => b.price - a.price);
    else if (sort === 'rating') result.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return result;
  }, [products, search, category, sort, priceRange]);

  return (
    <div className="space-y-4">
      {/* Search + controls */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '${t.text50}' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск товаров..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm"
            style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2.5 rounded-xl border text-sm flex items-center gap-1.5"
          style={{ borderColor: '${t.primary40}', color: '${t.text70}' }}
        >
          <SlidersHorizontal className="w-4 h-4" /> Фильтры
        </button>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as any)}
          className="px-3 py-2.5 rounded-xl border text-sm"
          style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
        >
          <option value="default">По умолчанию</option>
          <option value="price_asc">Цена ↑</option>
          <option value="price_desc">Цена ↓</option>
          <option value="rating">По рейтингу</option>
        </select>
        <div className="flex border rounded-xl overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
          <button onClick={() => setView('grid')} className="p-2.5" style={{ background: view === 'grid' ? '${t.primary10}' : 'transparent', color: view === 'grid' ? '${t.primary}' : '${t.text50}' }}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setView('list')} className="p-2.5" style={{ background: view === 'list' ? '${t.primary10}' : 'transparent', color: view === 'list' ? '${t.primary}' : '${t.text50}' }}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category filters */}
      {showFilters && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategory('all')}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
            style={{
              borderColor: category === 'all' ? '${t.primary}' : '${t.primary40}',
              background: category === 'all' ? '${t.primary10}' : 'transparent',
              color: category === 'all' ? '${t.primary}' : '${t.text70}',
            }}
          >
            Все
          </button>
          {allCategories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
              style={{
                borderColor: category === c ? '${t.primary}' : '${t.primary40}',
                background: category === c ? '${t.primary10}' : 'transparent',
                color: category === c ? '${t.primary}' : '${t.text70}',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs" style={{ color: '${t.text50}' }}>
        Найдено: {filtered.length} товаров
      </p>

      {/* Product grid/list */}
      <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
        {filtered.map(product => (
          <div
            key={product.id}
            className={\`rounded-xl border overflow-hidden hover:shadow-lg transition-all cursor-pointer \${view === 'list' ? 'flex' : ''}\`}
            style={{ borderColor: '${t.primary40}' }}
            onClick={() => onProductClick?.(product)}
          >
            {/* Image */}
            <div
              className={\`\${view === 'list' ? 'w-32 h-32 flex-shrink-0' : 'w-full h-48'} flex items-center justify-center relative\`}
              style={{ background: '${t.primary10}' }}
            >
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">📦</span>
              )}
              {product.badge && (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ background: '${t.primary}' }}>
                  {product.badge}
                </span>
              )}
              {product.inStock === false && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <span className="text-white text-sm font-medium">Нет в наличии</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-4 flex-1">
              <h3 className="text-sm font-semibold line-clamp-2" style={{ color: '${t.text}' }}>{product.name}</h3>
              {product.description && view === 'list' && (
                <p className="text-xs mt-1 line-clamp-2" style={{ color: '${t.text50}' }}>{product.description}</p>
              )}
              {product.rating !== undefined && (
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-3.5 h-3.5 fill-current" style={{ color: '#eab308' }} />
                  <span className="text-xs font-medium" style={{ color: '${t.text70}' }}>{product.rating}</span>
                </div>
              )}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold" style={{ color: '${t.primary}' }}>
                    {product.price.toLocaleString()}{currency}
                  </span>
                  {product.oldPrice && (
                    <span className="text-xs line-through" style={{ color: '${t.text50}' }}>
                      {product.oldPrice.toLocaleString()}{currency}
                    </span>
                  )}
                </div>
                {onAddToCart && product.inStock !== false && (
                  <button
                    onClick={e => { e.stopPropagation(); onAddToCart(product); }}
                    className="p-2 rounded-lg text-white"
                    style={{ background: '${t.primary}' }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: '${t.text50}' }}>Товары не найдены</p>
        </div>
      )}
    </div>
  );
}
`,
  };
}
