'use client';

import { ToastProvider } from '@/components/Toast';
import { CartProvider } from '@/components/ShoppingCart';
import { WishlistProvider } from '@/components/Wishlist';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToastProvider>
        <CartProvider>
        <WishlistProvider>
        {children}
      </WishlistProvider>
      </CartProvider>
      </ToastProvider>
    </>
  );
}
