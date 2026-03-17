/**
 * Block Assembler — Project Assembly Orchestrator
 *
 * Replaces generateCodeWithClaude() for block-based generation.
 * Selects blocks, resolves dependencies, executes in order, fills gaps with Claude.
 */

import type { BlockContext, BlockFunction, BlockResult, ProjectType, DesignSystem } from './types';
import type { ProductSpecification } from '../mvp-templates/types';
import { BLOCKS_MANIFEST, getBlock } from './blocks-manifest';
import { DEFAULT_DESIGN, escapeJsx } from './design-injector';

// ─── Public Types ───

export interface AssemblyInput {
  product_spec: ProductSpecification;
  project_name: string;
  project_type?: ProjectType;
}

export interface AssemblyOutput {
  files: Record<string, string>;
  blocks_used: string[];
  custom_files: string[];
  total_files: number;
  assembly_time_ms: number;
  claude_calls: number;
}

// ─── Block Loaders ───

// Static import map for all blocks (avoids dynamic import issues with bundlers)
const BLOCK_LOADERS: Record<string, () => Promise<{ default: BlockFunction }>> = {
  // Foundation
  'foundation/package-json': () => import('./foundation/package-json.block'),
  'foundation/tsconfig': () => import('./foundation/tsconfig.block'),
  'foundation/tailwind-config': () => import('./foundation/tailwind-config.block'),
  'foundation/postcss-config': () => import('./foundation/postcss-config.block'),
  'foundation/next-config': () => import('./foundation/next-config.block'),
  'foundation/globals-css': () => import('./foundation/globals-css.block'),
  'foundation/root-layout': () => import('./foundation/root-layout.block'),
  'foundation/app-providers': () => import('./foundation/app-providers.block'),
  'foundation/readme': () => import('./foundation/readme.block'),
  'foundation/env-example': () => import('./foundation/env-example.block'),
  // Auth
  'auth/supabase-client': () => import('./auth/supabase-client.block'),
  'auth/middleware': () => import('./auth/middleware.block'),
  'auth/login-page': () => import('./auth/login-page.block'),
  'auth/signup-page': () => import('./auth/signup-page.block'),
  'auth/callback': () => import('./auth/callback.block'),
  'auth/user-hook': () => import('./auth/user-hook.block'),
  // Database
  'database/types': () => import('./database/types.block'),
  'database/migrations': () => import('./database/migrations.block'),
  'database/crud-helpers': () => import('./database/crud-helpers.block'),
  // UI
  'ui/header': () => import('./ui/header.block'),
  'ui/footer': () => import('./ui/footer.block'),
  'ui/dashboard-nav': () => import('./ui/dashboard-nav.block'),
  'ui/dashboard-layout': () => import('./ui/dashboard-layout.block'),
  'ui/loading-states': () => import('./ui/loading-states.block'),
  'ui/toast': () => import('./ui/toast.block'),
  // Features
  'feature/stripe-setup': () => import('./features/stripe-setup.block'),
  'feature/stripe-checkout': () => import('./features/stripe-checkout.block'),
  'feature/stripe-webhook': () => import('./features/stripe-webhook.block'),
  'feature/stripe-billing-page': () => import('./features/stripe-billing-page.block'),
  'feature/usage-tracking': () => import('./features/usage-tracking.block'),
  'feature/file-upload': () => import('./features/file-upload.block'),
  'feature/search': () => import('./features/search.block'),
  'feature/email-resend': () => import('./features/email-resend.block'),
  'feature/pdf-export': () => import('./features/pdf-export.block'),
  'feature/interactive-wizard': () => import('./features/interactive-wizard.block'),
  'feature/data-charts': () => import('./features/data-charts.block'),
  'feature/csv-processor': () => import('./features/csv-processor.block'),
  'feature/ai-chatbot': () => import('./features/ai-chatbot.block'),
  // Extended features
  'feature/notification-system': () => import('./features/notification-system.block'),
  'feature/comparison-table': () => import('./features/comparison-table.block'),
  'feature/activity-timeline': () => import('./features/activity-timeline.block'),
  'feature/social-sharing': () => import('./features/social-sharing.block'),
  'feature/dark-mode-toggle': () => import('./features/dark-mode-toggle.block'),
  'feature/calendar-scheduler': () => import('./features/calendar-scheduler.block'),
  'feature/kanban-board': () => import('./features/kanban-board.block'),
  'feature/rich-text-editor': () => import('./features/rich-text-editor.block'),
  'feature/voice-input': () => import('./features/voice-input.block'),
  'feature/qr-code-generator': () => import('./features/qr-code-generator.block'),
  'feature/referral-system': () => import('./features/referral-system.block'),
  'feature/api-key-management': () => import('./features/api-key-management.block'),
  'feature/webhook-receiver': () => import('./features/webhook-receiver.block'),
  'feature/cron-scheduler': () => import('./features/cron-scheduler.block'),
  'feature/feedback-collector': () => import('./features/feedback-collector.block'),
  'feature/waitlist-prelaunch': () => import('./features/waitlist-prelaunch.block'),
  'feature/pricing-page': () => import('./features/pricing-page.block'),
  'feature/blog-cms': () => import('./features/blog-cms.block'),
  'feature/comments-discussion': () => import('./features/comments-discussion.block'),
  'feature/multi-workspace': () => import('./features/multi-workspace.block'),
  'feature/multi-language': () => import('./features/multi-language.block'),
  'feature/image-ai-generator': () => import('./features/image-ai-generator.block'),
  'feature/data-export-multi': () => import('./features/data-export-multi.block'),
  'feature/seo-toolkit': () => import('./features/seo-toolkit.block'),
  'feature/onboarding-tour': () => import('./features/onboarding-tour.block'),
  // Niche-specific
  'feature/health-disclaimer': () => import('./features/health-disclaimer.block'),
  'feature/health-tracker': () => import('./features/health-tracker.block'),
  'feature/financial-calculator': () => import('./features/financial-calculator.block'),
  'feature/invoice-generator': () => import('./features/invoice-generator.block'),
  'feature/learning-progress': () => import('./features/learning-progress.block'),
  'feature/certificate-generator': () => import('./features/certificate-generator.block'),
  // E-commerce & media
  'feature/product-catalog': () => import('./features/product-catalog.block'),
  'feature/shopping-cart': () => import('./features/shopping-cart.block'),
  'feature/wishlist': () => import('./features/wishlist.block'),
  'feature/booking-system': () => import('./features/booking-system.block'),
  'feature/image-gallery': () => import('./features/image-gallery.block'),
  'feature/video-player': () => import('./features/video-player.block'),
  // Content & communication
  'feature/faq-accordion': () => import('./features/faq-accordion.block'),
  'feature/testimonials': () => import('./features/testimonials.block'),
  'feature/changelog': () => import('./features/changelog.block'),
  'feature/file-manager': () => import('./features/file-manager.block'),
  'feature/email-templates': () => import('./features/email-templates.block'),
  'feature/contact-form': () => import('./features/contact-form.block'),
  // Data & visualization
  'feature/in-app-messaging': () => import('./features/in-app-messaging.block'),
  'feature/announcement-banner': () => import('./features/announcement-banner.block'),
  'feature/map-location': () => import('./features/map-location.block'),
  'feature/data-table-advanced': () => import('./features/data-table-advanced.block'),
  'feature/tree-view': () => import('./features/tree-view.block'),
  'feature/stats-dashboard': () => import('./features/stats-dashboard.block'),
  // Advanced AI
  'feature/ai-text-to-speech': () => import('./features/ai-text-to-speech.block'),
  'feature/ai-summarizer': () => import('./features/ai-summarizer.block'),
  'feature/ai-translator': () => import('./features/ai-translator.block'),
  'feature/ai-content-writer': () => import('./features/ai-content-writer.block'),
  // UX & engagement
  'feature/onboarding-checklist': () => import('./features/onboarding-checklist.block'),
  'feature/gamification': () => import('./features/gamification.block'),
  'feature/user-profile-page': () => import('./features/user-profile-page.block'),
  'feature/cookie-consent': () => import('./features/cookie-consent.block'),
  // Pages
  'page/landing': () => import('./pages/landing-page.block'),
  'page/dashboard': () => import('./pages/dashboard-page.block'),
  'page/create': () => import('./pages/create-page.block'),
  'page/analysis': () => import('./pages/analysis-page.block'),
  'page/settings': () => import('./pages/settings-page.block'),
  'page/admin': () => import('./pages/admin-page.block'),
  'page/history': () => import('./pages/history-page.block'),
  'page/clients': () => import('./pages/clients-page.block'),
  'page/reports': () => import('./pages/reports-page.block'),
  'page/legal': () => import('./pages/legal-pages.block'),
  // API
  'api/analyze': () => import('./api/analyze-route.block'),
  'api/send-email': () => import('./api/send-email-route.block'),
  'api/crud-routes': () => import('./api/crud-routes.block'),
  'api/error-handler': () => import('./api/error-handler.block'),
  // SaaS
  'project-type/saas-subscription': () => import('./project-types/saas/subscription-management.block'),
  'project-type/saas-team': () => import('./project-types/saas/team-management.block'),
  // Marketplace
  'project-type/marketplace-listings': () => import('./project-types/marketplace/listings.block'),
  'project-type/marketplace-reviews': () => import('./project-types/marketplace/reviews.block'),
  'project-type/marketplace-messaging': () => import('./project-types/marketplace/messaging.block'),
  'project-type/marketplace-search': () => import('./project-types/marketplace/search-filters.block'),
  // PWA
  'project-type/pwa-manifest': () => import('./project-types/pwa/manifest.block'),
  'project-type/pwa-service-worker': () => import('./project-types/pwa/service-worker.block'),
  'project-type/pwa-offline': () => import('./project-types/pwa/offline-page.block'),
};

