/**
 * Design Injection Utilities
 *
 * Centralizes design_system token expansion for all blocks.
 * Each block calls createDesignTokens(ctx.design) to get pre-computed values.
 */

import type { DesignSystem } from './types';

/** Default design system when no design analysis is available */
export const DEFAULT_DESIGN: DesignSystem = {
  color_palette: {
    primary: '#6d5cff',
    secondary: '#a78bfa',
    accent: '#34d399',
    background: '#09090b',
    text: '#fafafa',
  },
  typography: {
    headings: 'Satoshi',
    body: 'Inter',
    mono: 'JetBrains Mono',
  },
  unique_elements: ['Subtle grain texture overlay', 'Layered soft shadows', 'Micro-interaction hover states', 'Bento-style card grid'],
  design_rationale: 'Clean dark theme following 2026 design language — muted tones, generous spacing, layered depth',
};

/** Pre-computed design tokens for template interpolation */
export interface DesignTokens {
  // Raw colors
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  text: string;

  // Alpha variants
  primary10: string;
  primary20: string;
  primary40: string;
  secondary40: string;
  secondary60: string;
  text40: string;
  text50: string;
  text60: string;
  text70: string;
  text80: string;

  // Surface colors (layered backgrounds for cards, modals, inputs)
  surface1: string;   // Slightly lighter than bg — for cards
  surface2: string;   // Even lighter — for nested elements, inputs

  // Gradients
  gradientPrimary: string;

  // Shadows (layered, soft — 2026 style)
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowGlow: string; // Colored glow behind CTAs

  // Border radius
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;

  // Fonts
  headingFont: string;
  bodyFont: string;
  monoFont: string;

  // Google Fonts URL
  googleFontsUrl: string;

  // Unique elements
  uniqueElements: string[];
}

/** Create pre-computed design tokens from DesignSystem */
export function createDesignTokens(d: DesignSystem): DesignTokens {
  const primary = d.color_palette.primary;
  const secondary = d.color_palette.secondary;
  const bg = d.color_palette.background;

  // Detect if background is dark or light for surface color generation
  const bgHex = bg.replace('#', '');
  const bgR = parseInt(bgHex.substring(0, 2), 16) || 0;
  const isDark = bgR < 128;

  return {
    primary,
    secondary,
    accent: d.color_palette.accent,
    bg,
    text: d.color_palette.text,

    primary10: primary + '10',
    primary20: primary + '20',
    primary40: primary + '40',
    secondary40: secondary + '40',
    secondary60: secondary + '60',
    text40: d.color_palette.text + '40',
    text50: d.color_palette.text + '50',
    text60: d.color_palette.text + '60',
    text70: d.color_palette.text + '70',
    text80: d.color_palette.text + '80',

    // Surface colors: slightly lighter/darker layers on top of bg
    surface1: isDark ? '#ffffff08' : '#00000006',
    surface2: isDark ? '#ffffff12' : '#0000000a',

    gradientPrimary: `linear-gradient(135deg, ${primary}, ${secondary})`,

    // Layered soft shadows — 2026 style (no hard borders)
    shadowSm: isDark
      ? '0 1px 2px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.15)'
      : '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
    shadowMd: isDark
      ? '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)'
      : '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
    shadowLg: isDark
      ? '0 8px 32px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.25)'
      : '0 8px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
    shadowGlow: `0 0 40px ${primary}25, 0 0 80px ${primary}10`,

    // Border radius
    radiusSm: '8px',
    radiusMd: '12px',
    radiusLg: '16px',
    radiusXl: '24px',

    headingFont: d.typography.headings,
    bodyFont: d.typography.body,
    monoFont: d.typography.mono || 'JetBrains Mono',

    googleFontsUrl: `https://fonts.googleapis.com/css2?family=${d.typography.headings.replace(/ /g, '+')}:wght@400;500;600;700;800;900&family=${d.typography.body.replace(/ /g, '+')}:wght@400;500;600&display=swap`,

    uniqueElements: d.unique_elements,
  };
}

/** Tailwind theme extend colors config string */
export function tailwindColorConfig(d: DesignSystem): string {
  return `colors: {
        primary: {
          DEFAULT: '${d.color_palette.primary}',
          50: '${d.color_palette.primary}10',
          100: '${d.color_palette.primary}20',
          500: '${d.color_palette.primary}',
          600: '${d.color_palette.primary}',
          700: '${d.color_palette.primary}',
        },
        secondary: {
          DEFAULT: '${d.color_palette.secondary}',
          500: '${d.color_palette.secondary}',
        },
        accent: {
          DEFAULT: '${d.color_palette.accent}',
          500: '${d.color_palette.accent}',
        },
        background: '${d.color_palette.background}',
        foreground: '${d.color_palette.text}',
      }`;
}

/** Tailwind fontFamily config string */
export function tailwindFontConfig(d: DesignSystem): string {
  return `fontFamily: {
        heading: ['${d.typography.headings}', 'sans-serif'],
        body: ['${d.typography.body}', 'sans-serif'],
        ${d.typography.mono ? `mono: ['${d.typography.mono}', 'monospace'],` : ''}
      }`;
}

/** Escape string for safe JSX template literal interpolation */
export function escapeJsx(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape string for embedding inside a NESTED template literal (e.g. SYSTEM_PROMPT) */
export function escapeForTemplate(str: string): string {
  return str
    .replace(/\\/g, '\\\\\\\\')
    .replace(/`/g, '\\\\`')
    .replace(/\$/g, '\\\\$')
    .replace(/\n/g, '\\\\n');
}
