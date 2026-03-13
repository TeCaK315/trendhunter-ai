'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import OnboardingTour from '../OnboardingTour';
import WelcomeWizard from '../WelcomeWizard';
import { LanguageProvider } from '@/lib/i18n';
import { SidebarProvider, useSidebar } from '@/lib/SidebarContext';
import SessionProvider from '@/components/providers/SessionProvider';

interface ClientLayoutProps {
  children: React.ReactNode;
}

function LayoutContent({ children }: ClientLayoutProps) {
  const [mounted, setMounted] = useState(false);
  const { collapsed } = useSidebar();
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Desktop Sidebar - only for authenticated users */}
      {isAuthenticated && (
        <div className="hidden lg:block">
          <Sidebar />
        </div>
      )}

      {/* Mobile Navigation - only for authenticated users */}
      {isAuthenticated && (
        <div className="lg:hidden">
          <MobileNav />
        </div>
      )}

      {/* Main content with responsive margin */}
      <main className={`min-h-screen bg-[#09090b] transition-all duration-300
        ${isAuthenticated ? 'pt-16 lg:pt-0' : 'pt-0'}
        ${isAuthenticated ? (collapsed ? 'lg:ml-[72px]' : 'lg:ml-64') : 'lg:ml-0'}
      `}>
        {children}
      </main>

      {/* Welcome wizard - shows on first login */}
      {mounted && isAuthenticated && <WelcomeWizard />}

      {/* Onboarding tour - shows automatically on first visit (only for authenticated) */}
      {mounted && isAuthenticated && <OnboardingTour />}
    </>
  );
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <SidebarProvider>
          <LayoutContent>{children}</LayoutContent>
        </SidebarProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
