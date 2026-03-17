'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Heart, X, Trash2, ExternalLink } from 'lucide-react';

interface WishlistItem {
  id: string;
  name: string;
  price?: number;
  image?: string;
  url?: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  addItem: (item: WishlistItem) => void;
  removeItem: (id: string) => void;
  isInWishlist: (id: string) => boolean;
  toggleItem: (item: WishlistItem) => void;
  count: number;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('wishlist');
    if (saved) try { setItems(JSON.parse(saved)); } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wishlist', JSON.stringify(items));
    }
  }, [items]);

  const addItem = useCallback((item: WishlistItem) => {
    setItems(prev => prev.some(i => i.id === item.id) ? prev : [...prev, item]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const isInWishlist = useCallback((id: string) => {
    return items.some(i => i.id === id);
  }, [items]);

  const toggleItem = useCallback((item: WishlistItem) => {
    setItems(prev => prev.some(i => i.id === item.id) ? prev.filter(i => i.id !== item.id) : [...prev, item]);
  }, []);

  return (
    <WishlistContext.Provider value={{ items, addItem, removeItem, isInWishlist, toggleItem, count: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function WishlistButton({ item, size = 'md' }: { item: WishlistItem; size?: 'sm' | 'md' }) {
  const { isInWishlist, toggleItem } = useWishlist();
  const active = isInWishlist(item.id);

  return (
    <button
      onClick={e => { e.stopPropagation(); toggleItem(item); }}
      className={`rounded-full transition-all ${size === 'sm' ? 'p-1.5' : 'p-2'}`}
      style={{ color: active ? '#ef4444' : '#e2e8f050' }}
      title={active ? 'Убрать из избранного' : 'В избранное'}
    >
      <Heart className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} transition-all`} fill={active ? '#ef4444' : 'none'} />
    </button>
  );
}

interface WishlistPanelProps {
  currency?: string;
  onItemClick?: (item: WishlistItem) => void;
}

export default function WishlistPanel({ currency = '₽', onItemClick }: WishlistPanelProps) {
  const { items, removeItem, count } = useWishlist();

  if (count === 0) {
    return (
      <div className="text-center py-12">
        <Heart className="w-12 h-12 mx-auto mb-3" style={{ color: '#e2e8f050' }} />
        <p className="text-sm" style={{ color: '#e2e8f050' }}>Список избранного пуст</p>
        <p className="text-xs mt-1" style={{ color: '#e2e8f050' }}>Нажмите ♡ на любом товаре</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: '#e2e8f0' }}>
          <Heart className="w-5 h-5" style={{ color: '#ef4444' }} /> Избранное
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#6366f110', color: '#6366f1' }}>{count}</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.id} className="flex gap-3 p-3 rounded-xl border" style={{ borderColor: '#6366f140' }}>
            <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#6366f110' }}>
              {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover rounded-lg" /> : <span className="text-xl">📦</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate cursor-pointer hover:underline" style={{ color: '#e2e8f0' }} onClick={() => onItemClick?.(item)}>
                {item.name}
              </p>
              {item.price !== undefined && (
                <p className="text-sm font-bold mt-1" style={{ color: '#6366f1' }}>{item.price.toLocaleString()}{currency}</p>
              )}
            </div>
            <button onClick={() => removeItem(item.id)} className="p-1 rounded hover:opacity-70 self-start">
              <Trash2 className="w-4 h-4" style={{ color: '#e2e8f050' }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
