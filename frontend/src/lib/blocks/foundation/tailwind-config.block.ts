import type { BlockContext, BlockResult } from '../types';
import { tailwindColorConfig, tailwindFontConfig } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const d = ctx.design;

  return {
    'tailwind.config.ts': `import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      ${tailwindColorConfig(d)},
      ${tailwindFontConfig(d)},
    },
  },
  plugins: [],
};

export default config;
`,
  };
}
