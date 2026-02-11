/**
 * AI Tool MVP Generator V2 - Level 2 Functional Prototype
 *
 * Генерирует полноценный AI-инструмент (~50 файлов) с:
 * - Supabase (Auth + Database)
 * - Stripe (Payments + Subscriptions)
 * - Уникальной дизайн-системой
 * - Dashboard пользователя
 * - Admin панелью
 * - API rate limiting
 * - Usage tracking
 */

import { MVPGenerationContext } from './types';
import { generateAIToolConfig } from './ai-tool-generator';

interface DesignSystem {
  color_palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    headings: string;
    body: string;
    mono?: string;
  };
  unique_elements: string[];
}

// Default design system if none provided
const DEFAULT_DESIGN: DesignSystem = {
  color_palette: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#22d3ee',
    background: '#0f172a',
    text: '#f8fafc',
  },
  typography: {
    headings: 'Inter',
    body: 'Inter',
    mono: 'JetBrains Mono',
  },
  unique_elements: ['Gradient accents', 'Glassmorphism cards', 'Subtle animations'],
};

function escapeJsx(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

/**
 * Генерирует все файлы для AI Tool MVP Level 2
 */
export function generateAIToolFilesV2(context: MVPGenerationContext): Record<string, string> {
  const config = generateAIToolConfig(context);
  const files: Record<string, string> = {};

  // Get design system from context or use default
  const design: DesignSystem = context.productSpec?.design_system || DEFAULT_DESIGN;

  const projectName = config.toolName;
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

  const safe = {
    projectName: escapeJsx(projectName),
    toolDescription: escapeJsx(config.toolDescription),
    inputPlaceholder: escapeJsx(config.inputPlaceholder),
    systemPrompt: escapeJsx(config.systemPrompt),
  };

  // ========================================
  // 1. CONFIG FILES
  // ========================================

  files['package.json'] = JSON.stringify({
    name: sanitizedName,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint',
      'db:generate': 'supabase gen types typescript --local > src/lib/database.types.ts',
    },
    dependencies: {
      next: '14.2.15',
      react: '18.2.0',
      'react-dom': '18.2.0',
      '@supabase/supabase-js': '^2.39.0',
      '@supabase/ssr': '^0.1.0',
      '@stripe/stripe-js': '^2.4.0',
      stripe: '^14.14.0',
      openai: '4.24.7',
      'lucide-react': '0.294.0',
      'react-markdown': '9.0.1',
      cheerio: '1.0.0-rc.12',
      'date-fns': '^3.3.1',
      zod: '^3.22.4',
    },
    devDependencies: {
      '@types/node': '20.10.6',
      '@types/react': '18.2.47',
      '@types/react-dom': '18.2.18',
      typescript: '5.3.3',
      tailwindcss: '3.4.0',
      postcss: '8.4.33',
      autoprefixer: '10.4.16',
      eslint: '8.56.0',
      'eslint-config-next': '14.2.15',
    },
    engines: { node: '>=18.17.0' },
  }, null, 2);

  files['tsconfig.json'] = JSON.stringify({
    compilerOptions: {
      target: 'es5',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./src/*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }, null, 2);

  files['next.config.js'] = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

module.exports = nextConfig;
`;

  // Tailwind config with custom design system colors
  files['tailwind.config.ts'] = `import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '${design.color_palette.primary}',
          50: '${design.color_palette.primary}10',
          100: '${design.color_palette.primary}20',
          500: '${design.color_palette.primary}',
          600: '${design.color_palette.primary}',
          700: '${design.color_palette.primary}',
        },
        secondary: {
          DEFAULT: '${design.color_palette.secondary}',
          500: '${design.color_palette.secondary}',
        },
        accent: {
          DEFAULT: '${design.color_palette.accent}',
          500: '${design.color_palette.accent}',
        },
        background: '${design.color_palette.background}',
        foreground: '${design.color_palette.text}',
      },
      fontFamily: {
        heading: ['${design.typography.headings}', 'sans-serif'],
        body: ['${design.typography.body}', 'sans-serif'],
        ${design.typography.mono ? `mono: ['${design.typography.mono}', 'monospace'],` : ''}
      },
    },
  },
  plugins: [],
};

export default config;
`;

  files['postcss.config.js'] = `module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
`;

  files['.gitignore'] = `node_modules
.next
.env
.env.local
.DS_Store
*.tsbuildinfo
next-env.d.ts
.vercel
.supabase
`;

  files['.env.example'] = `# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;

  // ========================================
  // 2. SUPABASE SETUP
  // ========================================

  files['src/lib/supabase/client.ts'] = `import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`;

  files['src/lib/supabase/server.ts'] = `import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookies in middleware
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle cookies in middleware
          }
        },
      },
    }
  );
}
`;

  files['src/lib/supabase/middleware.ts'] = `import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect logged in users from auth pages
  if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}
`;

  files['src/middleware.ts'] = `import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
`;

  files['src/lib/database.types.ts'] = `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          subscription_tier: 'free' | 'pro' | 'enterprise';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          usage_count: number;
          usage_reset_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          subscription_tier?: 'free' | 'pro' | 'enterprise';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          usage_count?: number;
          usage_reset_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      analyses: {
        Row: {
          id: string;
          user_id: string;
          input: string;
          input_type: 'text' | 'url';
          result: string;
          tokens_used: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          input: string;
          input_type: 'text' | 'url';
          result: string;
          tokens_used?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['analyses']['Insert']>;
      };
    };
  };
}
`;

  // ========================================
  // 3. STRIPE SETUP
  // ========================================

  files['src/lib/stripe.ts'] = `import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    analyses_per_month: 10,
    features: ['10 analyses/month', 'Basic support'],
  },
  pro: {
    name: 'Pro',
    price: 9.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    analyses_per_month: 500,
    features: ['500 analyses/month', 'Priority support', 'Export to PDF', 'API access'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 49.99,
    analyses_per_month: -1, // unlimited
    features: ['Unlimited analyses', 'Dedicated support', 'Custom integrations', 'SLA'],
  },
} as const;

export type PlanType = keyof typeof PLANS;
`;

  files['src/lib/stripe-client.ts'] = `import { loadStripe } from '@stripe/stripe-js';

export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
`;

  // ========================================
  // 4. HOOKS & UTILITIES
  // ========================================

  files['src/hooks/useUser.ts'] = `'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(profile);
      }

      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(profile);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, profile, loading };
}
`;

  files['src/lib/usage.ts'] = `import { createClient } from '@/lib/supabase/server';
import { PLANS, PlanType } from '@/lib/stripe';

export async function checkUsageLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, usage_count, usage_reset_at')
    .eq('id', userId)
    .single();

  if (!profile) {
    return { allowed: false, remaining: 0, resetAt: new Date() };
  }

  const plan = PLANS[profile.subscription_tier as PlanType];
  const resetAt = new Date(profile.usage_reset_at);

  // Check if usage should be reset (monthly)
  if (new Date() > resetAt) {
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);

    await supabase
      .from('profiles')
      .update({ usage_count: 0, usage_reset_at: nextReset.toISOString() })
      .eq('id', userId);

    return {
      allowed: true,
      remaining: plan.analyses_per_month,
      resetAt: nextReset,
    };
  }

  // Unlimited for enterprise
  if (plan.analyses_per_month === -1) {
    return { allowed: true, remaining: -1, resetAt };
  }

  const remaining = plan.analyses_per_month - profile.usage_count;

  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    resetAt,
  };
}

export async function incrementUsage(userId: string): Promise<void> {
  const supabase = await createClient();

  await supabase.rpc('increment_usage', { user_id: userId });
}
`;

  // ========================================
  // 5. APP PAGES
  // ========================================

  files['src/app/globals.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=${design.typography.headings.replace(/ /g, '+')}:wght@400;500;600;700&family=${design.typography.body.replace(/ /g, '+')}:wght@400;500&display=swap');

:root {
  --background: ${design.color_palette.background};
  --foreground: ${design.color_palette.text};
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: '${design.typography.body}', sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: '${design.typography.headings}', sans-serif;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: ${design.color_palette.secondary}40; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: ${design.color_palette.secondary}60; }
`;

  files['src/app/layout.tsx'] = `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '${safe.projectName}',
  description: '${safe.toolDescription}',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
`;

  // Landing page
  files['src/app/page.tsx'] = generateLandingPage(safe, design);

  // Auth pages
  files['src/app/login/page.tsx'] = generateLoginPage(safe, design);
  files['src/app/signup/page.tsx'] = generateSignupPage(safe, design);

  // Dashboard
  files['src/app/dashboard/page.tsx'] = generateDashboardPage(safe, design, config);
  files['src/app/dashboard/layout.tsx'] = generateDashboardLayout(safe, design);
  files['src/app/dashboard/settings/page.tsx'] = generateSettingsPage(safe, design);
  files['src/app/dashboard/history/page.tsx'] = generateHistoryPage(safe, design);
  files['src/app/dashboard/billing/page.tsx'] = generateBillingPage(safe, design);

  // Components
  files['src/components/Header.tsx'] = generateHeaderComponent(safe, design);
  files['src/components/Footer.tsx'] = generateFooterComponent(safe, design);
  files['src/components/DashboardNav.tsx'] = generateDashboardNavComponent(safe, design);
  files['src/components/AnalysisForm.tsx'] = generateAnalysisFormComponent(safe, design, config);
  files['src/components/UsageCard.tsx'] = generateUsageCardComponent(design);
  files['src/components/PricingCard.tsx'] = generatePricingCardComponent(design);

  // API Routes
  files['src/app/api/analyze/route.ts'] = generateAnalyzeAPI(safe, config);
  files['src/app/api/auth/callback/route.ts'] = generateAuthCallbackRoute();
  files['src/app/api/stripe/checkout/route.ts'] = generateStripeCheckoutRoute();
  files['src/app/api/stripe/webhook/route.ts'] = generateStripeWebhookRoute();
  files['src/app/api/usage/route.ts'] = generateUsageRoute();

  // Supabase migrations
  files['supabase/migrations/001_initial.sql'] = generateSupabaseMigration();

  // README
  files['README.md'] = generateReadme(projectName, sanitizedName, config, context);

  return files;
}

// ========================================
// HELPER FUNCTIONS FOR GENERATING FILES
// ========================================

function generateLandingPage(safe: Record<string, string>, design: DesignSystem): string {
  return `import Link from 'next/link';
import { Sparkles, Zap, Shield, BarChart } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen" style={{ background: '${design.color_palette.background}' }}>
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl bg-black/20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, ${design.color_palette.primary}, ${design.color_palette.secondary})' }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl" style={{ color: '${design.color_palette.text}' }}>
              ${safe.projectName}
            </span>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  style={{ color: '${design.color_palette.text}' }}>
              Войти
            </Link>
            <Link href="/signup" className="px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{ background: '${design.color_palette.primary}', color: 'white' }}>
              Начать бесплатно
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-heading font-bold mb-6"
              style={{ color: '${design.color_palette.text}' }}>
            ${safe.projectName}
          </h1>
          <p className="text-xl mb-8" style={{ color: '${design.color_palette.text}80' }}>
            ${safe.toolDescription}
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/signup"
                  className="px-8 py-4 rounded-xl font-semibold text-lg transition-transform hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, ${design.color_palette.primary}, ${design.color_palette.secondary})', color: 'white' }}>
              Попробовать бесплатно
            </Link>
            <Link href="#pricing"
                  className="px-8 py-4 rounded-xl font-semibold text-lg border transition-colors hover:bg-white/5"
                  style={{ borderColor: '${design.color_palette.primary}', color: '${design.color_palette.primary}' }}>
              Тарифы
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-center mb-12"
              style={{ color: '${design.color_palette.text}' }}>
            Возможности
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: 'Быстрый анализ', desc: 'Получите результаты за секунды' },
              { icon: Shield, title: 'Безопасность', desc: 'Ваши данные защищены' },
              { icon: BarChart, title: 'Аналитика', desc: 'Отслеживайте использование' },
            ].map((f, i) => (
              <div key={i} className="p-6 rounded-2xl border transition-colors hover:border-opacity-50"
                   style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}40' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                     style={{ background: '${design.color_palette.primary}20' }}>
                  <f.icon className="w-6 h-6" style={{ color: '${design.color_palette.primary}' }} />
                </div>
                <h3 className="text-xl font-heading font-semibold mb-2" style={{ color: '${design.color_palette.text}' }}>
                  {f.title}
                </h3>
                <p style={{ color: '${design.color_palette.text}70' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-heading font-bold text-center mb-4"
              style={{ color: '${design.color_palette.text}' }}>
            Тарифы
          </h2>
          <p className="text-center mb-12" style={{ color: '${design.color_palette.text}70' }}>
            Выберите план под ваши задачи
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Pricing cards will be rendered here */}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto text-center" style={{ color: '${design.color_palette.text}50' }}>
          <p>Создано с TrendHunter AI</p>
        </div>
      </footer>
    </main>
  );
}
`;
}

function generateLoginPage(safe: Record<string, string>, design: DesignSystem): string {
  return `'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: \`\${window.location.origin}/api/auth/callback\` },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '${design.color_palette.background}' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, ${design.color_palette.primary}, ${design.color_palette.secondary})' }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold" style={{ color: '${design.color_palette.text}' }}>
            Вход в ${safe.projectName}
          </h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '${design.color_palette.text}' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{
                background: '${design.color_palette.background}',
                borderColor: '${design.color_palette.primary}40',
                color: '${design.color_palette.text}',
              }}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '${design.color_palette.text}' }}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{
                background: '${design.color_palette.background}',
                borderColor: '${design.color_palette.primary}40',
                color: '${design.color_palette.text}',
              }}
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
            style={{ background: '${design.color_palette.primary}', color: 'white' }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Войти'}
          </button>
        </form>

        <div className="mt-6">
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 rounded-xl font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: '${design.color_palette.primary}40', color: '${design.color_palette.text}' }}
          >
            Войти через Google
          </button>
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: '${design.color_palette.text}70' }}>
          Нет аккаунта?{' '}
          <Link href="/signup" style={{ color: '${design.color_palette.primary}' }}>
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
`;
}

function generateSignupPage(safe: Record<string, string>, design: DesignSystem): string {
  return `'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: \`\${window.location.origin}/api/auth/callback\` },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '${design.color_palette.background}' }}>
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold mb-4" style={{ color: '${design.color_palette.text}' }}>
            Проверьте почту
          </h2>
          <p style={{ color: '${design.color_palette.text}70' }}>
            Мы отправили ссылку для подтверждения на {email}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '${design.color_palette.background}' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, ${design.color_palette.primary}, ${design.color_palette.secondary})' }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold" style={{ color: '${design.color_palette.text}' }}>
            Регистрация
          </h1>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '${design.color_palette.text}' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{
                background: '${design.color_palette.background}',
                borderColor: '${design.color_palette.primary}40',
                color: '${design.color_palette.text}',
              }}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '${design.color_palette.text}' }}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{
                background: '${design.color_palette.background}',
                borderColor: '${design.color_palette.primary}40',
                color: '${design.color_palette.text}',
              }}
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
            style={{ background: '${design.color_palette.primary}', color: 'white' }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Создать аккаунт'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: '${design.color_palette.text}70' }}>
          Уже есть аккаунт?{' '}
          <Link href="/login" style={{ color: '${design.color_palette.primary}' }}>
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
`;
}

function generateDashboardPage(safe: Record<string, string>, design: DesignSystem, config: ReturnType<typeof generateAIToolConfig>): string {
  return `'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import AnalysisForm from '@/components/AnalysisForm';
import UsageCard from '@/components/UsageCard';
import { Sparkles, Clock, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const { user, profile, loading } = useUser();
  const [recentAnalyses, setRecentAnalyses] = useState<any[]>([]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '${design.color_palette.primary}' }} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-heading font-bold" style={{ color: '${design.color_palette.text}' }}>
          Привет{profile?.full_name ? \`, \${profile.full_name}\` : ''}! 👋
        </h1>
        <p style={{ color: '${design.color_palette.text}70' }}>
          Готов к анализу? Начни прямо сейчас.
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <UsageCard />
        <div className="p-6 rounded-2xl border" style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}20' }}>
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5" style={{ color: '${design.color_palette.secondary}' }} />
            <span style={{ color: '${design.color_palette.text}70' }}>Последний анализ</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: '${design.color_palette.text}' }}>
            Сегодня
          </p>
        </div>
        <div className="p-6 rounded-2xl border" style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}20' }}>
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5" style={{ color: '${design.color_palette.accent}' }} />
            <span style={{ color: '${design.color_palette.text}70' }}>Тариф</span>
          </div>
          <p className="text-2xl font-bold capitalize" style={{ color: '${design.color_palette.text}' }}>
            {profile?.subscription_tier || 'Free'}
          </p>
        </div>
      </div>

      {/* Analysis Form */}
      <div className="p-6 rounded-2xl border" style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}20' }}>
        <h2 className="text-xl font-heading font-semibold mb-4 flex items-center gap-2" style={{ color: '${design.color_palette.text}' }}>
          <Sparkles className="w-5 h-5" style={{ color: '${design.color_palette.primary}' }} />
          Новый анализ
        </h2>
        <AnalysisForm />
      </div>
    </div>
  );
}
`;
}

function generateDashboardLayout(safe: Record<string, string>, design: DesignSystem): string {
  return `import DashboardNav from '@/components/DashboardNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '${design.color_palette.background}' }}>
      <DashboardNav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
`;
}

function generateSettingsPage(safe: Record<string, string>, design: DesignSystem): string {
  return `'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { User, Bell, Shield, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, loading } = useUser();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    setSaving(false);
  };

  if (loading) {
    return <div className="animate-pulse">Загрузка...</div>;
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-heading font-bold" style={{ color: '${design.color_palette.text}' }}>
        Настройки
      </h1>

      {/* Profile */}
      <div className="p-6 rounded-2xl border" style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}20' }}>
        <h2 className="text-xl font-heading font-semibold mb-4 flex items-center gap-2" style={{ color: '${design.color_palette.text}' }}>
          <User className="w-5 h-5" style={{ color: '${design.color_palette.primary}' }} />
          Профиль
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '${design.color_palette.text}70' }}>Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 rounded-xl border opacity-60"
              style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}20', color: '${design.color_palette.text}' }}
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '${design.color_palette.text}70' }}>Имя</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}40', color: '${design.color_palette.text}' }}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
            style={{ background: '${design.color_palette.primary}', color: 'white' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function generateHistoryPage(safe: Record<string, string>, design: DesignSystem): string {
  return `'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { Clock, FileText, Link } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Analysis {
  id: string;
  input: string;
  input_type: 'text' | 'url';
  result: string;
  created_at: string;
}

export default function HistoryPage() {
  const { user } = useUser();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      const { data } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setAnalyses(data || []);
      setLoading(false);
    };

    fetchHistory();
  }, [user]);

  if (loading) {
    return <div className="animate-pulse">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-heading font-bold" style={{ color: '${design.color_palette.text}' }}>
        История анализов
      </h1>

      {analyses.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border" style={{ borderColor: '${design.color_palette.primary}20' }}>
          <Clock className="w-12 h-12 mx-auto mb-4" style={{ color: '${design.color_palette.text}40' }} />
          <p style={{ color: '${design.color_palette.text}70' }}>Пока нет анализов</p>
        </div>
      ) : (
        <div className="space-y-4">
          {analyses.map((analysis) => (
            <div
              key={analysis.id}
              className="p-4 rounded-xl border cursor-pointer transition-colors hover:border-opacity-60"
              style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}20' }}
            >
              <div className="flex items-center gap-3 mb-2">
                {analysis.input_type === 'url' ? (
                  <Link className="w-4 h-4" style={{ color: '${design.color_palette.primary}' }} />
                ) : (
                  <FileText className="w-4 h-4" style={{ color: '${design.color_palette.secondary}' }} />
                )}
                <span className="text-sm" style={{ color: '${design.color_palette.text}70' }}>
                  {format(new Date(analysis.created_at), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                </span>
              </div>
              <p className="line-clamp-2" style={{ color: '${design.color_palette.text}' }}>
                {analysis.input}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
`;
}

function generateBillingPage(safe: Record<string, string>, design: DesignSystem): string {
  return `'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { PLANS } from '@/lib/stripe';
import { CreditCard, Check, Loader2 } from 'lucide-react';

export default function BillingPage() {
  const { profile } = useUser();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: string) => {
    setLoading(plan);

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });

    const { url } = await res.json();
    if (url) window.location.href = url;

    setLoading(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold" style={{ color: '${design.color_palette.text}' }}>
          Тарифы
        </h1>
        <p style={{ color: '${design.color_palette.text}70' }}>
          Текущий план: <span className="capitalize font-medium">{profile?.subscription_tier || 'Free'}</span>
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {Object.entries(PLANS).map(([key, plan]) => (
          <div
            key={key}
            className={\`p-6 rounded-2xl border \${profile?.subscription_tier === key ? 'ring-2' : ''}\`}
            style={{
              background: '${design.color_palette.background}',
              borderColor: '${design.color_palette.primary}20',
              ...(profile?.subscription_tier === key && { ringColor: '${design.color_palette.primary}' }),
            }}
          >
            <h3 className="text-xl font-heading font-bold mb-2" style={{ color: '${design.color_palette.text}' }}>
              {plan.name}
            </h3>
            <div className="mb-4">
              <span className="text-3xl font-bold" style={{ color: '${design.color_palette.text}' }}>
                \${plan.price}
              </span>
              {plan.price > 0 && <span style={{ color: '${design.color_palette.text}60' }}>/мес</span>}
            </div>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2" style={{ color: '${design.color_palette.text}80' }}>
                  <Check className="w-4 h-4" style={{ color: '${design.color_palette.accent}' }} />
                  {f}
                </li>
              ))}
            </ul>
            {profile?.subscription_tier === key ? (
              <button
                disabled
                className="w-full py-2 rounded-xl font-medium opacity-50"
                style={{ background: '${design.color_palette.primary}20', color: '${design.color_palette.primary}' }}
              >
                Текущий план
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade(key)}
                disabled={!!loading}
                className="w-full py-2 rounded-xl font-medium transition-colors"
                style={{ background: '${design.color_palette.primary}', color: 'white' }}
              >
                {loading === key ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Выбрать'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
`;
}

function generateHeaderComponent(safe: Record<string, string>, design: DesignSystem): string {
  return `import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b sticky top-0 z-50 backdrop-blur-xl" style={{ background: '${design.color_palette.background}cc', borderColor: '${design.color_palette.primary}20' }}>
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, ${design.color_palette.primary}, ${design.color_palette.secondary})' }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-xl" style={{ color: '${design.color_palette.text}' }}>
            ${safe.projectName}
          </span>
        </Link>
      </div>
    </header>
  );
}
`;
}

function generateFooterComponent(safe: Record<string, string>, design: DesignSystem): string {
  return `export default function Footer() {
  return (
    <footer className="py-8 border-t" style={{ borderColor: '${design.color_palette.primary}20' }}>
      <div className="max-w-6xl mx-auto px-4 text-center" style={{ color: '${design.color_palette.text}50' }}>
        <p>Создано с TrendHunter AI</p>
      </div>
    </footer>
  );
}
`;
}

function generateDashboardNavComponent(safe: Record<string, string>, design: DesignSystem): string {
  return `'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, LayoutDashboard, History, CreditCard, Settings, LogOut } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Главная' },
  { href: '/dashboard/history', icon: History, label: 'История' },
  { href: '/dashboard/billing', icon: CreditCard, label: 'Тарифы' },
  { href: '/dashboard/settings', icon: Settings, label: 'Настройки' },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <nav className="border-b sticky top-0 z-50 backdrop-blur-xl" style={{ background: '${design.color_palette.background}cc', borderColor: '${design.color_palette.primary}20' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, ${design.color_palette.primary}, ${design.color_palette.secondary})' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading font-bold" style={{ color: '${design.color_palette.text}' }}>
              ${safe.projectName}
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={\`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors \${pathname === item.href ? 'bg-white/10' : 'hover:bg-white/5'}\`}
                style={{ color: pathname === item.href ? '${design.color_palette.text}' : '${design.color_palette.text}70' }}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: '${design.color_palette.text}70' }}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Выйти</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
`;
}

function generateAnalysisFormComponent(safe: Record<string, string>, design: DesignSystem, config: ReturnType<typeof generateAIToolConfig>): string {
  return `'use client';

import { useState } from 'react';
import { Send, Loader2, FileText, Link as LinkIcon, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function AnalysisForm() {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<'text' | 'url'>('${config.inputType === 'form' ? 'text' : config.inputType}');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), inputType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка анализа');
      }

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis.md';
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Input Type Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setInputType('text')}
          className={\`flex items-center gap-2 px-4 py-2 rounded-lg transition-all \${inputType === 'text' ? 'text-white' : ''}\`}
          style={{ background: inputType === 'text' ? '${design.color_palette.primary}' : '${design.color_palette.primary}20', color: inputType === 'text' ? 'white' : '${design.color_palette.text}70' }}
        >
          <FileText className="w-4 h-4" />
          Текст
        </button>
        <button
          onClick={() => setInputType('url')}
          className={\`flex items-center gap-2 px-4 py-2 rounded-lg transition-all \${inputType === 'url' ? 'text-white' : ''}\`}
          style={{ background: inputType === 'url' ? '${design.color_palette.primary}' : '${design.color_palette.primary}20', color: inputType === 'url' ? 'white' : '${design.color_palette.text}70' }}
        >
          <LinkIcon className="w-4 h-4" />
          URL
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {inputType === 'text' ? (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="${safe.inputPlaceholder}"
            rows={6}
            className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none"
            style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}40', color: '${design.color_palette.text}' }}
          />
        ) : (
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
            style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}40', color: '${design.color_palette.text}' }}
          />
        )}

        <div className="flex justify-end mt-4">
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
            style={{ background: '${design.color_palette.primary}', color: 'white' }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Анализирую...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Анализировать
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold" style={{ color: '${design.color_palette.text}' }}>
              Результаты
            </h3>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
              style={{ background: '${design.color_palette.primary}20', color: '${design.color_palette.primary}' }}
            >
              <Download className="w-4 h-4" />
              Экспорт
            </button>
          </div>
          <div className="p-6 rounded-xl border prose prose-invert max-w-none" style={{ borderColor: '${design.color_palette.primary}20' }}>
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
`;
}

function generateUsageCardComponent(design: DesignSystem): string {
  return `'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

export default function UsageCard() {
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    fetch('/api/usage')
      .then(res => res.json())
      .then(data => setUsage(data))
      .catch(() => setUsage({ used: 0, limit: 10 }));
  }, []);

  const percentage = usage ? Math.min(100, (usage.used / usage.limit) * 100) : 0;

  return (
    <div className="p-6 rounded-2xl border" style={{ background: '${design.color_palette.background}', borderColor: '${design.color_palette.primary}20' }}>
      <div className="flex items-center gap-3 mb-2">
        <Zap className="w-5 h-5" style={{ color: '${design.color_palette.primary}' }} />
        <span style={{ color: '${design.color_palette.text}70' }}>Использование</span>
      </div>
      <p className="text-2xl font-bold mb-2" style={{ color: '${design.color_palette.text}' }}>
        {usage?.used ?? '-'} / {usage?.limit ?? '-'}
      </p>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '${design.color_palette.primary}20' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: \`\${percentage}%\`, background: 'linear-gradient(90deg, ${design.color_palette.primary}, ${design.color_palette.secondary})' }}
        />
      </div>
    </div>
  );
}
`;
}

function generatePricingCardComponent(design: DesignSystem): string {
  return `// PricingCard component - included in BillingPage
export {};
`;
}

function generateAnalyzeAPI(safe: Record<string, string>, config: ReturnType<typeof generateAIToolConfig>): string {
  return `import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';
import { createClient } from '@/lib/supabase/server';
import { checkUsageLimit, incrementUsage } from '@/lib/usage';

const SYSTEM_PROMPT = \`${safe.systemPrompt}\`;

async function parseUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Tool-Bot/1.0)' }
  });

  if (!response.ok) throw new Error('Не удалось загрузить страницу');

  const html = await response.text();
  const $ = cheerio.load(html);

  $('script, style, nav, footer, header').remove();

  const title = $('title').text().trim() || $('h1').first().text().trim();
  const content = $('article, main, .content').first().text().trim() || $('body').text().trim();

  return \`# \${title}\\n\\n\${content.substring(0, 10000)}\`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    // Check usage limit
    const usage = await checkUsageLimit(user.id);
    if (!usage.allowed) {
      return NextResponse.json({ error: 'Лимит исчерпан. Обновите тариф.' }, { status: 429 });
    }

    const { input, inputType } = await request.json();

    if (!input) {
      return NextResponse.json({ error: 'Введите данные для анализа' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'API ключ не настроен' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let contentToAnalyze = input;

    if (inputType === 'url') {
      try {
        contentToAnalyze = await parseUrl(input);
      } catch {
        return NextResponse.json({ error: 'Ошибка загрузки URL' }, { status: 400 });
      }
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: \`Проанализируй:\\n\\n\${contentToAnalyze}\` }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const result = completion.choices[0]?.message?.content || '';
    const tokensUsed = completion.usage?.total_tokens || 0;

    // Save analysis
    await supabase.from('analyses').insert({
      user_id: user.id,
      input,
      input_type: inputType,
      result,
      tokens_used: tokensUsed,
    });

    // Increment usage
    await incrementUsage(user.id);

    return NextResponse.json({ result });

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Ошибка анализа' }, { status: 500 });
  }
}
`;
}

function generateAuthCallbackRoute(): string {
  return `import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(\`\${origin}\${next}\`);
    }
  }

  return NextResponse.redirect(\`\${origin}/login?error=auth_failed\`);
}
`;
}

function generateStripeCheckoutRoute(): string {
  return `import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLANS } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan } = await request.json();
    const planConfig = PLANS[plan as keyof typeof PLANS];

    if (!planConfig || !('priceId' in planConfig) || !planConfig.priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: \`\${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true\`,
      cancel_url: \`\${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true\`,
      metadata: { user_id: user.id, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
`;
}

function generateStripeWebhookRoute(): string {
  return `import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;

      if (userId && plan) {
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_tier: plan,
            stripe_subscription_id: session.subscription as string,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await supabaseAdmin
        .from('profiles')
        .update({
          subscription_tier: 'free',
          stripe_subscription_id: null,
        })
        .eq('stripe_subscription_id', subscription.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
`;
}

function generateUsageRoute(): string {
  return `import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PLANS } from '@/lib/stripe';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, usage_count')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ used: 0, limit: 10 });
    }

    const plan = PLANS[profile.subscription_tier as keyof typeof PLANS];
    const limit = plan.analyses_per_month === -1 ? 9999 : plan.analyses_per_month;

    return NextResponse.json({
      used: profile.usage_count,
      limit,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get usage' }, { status: 500 });
  }
}
`;
}

function generateSupabaseMigration(): string {
  return `-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  usage_count INTEGER DEFAULT 0,
  usage_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('text', 'url')),
  result TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);

-- Create function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policies for analyses
CREATE POLICY "Users can view own analyses"
  ON analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);
`;
}

function generateReadme(projectName: string, sanitizedName: string, config: ReturnType<typeof generateAIToolConfig>, context: MVPGenerationContext): string {
  const mainPain = context.analysis?.main_pain || context.trend.title;
  const targetAudience = context.analysis?.target_audience?.primary || 'современные компании';

  return `# ${projectName}

${config.toolDescription}

## 🚀 Level 2 Functional Prototype

Это полноценный MVP с:
- ✅ Supabase Auth (Email + Google)
- ✅ Supabase Database (PostgreSQL)
- ✅ Stripe Payments (Subscriptions)
- ✅ Usage Tracking & Rate Limiting
- ✅ Dashboard с аналитикой
- ✅ История запросов
- ✅ Уникальная дизайн-система

## 🎯 Проблема

${mainPain}

## 💡 Решение

${projectName} автоматизирует анализ и помогает получить ценные инсайты.

## 🎯 Для кого

${targetAudience}

## ⚡ Быстрый старт

\`\`\`bash
# Клонировать
git clone <repo-url>
cd ${sanitizedName}

# Установить
npm install

# Настроить
cp .env.example .env.local
# Заполните переменные в .env.local

# Запустить
npm run dev
\`\`\`

## 🔧 Настройка

### 1. Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Скопируйте URL и ключи в \`.env.local\`
3. Запустите миграцию: \`supabase db push\`

### 2. Stripe

1. Создайте аккаунт на [stripe.com](https://stripe.com)
2. Создайте Products и Prices
3. Настройте Webhook
4. Добавьте ключи в \`.env.local\`

### 3. OpenAI

1. Получите API ключ на [platform.openai.com](https://platform.openai.com)
2. Добавьте в \`.env.local\`

## 🌐 Деплой

### Vercel

1. Push в GitHub
2. Import в Vercel
3. Добавьте Environment Variables
4. Deploy!

## 📝 Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Auth & DB:** Supabase
- **Payments:** Stripe
- **AI:** OpenAI GPT-4

---

*Создано с [TrendHunter AI](https://trendhunter.ai) 🚀*
`;
}
