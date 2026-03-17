import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/app/globals.css': `@import url('${t.googleFontsUrl}');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ═══════════════════════════════════════════
   Design System — 2026 SaaS aesthetic
   ═══════════════════════════════════════════ */

:root {
  --background: ${t.bg};
  --foreground: ${t.text};
  --primary: ${t.primary};
  --secondary: ${t.secondary};
  --accent: ${t.accent};
  --surface-1: ${t.surface1};
  --surface-2: ${t.surface2};
  --radius-sm: ${t.radiusSm};
  --radius-md: ${t.radiusMd};
  --radius-lg: ${t.radiusLg};
  --radius-xl: ${t.radiusXl};
}

/* ═══ Base ═══ */
html {
  scroll-behavior: smooth;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: '${t.bodyFont}', 'Inter', system-ui, -apple-system, sans-serif;
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* ═══ Typography ═══ */
h1, h2, h3, h4, h5, h6 {
  font-family: '${t.headingFont}', '${t.bodyFont}', system-ui, sans-serif;
  letter-spacing: -0.025em;
  line-height: 1.15;
  font-weight: 700;
}

h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; letter-spacing: -0.035em; }
h2 { font-size: clamp(1.5rem, 3.5vw, 2.25rem); }
h3 { font-size: clamp(1.125rem, 2.5vw, 1.5rem); }

p { line-height: 1.65; }

/* ═══ Subtle grain texture ═══ */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
}

/* ═══ Interactive elements ═══ */
a, button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

input, textarea, select {
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

/* ═══ Focus ═══ */
*:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 4px;
}

input:focus, textarea:focus, select:focus {
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 3px ${t.primary}15, ${t.shadowSm};
}

/* ═══ Cards & Surfaces ═══ */
.surface-card {
  background: var(--surface-1);
  border: 1px solid ${t.primary}08;
  border-radius: var(--radius-lg);
  box-shadow: ${t.shadowSm};
  transition: box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
}

.surface-card:hover {
  box-shadow: ${t.shadowMd};
  border-color: ${t.primary}18;
}

.surface-elevated {
  background: var(--surface-1);
  box-shadow: ${t.shadowMd};
  border-radius: var(--radius-lg);
}

/* ═══ Glow effect for CTAs ═══ */
.glow-primary {
  box-shadow: ${t.shadowGlow};
}

/* ═══ Animations ═══ */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-fadeIn { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slideUp { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slideDown { animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-scaleIn { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

/* Staggered animations for lists */
.stagger-1 { animation-delay: 0.05s; }
.stagger-2 { animation-delay: 0.1s; }
.stagger-3 { animation-delay: 0.15s; }
.stagger-4 { animation-delay: 0.2s; }
.stagger-5 { animation-delay: 0.25s; }
.stagger-6 { animation-delay: 0.3s; }

/* ═══ Loading skeleton shimmer ═══ */
.skeleton {
  background: linear-gradient(
    90deg,
    ${t.primary}08 0%,
    ${t.primary}15 50%,
    ${t.primary}08 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

/* ═══ Scrollbar ═══ */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: ${t.primary20}; border-radius: 100px; }
::-webkit-scrollbar-thumb:hover { background: ${t.primary40}; }

* {
  scrollbar-width: thin;
  scrollbar-color: ${t.primary20} transparent;
}

/* ═══ Selection ═══ */
::selection {
  background: ${t.primary}30;
  color: ${t.text};
}

/* ═══ Print ═══ */
@media print {
  body::before { display: none; }
  .no-print, nav, footer { display: none !important; }
  body { background: white; color: black; }
}
`,
  };
}
