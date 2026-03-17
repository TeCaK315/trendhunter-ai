import type { BlockContext, BlockResult } from '../types';

export default function generate(_ctx: BlockContext): BlockResult {
  return {
    'postcss.config.js': `module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
`,
  };
}
