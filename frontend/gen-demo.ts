import { assembleProject } from './src/lib/blocks/block-assembler';
import type { ProductSpecification } from './src/lib/mvp-templates/types';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(__dirname, '_test-demo');

const maxSpec: ProductSpecification = {
  user_output: {
    primary_output: 'AI-powered market analysis report',
    output_format: 'report',
    example: 'Detailed analysis of competitor landscape',
    value_proposition: 'Get instant AI market analysis with actionable insights',
  },
  user_input: {
    primary_input: 'Enter a market or product name',
    input_type: 'text',
    required_fields: [
      { name: 'query', type: 'text', description: 'Market or product to analyze', example: 'AI fitness apps' },
      { name: 'region', type: 'select', description: 'Target region', example: 'US' },
    ],
  },
  user_flow: {
    steps: [
      { step_number: 1, action: 'Enter your market query', user_sees: 'Input form', time_to_complete: '30s' },
      { step_number: 2, action: 'Review analysis', user_sees: 'Results dashboard', time_to_complete: '2m' },
    ],
    total_time_to_value: '3 minutes',
    aha_moment: 'Seeing competitor weaknesses you can exploit',
  },
  magic_location: {
    type: 'ai_analysis',
    description: 'AI analyzes market data and generates strategic insights.',
    technical_approach: 'GPT-4 with structured prompts',
  },
  technical_requirements: {
    apis_needed: [
      { name: 'openai', purpose: 'AI analysis', free_tier_available: false },
      { name: 'stripe', purpose: 'Payments', free_tier_available: true },
      { name: 'resend', purpose: 'Emails', free_tier_available: true },
    ],
    database_required: true,
    auth_required: true,
    recommended_stack: { frontend: 'Next.js', backend: 'Next.js API', database: 'Supabase', ai_provider: 'OpenAI' },
  },
  monetization: {
    model: 'subscription',
    pricing_tiers: [
      { name: 'Free', price: '$0', features: ['5 analyses/month', 'Basic reports'] },
      { name: 'Pro', price: '$29', features: ['100 analyses/month', 'Advanced reports', 'API access'] },
      { name: 'Enterprise', price: '$99', features: ['Unlimited', 'Custom reports', 'Team access'] },
    ],
    reasoning: 'SaaS subscription model',
  },
  current_user_solution: {
    how_they_solve_now: 'Manual research',
    pain_points_with_current: ['Takes hours', 'Incomplete data'],
    our_advantage: 'AI automation',
    switching_cost: 'low',
  },
  design_system: {
    color_palette: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#f59e0b', background: '#0f0f23', text: '#e2e8f0' },
    typography: { headings: 'Inter', body: 'Inter', mono: 'JetBrains Mono' },
    unique_elements: ['gradient cards', 'glass morphism panels'],
    design_rationale: 'Modern dark theme',
  },
  derived_features: [
    { feature_name: 'Product Catalog', pain_source: 'unmet_need', pain_quote: 'catalog shop store', solution: 'catalog каталог товары магазин', priority: 'should_have', implementation_hint: 'products' },
    { feature_name: 'Shopping Cart', pain_source: 'unmet_need', pain_quote: 'cart checkout', solution: 'cart корзина покупка', priority: 'should_have', implementation_hint: 'cart' },
    { feature_name: 'Wishlist', pain_source: 'unmet_need', pain_quote: 'favorites', solution: 'wishlist favorites избранное', priority: 'nice_to_have', implementation_hint: 'wishlist' },
    { feature_name: 'AI Chatbot', pain_source: 'synthesis', pain_quote: 'chat', solution: 'chatbot чатбот', priority: 'must_have', implementation_hint: 'chatbot' },
    { feature_name: 'Data Charts', pain_source: 'complaint', pain_quote: 'charts', solution: 'charts analytics графики', priority: 'must_have', implementation_hint: 'charts' },
    { feature_name: 'Dark Mode', pain_source: 'complaint', pain_quote: 'dark theme', solution: 'dark mode тёмная тема', priority: 'should_have', implementation_hint: 'dark mode' },
    { feature_name: 'Search', pain_source: 'complaint', pain_quote: 'search', solution: 'search поиск', priority: 'must_have', implementation_hint: 'search' },
    { feature_name: 'FAQ', pain_source: 'unmet_need', pain_quote: 'faq', solution: 'faq частые вопросы', priority: 'should_have', implementation_hint: 'faq' },
    { feature_name: 'Testimonials', pain_source: 'unmet_need', pain_quote: 'social proof', solution: 'testimonials отзывы', priority: 'should_have', implementation_hint: 'testimonials' },
    { feature_name: 'Contact Form', pain_source: 'unmet_need', pain_quote: 'contact', solution: 'contact обратная связь', priority: 'should_have', implementation_hint: 'contact' },
    { feature_name: 'Notifications', pain_source: 'unmet_need', pain_quote: 'notified', solution: 'notification уведомления', priority: 'should_have', implementation_hint: 'notification' },
    { feature_name: 'Cookie Consent', pain_source: 'unmet_need', pain_quote: 'cookie', solution: 'cookie consent gdpr', priority: 'should_have', implementation_hint: 'cookie' },
    { feature_name: 'PDF Export', pain_source: 'complaint', pain_quote: 'download pdf', solution: 'pdf export скачать', priority: 'should_have', implementation_hint: 'pdf' },
    { feature_name: 'File Upload', pain_source: 'complaint', pain_quote: 'upload', solution: 'file upload загрузка', priority: 'should_have', implementation_hint: 'upload' },
    { feature_name: 'Pricing Page', pain_source: 'unmet_need', pain_quote: 'pricing', solution: 'pricing цены', priority: 'must_have', implementation_hint: 'pricing' },
  ],
  confidence_score: 0.9,
  generation_approach: 'ai-tool',
  mvp_complexity: 'complex',
};

async function main() {
  console.log('Assembling demo project...');
  const result = await assembleProject({ product_spec: maxSpec, project_name: 'MaxTest App', project_type: 'saas' });
  console.log(`${result.blocks_used.length} blocks → ${result.total_files} files (${result.assembly_time_ms}ms)`);

  if (fs.existsSync(TEST_DIR)) {
    // Remove only src and supabase dirs to avoid locked node_modules
    for (const sub of ['src', 'supabase', '.next']) {
      const p = path.join(TEST_DIR, sub);
      if (fs.existsSync(p)) fs.rmSync(p, { recursive: true });
    }
  }

  for (const [filePath, content] of Object.entries(result.files)) {
    const fullPath = path.join(TEST_DIR, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
  console.log(`Written to ${TEST_DIR}`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