// ─── Main Assembly Function ───

export async function assembleProject(input: AssemblyInput): Promise<AssemblyOutput> {
  const startTime = Date.now();
  const { product_spec, project_name } = input;

  // Step 1: Build context
  const projectType = input.project_type || inferProjectType(product_spec);
  const design: DesignSystem = product_spec.design_system || DEFAULT_DESIGN;

  // ── Sanitize helper: strip non-ASCII, collapse whitespace, fallback ──
  function toEnglish(raw: string, fallback: string): string {
    const cleaned = raw.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned.length > 1 ? cleaned : fallback;
  }
  function capWords(text: string, max: number): string {
    const words = text.split(/\s+/);
    return words.length > max ? words.slice(0, max).join(' ') : text;
  }

  // All user-facing text must be English-only (non-ASCII stripped)
  const cappedPrimaryOutput = capWords(
    toEnglish(product_spec.user_output?.primary_output || '', 'Result'), 3
  );
  const cappedValueProp = capWords(
    toEnglish(product_spec.user_output?.value_proposition || '', ''), 10
  );
  const shortHeadline = cappedValueProp
    || `Smart ${cappedPrimaryOutput} for Your Business`;
  const cappedProjectName = capWords(
    toEnglish(project_name, 'My Project'), 5
  );
  const cleanTimeToValue = toEnglish(
    product_spec.user_flow?.total_time_to_value || '', ''
  );
  const cleanPrimaryInput = toEnglish(
    product_spec.user_input?.primary_input || '', 'Enter your data'
  );
  const cleanAhaMoment = toEnglish(
    product_spec.user_flow?.aha_moment || '', ''
  );
  const cleanMagicDesc = toEnglish(
    product_spec.magic_location?.description?.split('.')[0] || '', ''
  );

  const ctx: BlockContext = {
    project_name,
    project_slug: project_name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'),
    project_description: cappedValueProp,
    project_type: projectType,
    design,
    derived_features: product_spec.derived_features || [],
    supabase: {
      required: product_spec.technical_requirements.database_required ||
                product_spec.technical_requirements.auth_required,
      tables: [],
    },
    stripe: {
      required: product_spec.monetization.model === 'subscription' ||
                product_spec.monetization.model === 'freemium',
      plans: (product_spec.monetization.pricing_tiers || []).map(t => ({
        name: t.name,
        price: parseFloat(t.price.replace(/[^0-9.]/g, '')) || 0,
        features: t.features,
        limits: {},
      })),
    },
    auth: {
      required: product_spec.technical_requirements.auth_required,
      providers: ['email', 'google'],
      protected_routes: ['/dashboard/settings', '/dashboard/billing'],
    },
    product_spec,
    safe: {
      projectName: escapeJsx(cappedProjectName),
      projectDescription: escapeJsx(cappedValueProp),
      headline: escapeJsx(shortHeadline),
      primaryOutput: escapeJsx(cappedPrimaryOutput),
      primaryInput: escapeJsx(cleanPrimaryInput),
      ahaMoment: escapeJsx(cleanAhaMoment),
      timeToValue: escapeJsx(cleanTimeToValue),
      magicDescription: escapeJsx(cleanMagicDesc),
      magicType: product_spec.magic_location?.type || 'ai_analysis',
      outputFormat: product_spec.user_output?.output_format || 'text',
    },
    env_vars: new Map(),
    dependencies: new Map(),
    devDependencies: new Map(),
    migrations: [],
    generated_paths: new Set(),
  };

  // Step 2: Select blocks
  const selectedBlockIds = selectBlocks(ctx);
  console.log(`[assembler] Selected ${selectedBlockIds.length} blocks for "${projectType}" project`);

  // Step 3: Topological sort
  const sortedBlockIds = topologicalSort(selectedBlockIds);

  // Move aggregator blocks to the end (they read accumulated data)
  const aggregators = ['foundation/app-providers', 'foundation/package-json', 'foundation/env-example', 'foundation/readme'];
  const regularBlocks = sortedBlockIds.filter(id => !aggregators.includes(id));
  const finalOrder = [...regularBlocks, ...aggregators.filter(id => sortedBlockIds.includes(id))];

  // Step 4: Execute blocks
  let allFiles: Record<string, string> = {};

  for (const blockId of finalOrder) {
    const entry = getBlock(blockId);
    if (!entry) continue;

    // Register env vars, packages
    for (const env of entry.requires_env) {
      ctx.env_vars.set(env.name, { example: env.example, description: env.description });
    }
    for (const [pkg, ver] of Object.entries(entry.requires_packages)) {
      ctx.dependencies.set(pkg, ver);
    }
    for (const [pkg, ver] of Object.entries(entry.requires_dev_packages || {})) {
      ctx.devDependencies.set(pkg, ver);
    }

    // Load and execute block
    const loader = BLOCK_LOADERS[blockId];
    if (!loader) {
      console.warn(`[assembler] No loader for block: ${blockId}`);
      continue;
    }

    try {
      const mod = await loader();
      const blockFn: BlockFunction = mod.default;
      const result: BlockResult = blockFn(ctx);

      for (const [path, content] of Object.entries(result)) {
        allFiles[path] = content;
        ctx.generated_paths.add(path);
      }
    } catch (err) {
      console.error(`[assembler] Error executing block ${blockId}:`, err);
    }
  }

  console.log(`[assembler] Blocks produced ${Object.keys(allFiles).length} files`);

  // Step 5: Find feature gaps
  const coveredKeywords = new Set<string>();
  for (const blockId of finalOrder) {
    const entry = getBlock(blockId);
    if (entry) {
      entry.feature_triggers.forEach(t => coveredKeywords.add(t.toLowerCase()));
    }
  }

  const uncoveredFeatures = (ctx.derived_features || []).filter(f => {
    const words = `${f.feature_name} ${f.solution}`.toLowerCase().split(/\s+/);
    return !words.some(w => coveredKeywords.has(w));
  });

  // Step 6: Gap filler
  let customFiles: Record<string, string> = {};
  let claudeCalls = 0;

  if (uncoveredFeatures.length > 0) {
    console.log(`[assembler] ${uncoveredFeatures.length} unique features need custom code`);
    try {
      const { fillGaps } = await import('./custom/gap-filler');
      customFiles = await fillGaps(ctx, uncoveredFeatures, Object.keys(allFiles));
      claudeCalls = 1;

      for (const [path, content] of Object.entries(customFiles)) {
        // Never overwrite block-generated files with gap-filler output
        if (allFiles[path]) {
          console.warn(`[assembler] Gap-filler tried to overwrite block file: ${path} — skipping`);
          continue;
        }
        allFiles[path] = content;
        ctx.generated_paths.add(path);
      }
    } catch (err) {
      console.error('[assembler] Gap filler error:', err);
    }
  }

  const assemblyTime = Date.now() - startTime;
  console.log(`[assembler] Assembly complete: ${Object.keys(allFiles).length} files in ${assemblyTime}ms`);

  return {
    files: allFiles,
    blocks_used: finalOrder,
    custom_files: Object.keys(customFiles),
    total_files: Object.keys(allFiles).length,
    assembly_time_ms: assemblyTime,
    claude_calls: claudeCalls,
  };
}

