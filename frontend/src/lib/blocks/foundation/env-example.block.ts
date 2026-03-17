import type { BlockContext, BlockResult } from '../types';

/**
 * Aggregates env vars from all selected blocks into .env.example.
 * This block should be executed LAST (reads ctx.env_vars).
 */
export default function generate(ctx: BlockContext): BlockResult {
  // Group env vars by prefix
  const groups: Record<string, Array<{ name: string; example: string; description: string }>> = {};

  ctx.env_vars.forEach((info, name) => {
    const prefix = name.split('_')[0]; // NEXT, SUPABASE, STRIPE, OPENAI, etc.
    const group = name.startsWith('NEXT_PUBLIC_SUPABASE') ? 'Supabase'
      : name.startsWith('NEXT_PUBLIC_STRIPE') ? 'Stripe'
      : name.startsWith('NEXT_PUBLIC_') ? 'App'
      : name.startsWith('SUPABASE') ? 'Supabase'
      : name.startsWith('STRIPE') ? 'Stripe'
      : name.startsWith('OPENAI') ? 'OpenAI'
      : name.startsWith('RESEND') ? 'Email'
      : name.startsWith('ANTHROPIC') ? 'Anthropic'
      : 'App';

    if (!groups[group]) groups[group] = [];
    groups[group].push({ name, example: info.example, description: info.description });
  });

  const sections = Object.entries(groups).map(([group, vars]) => {
    const lines = vars.map(v => `# ${v.description}\n${v.name}=${v.example}`);
    return `# ${group}\n${lines.join('\n')}`;
  });

  const envContent = sections.join('\n\n') || '# No environment variables required';

  return {
    '.env.example': envContent + '\n',
    '.gitignore': `node_modules
.next
.env
.env.local
.DS_Store
*.tsbuildinfo
next-env.d.ts
.vercel
.supabase
`,
  };
}
