/**
 * App Providers Block (AGGREGATOR)
 *
 * Executes LAST — checks ctx.generated_paths to see which provider blocks
 * were included and generates a Providers wrapper that composes only the
 * providers that actually exist in the project.
 */

import type { BlockContext, BlockResult } from '../types';

const PROVIDER_MAP: Record<string, { import: string; wrapper: string }> = {
  'src/lib/i18n.tsx': {
    import: "import { I18nProvider } from '@/lib/i18n';",
    wrapper: 'I18nProvider',
  },
  'src/components/Toast.tsx': {
    import: "import { ToastProvider } from '@/components/Toast';",
    wrapper: 'ToastProvider',
  },
  'src/components/ShoppingCart.tsx': {
    import: "import { CartProvider } from '@/components/ShoppingCart';",
    wrapper: 'CartProvider',
  },
  'src/components/Wishlist.tsx': {
    import: "import { WishlistProvider } from '@/components/Wishlist';",
    wrapper: 'WishlistProvider',
  },
};

export default function generate(ctx: BlockContext): BlockResult {
  const imports: string[] = [];
  const wrappers: string[] = [];

  for (const [filePath, config] of Object.entries(PROVIDER_MAP)) {
    if (ctx.generated_paths.has(filePath)) {
      imports.push(config.import);
      wrappers.push(config.wrapper);
    }
  }

  // If no providers needed, generate a pass-through Providers component
  if (wrappers.length === 0) {
    return {
      'src/app/providers.tsx': `'use client';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
`,
    };
  }

  // Nest providers: ToastProvider > CartProvider > WishlistProvider > {children}
  let nested = '{children}';
  for (let i = wrappers.length - 1; i >= 0; i--) {
    nested = `<${wrappers[i]}>\n        ${nested}\n      </${wrappers[i]}>`;
  }

  return {
    'src/app/providers.tsx': `'use client';

${imports.join('\n')}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      ${nested}
    </>
  );
}
`,
  };
}