// ─── Helpers ───

function inferProjectType(spec: ProductSpecification): ProjectType {
  const approach = spec.generation_approach;
  if (approach === 'marketplace') return 'marketplace';

  const hints = [
    spec.user_output.primary_output,
    spec.user_output.value_proposition,
  ].join(' ').toLowerCase();

  if (hints.includes('mobile') || hints.includes('offline') || hints.includes('pwa')) {
    return 'pwa';
  }
  return 'saas';
}

function selectBlocks(ctx: BlockContext): string[] {
  const selected = new Set<string>();

  for (const block of BLOCKS_MANIFEST) {
    // Check project type compatibility
    if (block.project_types !== 'all' && !block.project_types.includes(ctx.project_type)) {
      continue;
    }

    let shouldInclude = false;

    // Foundation always
    if (block.category === 'foundation') {
      shouldInclude = true;
    }

    // Tech triggers
    for (const trigger of block.tech_triggers) {
      if (trigger === 'auth_required' && ctx.auth.required) shouldInclude = true;
      if (trigger === 'database_required' && ctx.supabase.required) shouldInclude = true;
      if (trigger.startsWith('apis_needed:')) {
        const api = trigger.split(':')[1];
        const apis = ctx.product_spec.technical_requirements.apis_needed || [];
        if (apis.some(a => a.name.toLowerCase().includes(api))) {
          shouldInclude = true;
        }
      }
    }

    // Feature triggers
    if (block.feature_triggers.length > 0 && ctx.derived_features) {
      const featureText = ctx.derived_features
        .map(f => `${f.feature_name} ${f.solution} ${f.implementation_hint}`)
        .join(' ')
        .toLowerCase();

      for (const trigger of block.feature_triggers) {
        if (featureText.includes(trigger.toLowerCase())) {
          shouldInclude = true;
          break;
        }
      }
    }

    // Auto-include stripe blocks when stripe is required
    if (block.id.startsWith('feature/stripe') && ctx.stripe.required) {
      shouldInclude = true;
    }

    // Core UI always
    const coreUI = ['ui/header', 'ui/footer', 'ui/loading-states', 'ui/dashboard-nav', 'ui/dashboard-layout', 'ui/toast', 'feature/multi-language'];
    if (coreUI.includes(block.id)) shouldInclude = true;

    // Core pages always
    const corePages = ['page/landing', 'page/dashboard', 'page/create', 'page/analysis', 'page/settings', 'page/history', 'page/clients', 'page/reports', 'page/legal'];
    if (corePages.includes(block.id)) shouldInclude = true;

    // Core API always
    const coreAPIs = ['api/error-handler', 'api/analyze', 'api/send-email'];
    if (coreAPIs.includes(block.id)) shouldInclude = true;

    if (shouldInclude) {
      selected.add(block.id);
    }
  }

  // Resolve transitive dependencies
  const resolved = new Set<string>();
  function resolve(id: string) {
    if (resolved.has(id)) return;
    const entry = BLOCKS_MANIFEST.find(b => b.id === id);
    if (!entry) return;
    for (const dep of entry.depends_on) {
      resolve(dep);
    }
    resolved.add(id);
  }
  for (const id of selected) {
    resolve(id);
  }

  return Array.from(resolved);
}

function topologicalSort(blockIds: string[]): string[] {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of blockIds) {
    graph.set(id, []);
    inDegree.set(id, 0);
  }

  for (const id of blockIds) {
    const entry = BLOCKS_MANIFEST.find(b => b.id === id);
    if (!entry) continue;
    for (const dep of entry.depends_on) {
      if (blockIds.includes(dep)) {
        graph.get(dep)!.push(id);
        inDegree.set(id, (inDegree.get(id) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of graph.get(current) || []) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }

  return sorted;
}
