import type { BlockContext, BlockResult } from '../types';
import { escapeJsx } from '../design-injector';

/**
 * Generates a comprehensive README.md from ProductSpec data.
 * This block should run LAST (reads ctx.env_vars, ctx.dependencies, ctx.generated_paths).
 */
export default function generate(ctx: BlockContext): BlockResult {
  const spec = ctx.product_spec;
  const name = ctx.project_name;
  const description = spec.user_output?.value_proposition || ctx.project_description || '';
  const primaryOutput = spec.user_output?.primary_output || 'analysis results';
  const primaryInput = spec.user_input?.primary_input || 'your data';
  const outputFormat = spec.user_output?.output_format || 'text';

  // ─── Features list ───
  const features = (spec.derived_features || [])
    .filter(f => f.priority === 'must_have' || f.priority === 'should_have')
    .slice(0, 8);

  const featuresSection = features.length > 0
    ? features.map(f => `- **${f.feature_name}** — ${f.solution}`).join('\n')
    : '- AI-powered analysis\n- Instant results\n- Beautiful dashboard';

  // ─── Tech stack ───
  const deps = Array.from(ctx.dependencies.keys());
  const hasSupabase = deps.some(d => d.includes('supabase'));
  const hasStripe = deps.some(d => d.includes('stripe'));
  const hasOpenAI = deps.some(d => d.includes('openai'));

  const techStack = [
    '- **Framework:** Next.js 14 (App Router)',
    '- **Language:** TypeScript',
    '- **Styling:** Tailwind CSS',
  ];
  if (hasSupabase) techStack.push('- **Database & Auth:** Supabase (PostgreSQL)');
  if (hasStripe) techStack.push('- **Payments:** Stripe');
  if (hasOpenAI) techStack.push('- **AI:** OpenAI GPT-4o-mini');

  // ─── Env vars for setup ───
  const envVars: string[] = [];
  ctx.env_vars.forEach((info, name) => {
    envVars.push(`${name}=${info.example}  # ${info.description}`);
  });

  const envSection = envVars.length > 0
    ? envVars.join('\n')
    : '# No environment variables required for demo mode';

  // ─── User flow ───
  const steps = spec.user_flow?.steps || [];
  const howItWorks = steps.length > 0
    ? steps.map(s => `${s.step_number}. **${s.action}** — ${s.user_sees}`).join('\n')
    : `1. Enter ${primaryInput}\n2. AI processes your request\n3. Get ${primaryOutput}`;

  // ─── Pricing tiers ───
  const pricing = (spec.monetization?.pricing_tiers || []);
  const pricingSection = pricing.length > 0
    ? pricing.map(t => `| ${t.name} | ${t.price} | ${t.features.slice(0, 3).join(', ')} |`).join('\n')
    : '';

  const pricingTable = pricingSection
    ? `## Pricing\n\n| Plan | Price | Features |\n|------|-------|----------|\n${pricingSection}\n`
    : '';

  // ─── Demo mode explanation ───
  const demoSection = hasOpenAI
    ? `## Demo Mode\n\nThis project works **out of the box without any API keys**. When \`OPENAI_API_KEY\` is not set, the app runs in demo mode with pre-generated realistic results.\n\nTo enable live AI analysis, add your OpenAI API key to \`.env.local\`.\n`
    : '';

  // ─── File count ───
  const fileCount = ctx.generated_paths.size;

  const readme = `# ${name}

${description}

## Features

${featuresSection}

## How It Works

${howItWorks}

## Tech Stack

${techStack.join('\n')}

## Quick Start

\`\`\`bash
# Clone the repository
git clone <your-repo-url>
cd ${ctx.project_slug}

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your keys (optional — app works in demo mode without them)

# Run development server
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a \`.env.local\` file:

\`\`\`env
${envSection}
\`\`\`

${demoSection}
${pricingTable}
## Project Structure

\`\`\`
${ctx.project_slug}/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── page.tsx      # Landing page
│   │   ├── dashboard/    # Main application
│   │   │   ├── page.tsx  # Dashboard with input form
│   │   │   └── analysis/ # Results page
│   │   ├── api/          # API routes
│   │   └── login/        # Authentication
│   ├── components/       # Reusable UI components
│   └── lib/              # Utilities & configurations
├── public/               # Static assets
├── .env.example          # Environment variables template
└── package.json          # Dependencies (${fileCount} files total)
\`\`\`

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

The app will work immediately in demo mode. Add API keys later for live functionality.

${hasSupabase ? `### Supabase Setup (Optional)

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration SQL from \`src/lib/migrations/\`
3. Add Supabase URL and anon key to environment variables
4. Auth and data persistence will be enabled automatically
` : ''}
## License

MIT
`;

  return {
    'README.md': readme,
  };
}
