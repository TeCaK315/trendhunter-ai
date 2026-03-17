/**
 * Block System Types
 *
 * Core interfaces for the modular code block assembly system.
 * Each block is a function that receives BlockContext and returns file paths → content.
 */

import type { ProductSpecification } from '../mvp-templates/types';

// ─── Design System ───

export interface DesignSystem {
  color_palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    headings: string;
    body: string;
    mono?: string;
  };
  unique_elements: string[];
  design_rationale?: string;
}

// ─── Project Types ───

export type ProjectType = 'saas' | 'marketplace' | 'pwa';

// ─── Block Context ───

export interface BlockContext {
  // Project identity
  project_name: string;
  project_slug: string;
  project_description: string;
  project_type: ProjectType;

  // Design (always present)
  design: DesignSystem;

  // Features derived from real user pain data
  derived_features: NonNullable<ProductSpecification['derived_features']>;

  // Technical configuration
  supabase: {
    required: boolean;
    tables: string[];
  };
  stripe: {
    required: boolean;
    plans: Array<{
      name: string;
      price: number;
      features: string[];
      limits: Record<string, number>;
    }>;
  };
  auth: {
    required: boolean;
    providers: ('email' | 'google' | 'github')[];
    protected_routes: string[];
  };

  // ProductSpec reference
  product_spec: ProductSpecification;

  // Safe escaped strings for JSX interpolation
  safe: {
    projectName: string;
    projectDescription: string;
    // Product-spec derived (pre-escaped)
    headline: string;
    primaryOutput: string;
    primaryInput: string;
    ahaMoment: string;
    timeToValue: string;
    magicDescription: string;
    magicType: string;
    outputFormat: string;
  };

  // Accumulators (blocks register their needs, aggregator blocks read them)
  env_vars: Map<string, { example: string; description: string }>;
  dependencies: Map<string, string>;
  devDependencies: Map<string, string>;
  migrations: string[];
  generated_paths: Set<string>;
}

// ─── Block Function ───

/** What a block returns: file_path → file_content */
export type BlockResult = Record<string, string>;

/** Every block exports a function with this signature */
export type BlockFunction = (ctx: BlockContext) => BlockResult;

// ─── Block Manifest ───

export type BlockCategory =
  | 'foundation'
  | 'auth'
  | 'database'
  | 'ui'
  | 'feature'
  | 'page'
  | 'api'
  | 'project-type';

export interface BlockManifestEntry {
  id: string;
  name: string;
  category: BlockCategory;
  description: string;

  /** Other block IDs that must be loaded first */
  depends_on: string[];

  /** Which project types can use this block (empty array = all) */
  project_types: ProjectType[] | 'all';

  /** Keywords from derived_features that trigger this block */
  feature_triggers: string[];

  /** Technical requirements that activate this block */
  tech_triggers: string[];

  /** Files this block generates */
  produces_files: string[];

  /** Env vars this block needs */
  requires_env: Array<{ name: string; example: string; description: string }>;

  /** NPM packages this block needs */
  requires_packages: Record<string, string>;
  requires_dev_packages?: Record<string, string>;

  /** SQL migration snippets */
  requires_migrations?: string[];
}
