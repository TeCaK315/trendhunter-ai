'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import OnboardingTour from '../OnboardingTour';
import { LanguageProvider } from '@/lib/i18n';
import { SidebarProvider, useSidebar } from '@/lib/SidebarContext';

interface ClientLayoutProps {
  children: React.ReactNode;
}

function LayoutContent({ children }: ClientLayoutProps) {
  const [mounted, setMounted] = useState(false);
  const { collapsed } = useSidebar();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Desktop Sidebar - hidden on mobile/tablet */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Navigation - visible on mobile/tablet */}
      <div className="lg:hidden">
        <MobileNav />
      </div>

      {/* Main content with responsive margin */}
      <main className={`min-h-screen bg-[#09090b] transition-all duration-300
        pt-16 lg:pt-0
        ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-64'}
      `}>
        {children}
      </main>

      {/* Onboarding tour - shows automatically on first visit */}
      {mounted && <OnboardingTour />}
    </>
  );
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <LanguageProvider>
      <SidebarProvider>
        <LayoutContent>{children}</LayoutContent>
      </SidebarProvider>
    </LanguageProvider>
  );
}
