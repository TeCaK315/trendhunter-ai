import type { BlockContext, BlockResult } from '../types';

export default function generate(ctx: BlockContext): BlockResult {
  return {
    'src/app/layout.tsx': `import React from 'react';
import type { Metadata } from 'next';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: '${ctx.safe.projectName}',
  description: '${ctx.safe.projectDescription}',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
`,
  };
}
