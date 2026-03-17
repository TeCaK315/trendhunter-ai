import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName;
  const description = ctx.safe.projectDescription || ctx.safe.headline || '';

  return {
    'src/app/sitemap.ts': `import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: \`\${baseUrl}/pricing\`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: \`\${baseUrl}/blog\`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: \`\${baseUrl}/login\`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: \`\${baseUrl}/signup\`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  ];
}
`,

    'src/app/robots.ts': `import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/admin/'],
      },
    ],
    sitemap: \`\${baseUrl}/sitemap.xml\`,
  };
}
`,

    'src/lib/seo.ts': `import type { Metadata } from 'next';

const defaultTitle = '${projectName}';
const defaultDescription = '${description}';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export function createMetadata(options: {
  title?: string;
  description?: string;
  image?: string;
  path?: string;
}): Metadata {
  const title = options.title ? \`\${options.title} | \${defaultTitle}\` : defaultTitle;
  const description = options.description || defaultDescription;
  const url = options.path ? \`\${siteUrl}\${options.path}\` : siteUrl;
  const image = options.image || \`\${siteUrl}/og-image.png\`;

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    openGraph: {
      title,
      description,
      url,
      siteName: defaultTitle,
      images: [{ url: image, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    alternates: {
      canonical: url,
    },
  };
}
`,
  };
}
