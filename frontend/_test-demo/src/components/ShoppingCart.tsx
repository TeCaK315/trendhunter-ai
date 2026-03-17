'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { ShoppingCart as CartIcon, X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('shopping_cart');
    if (saved) try { setItems(JSON.parse(saved)); } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('shopping_cart', JSON.stringify(items));
    }
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

interface ShoppingCartProps {
  currency?: string;
  onCheckout?: (items: CartItem[], total: number) => void;
}

export default function ShoppingCart({ currency = '₽', onCheckout }: ShoppingCartProps) {
  const [open, setOpen] = useState(false);
  const { items, removeItem, updateQuantity, clearCart, total, count } = useCart();

  return (
    <>
      {/* Cart button */}
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-xl border transition-all hover:opacity-80"
        style={{ borderColor: '#6366f140', color: '#e2e8f0' }}
      >
        <CartIcon className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs text-white flex items-center justify-center font-bold"
            style={{ background: '#6366f1' }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Slide-over */}
      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-md z-[9999] shadow-2xl flex flex-col"
            style={{ background: '#0f0f23' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#6366f140' }}>
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" style={{ color: '#6366f1' }} />
                <h2 className="text-lg font-bold" style={{ color: '#e2e8f0' }}>Корзина</h2>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#6366f110', color: '#6366f1' }}>
                  {count}
                </span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:opacity-70">
                <X className="w-5 h-5" style={{ color: '#e2e8f050' }} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 && (
                <div className="text-center py-12">
                  <CartIcon className="w-12 h-12 mx-auto mb-3" style={{ color: '#e2e8f050' }} />
                  <p className="text-sm" style={{ color: '#e2e8f050' }}>Корзина пуста</p>
                </div>
              )}
              {items.map(item => (
                <div key={item.id} className="flex gap-3 p-3 rounded-xl border" style={{ borderColor: '#6366f140' }}>
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: '#6366f110' }}>
                    {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover rounded-lg" /> : <span className="text-xl">📦</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#e2e8f0' }}>{item.name}</p>
                    <p className="text-sm font-bold mt-1" style={{ color: '#6366f1' }}>
                      {(item.price * item.quantity).toLocaleString()}{currency}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg border flex items-center justify-center"
                        style={{ borderColor: '#6366f140', color: '#e2e8f070' }}>
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-8 text-center" style={{ color: '#e2e8f0' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg border flex items-center justify-center"
                        style={{ borderColor: '#6366f140', color: '#e2e8f070' }}>
                        <Plus className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeItem(item.id)} className="ml-auto p-1 rounded hover:opacity-70">
                        <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-4 border-t space-y-3" style={{ borderColor: '#6366f140' }}>
                <div className="flex justify-between text-lg font-bold" style={{ color: '#e2e8f0' }}>
                  <span>Итого:</span>
                  <span>{total.toLocaleString()}{currency}</span>
                </div>
                <button
                  onClick={() => { onCheckout?.(items, total); setOpen(false); }}
                  className="w-full py-3 rounded-xl text-white font-medium text-sm hover:opacity-90 transition-all"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  Оформить заказ
                </button>
                <button onClick={clearCart}
                  className="w-full py-2 text-xs text-center hover:opacity-70 transition-all"
                  style={{ color: '#e2e8f050' }}>
                  Очистить корзину
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
