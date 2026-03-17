import type { BlockContext, BlockResult } from '../../types';
import { createDesignTokens } from '../../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  const manifest = {
    name: ctx.project_name,
    short_name: ctx.project_name.length > 12 ? ctx.project_slug : ctx.project_name,
    description: ctx.safe.projectDescription,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: ctx.design.color_palette.primary,
    background_color: ctx.design.color_palette.background,
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    categories: ['productivity', 'utilities'],
    prefer_related_applications: false,
  };

  return {
    'public/manifest.json': JSON.stringify(manifest, null, 2),
  };
}
