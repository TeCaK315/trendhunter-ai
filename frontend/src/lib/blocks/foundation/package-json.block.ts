import type { BlockContext, BlockResult } from '../types';

/**
 * Generates package.json by aggregating dependencies from all selected blocks.
 * This block should be executed LAST (reads ctx.dependencies and ctx.devDependencies).
 */
export default function generate(ctx: BlockContext): BlockResult {
  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = {};

  ctx.dependencies.forEach((ver, pkg) => { deps[pkg] = ver; });
  ctx.devDependencies.forEach((ver, pkg) => { devDeps[pkg] = ver; });

  const scripts: Record<string, string> = {
    dev: 'next dev',
    build: 'next build',
    start: 'next start',
    lint: 'next lint',
  };

  if (ctx.supabase.required) {
    scripts['db:generate'] = 'supabase gen types typescript --local > src/lib/database.types.ts';
  }

  const pkg = {
    name: ctx.project_slug,
    version: '0.1.0',
    private: true,
    scripts,
    dependencies: deps,
    devDependencies: devDeps,
    engines: { node: '>=20.0.0' },
  };

  return {
    'package.json': JSON.stringify(pkg, null, 2),
  };
}
