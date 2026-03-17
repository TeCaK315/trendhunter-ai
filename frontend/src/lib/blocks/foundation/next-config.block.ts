import type { BlockContext, BlockResult } from '../types';

export default function generate(ctx: BlockContext): BlockResult {
  const pwaHeaders = ctx.project_type === 'pwa' ? `
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Service-Worker-Allowed', value: '/' }],
      },
    ];
  },` : '';

  return {
    'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },${pwaHeaders}
};

module.exports = nextConfig;
`,
  };
}
