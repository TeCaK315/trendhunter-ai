'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
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
      <Sidebar />
      <main className={`min-h-screen bg-[#09090b] transition-all duration-300 ${
        collapsed ? 'ml-[72px]' : 'ml-64'
      }`}>
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
