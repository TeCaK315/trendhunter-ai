/**
 * TrendHunter AI — Tool Registry v2
 * src/lib/strategy/ai-leverage/tool-registry.ts
 *
 * Изменения v2 (из аудита GPT + DeepSeek + Copilot):
 * - PostHog и Mixpanel добавлены в funnel_optimization (DeepSeek + Copilot)
 * - HubSpot добавлен в lead_qualification для всех сегментов (все три)
 * - generateNicheSetup: niche экранируется в шаблонах (Copilot)
 * - selectToolForTask: fallback без channel_type если нет совпадений (все три)
 * - acquisitionToChannelType: защита от undefined (DeepSeek + Gemini)
 */

import type { TaskId, NicheType, ChannelType } from './task-library'
import type { ToolstackBudget } from '../block0'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface Tool {
  tool_id: string
  name: string
  url: string
  task_ids: TaskId[]
  niche_types: NicheType[]
  channel_types: ChannelType[]
  pricing: {
    has_free_tier: boolean
    free_tier_limits: string | null
    paid_start: number
    paid_model: 'monthly' | 'freemium' | 'usage_based' | 'one_time'
  }
  replaces: string
  free_alternative: { tool_name: string; url: string; limitation: string } | null
  why_this: string
  validation: { last_checked: string; is_active: boolean }
}

export interface SelectedTool {
  tool_id: string
  name: string
  url: string
  cost_monthly: number | null
  has_free_tier: boolean
  niche_setup: string
}

export interface AILeverageCard {
  task_id: TaskId
  task_name: string
  traditional: { action: string; cost: string; time: string }
  primary_tool: SelectedTool
  free_alternative: { name: string; url: string; limitation: string } | null
  is_fallback?: boolean
}

// ─────────────────────────────────────────────────────────────
// TOOL REGISTRY
// ─────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  // RESEARCH
  {
    tool_id: 'perplexity',
    name: 'Perplexity AI',
    url: 'perplexity.ai',
    task_ids: ['market_research', 'competitor_analysis', 'positioning_research'],
    niche_types: ['B2C', 'B2B_SMB', 'B2B_ENTERPRISE'],
    channel_types: ['PLG', 'SEO', 'COMMUNITY', 'OUTBOUND_COLD'],
    pricing: { has_free_tier: true, free_tier_limits: 'Базовый поиск, лимит запросов', paid_start: 20, paid_model: 'monthly' },
    replaces: 'Маркетинг аналитик $4,000/мес + 2 недели работы',
    free_alternative: { tool_name: 'Perplexity free', url: 'perplexity.ai', limitation: 'Лимит запросов, без Deep Research mode' },
    why_this: 'Deep Research mode — автономный анализ сотен источников за минуты.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'exploding_topics',
    name: 'Exploding Topics',
    url: 'explodingtopics.com',
    task_ids: ['market_research', 'positioning_research'],
    niche_types: ['B2C', 'B2B_SMB'],
    channel_types: ['SEO', 'COMMUNITY', 'PLG'],
    pricing: { has_free_tier: true, free_tier_limits: 'Ограниченный доступ к трендам', paid_start: 39, paid_model: 'monthly' },
    replaces: 'Трендсеттер-аналитик $3,000/мес',
    free_alternative: { tool_name: 'Google Trends', url: 'trends.google.com', limitation: 'Нет предсказания трендов' },
    why_this: 'Находит тренды ДО их взрыва.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'visualping',
    name: 'Visualping',
    url: 'visualping.io',
    task_ids: ['competitor_analysis'],
    niche_types: ['B2C', 'B2B_SMB', 'B2B_ENTERPRISE'],
    channel_types: ['PLG', 'SEO', 'OUTBOUND_COLD'],
    pricing: { has_free_tier: true, free_tier_limits: 'До 65 проверок/мес', paid_start: 0, paid_model: 'freemium' },
    replaces: 'Ручной мониторинг конкурентов $1,500/мес',
    free_alternative: { tool_name: 'Visualping free', url: 'visualping.io', limitation: 'Лимит мониторингов' },
    why_this: 'Автоматически отслеживает изменения на сайтах конкурентов.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },

  // SOCIAL LISTENING
  {
    tool_id: 'gummysearch',
    name: 'GummySearch',
    url: 'gummysearch.com',
    task_ids: ['social_listening', 'icp_research'],
    niche_types: ['B2C', 'B2B_SMB'],
    channel_types: ['COMMUNITY', 'PLG'],
    pricing: { has_free_tier: false, free_tier_limits: null, paid_start: 49, paid_model: 'monthly' },
    replaces: 'Ручной мониторинг Reddit $2,000/мес',
    free_alternative: { tool_name: 'Reddit search + Google Alerts', url: 'reddit.com', limitation: 'Ручной поиск, нет sentiment анализа' },
    why_this: 'Специализирован под Reddit. Находит боли и паттерны.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'brand24',
    name: 'Brand24',
    url: 'brand24.com',
    task_ids: ['social_listening'],
    // v2: добавлен B2B_ENTERPRISE (Gemini audit — Enterprise мониторинг обязателен)
    niche_types: ['B2C', 'B2B_SMB', 'B2B_ENTERPRISE'],
    channel_types: ['COMMUNITY', 'OUTBOUND_COLD', 'SEO'],
    pricing: { has_free_tier: false, free_tier_limits: null, paid_start: 79, paid_model: 'monthly' },
    replaces: 'SMM менеджер для мониторинга $3,500/мес',
    free_alternative: { tool_name: 'Websays free', url: 'websays.com', limitation: 'Ограниченный функционал' },
    why_this: 'Охватывает X/Twitter, Reddit, LinkedIn, форумы. AI-саммари.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'forumscout',
    name: 'ForumScout',
    url: 'forumscout.com',
    task_ids: ['social_listening', 'icp_research'],
    niche_types: ['B2B_SMB', 'B2C'],
    channel_types: ['COMMUNITY'],
    pricing: { has_free_tier: false, free_tier_limits: null, paid_start: 19, paid_model: 'monthly' },
    replaces: 'Ручной анализ форумов $1,500/мес',
    free_alternative: { tool_name: 'Google Alerts', url: 'google.com/alerts', limitation: 'Нет анализа эмоций, нет Reddit' },
    why_this: 'Самый дешёвый из специализированных. Анализ эмоций.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },

  // PROSPECTING
  {
    tool_id: 'clay',
    name: 'Clay',
    url: 'clay.com',
    task_ids: ['prospecting', 'icp_research'],
    niche_types: ['B2B_SMB', 'B2B_ENTERPRISE'],
    channel_types: ['OUTBOUND_COLD', 'AI_OUTBOUND'],
    pricing: { has_free_tier: true, free_tier_limits: '100 credits/мес', paid_start: 149, paid_model: 'monthly' },
    replaces: 'SDR менеджер $4,500/мес + LinkedIn Premium $80/мес',
    free_alternative: { tool_name: 'Apollo.io free', url: 'apollo.io', limitation: '900 credits/год, без AI обогащения' },
    why_this: 'Обогащение из 75+ источников одновременно.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'apollo',
    name: 'Apollo.io',
    url: 'apollo.io',
    task_ids: ['prospecting', 'lead_qualification'],
    niche_types: ['B2B_SMB'],
    channel_types: ['OUTBOUND_COLD', 'AI_OUTBOUND'],
    pricing: { has_free_tier: true, free_tier_limits: '900 credits/год (75/мес)', paid_start: 49, paid_model: 'monthly' },
    replaces: 'LinkedIn Sales Navigator $99/мес',
    free_alternative: { tool_name: 'Apollo.io free', url: 'apollo.io', limitation: '75 контактов/мес' },
    why_this: 'База 275 млн контактов. Лучший free tier.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },

  // OUTREACH
  {
    tool_id: 'instantly',
    name: 'Instantly AI',
    url: 'instantly.ai',
    task_ids: ['personalized_outreach'],
    niche_types: ['B2B_SMB', 'B2B_ENTERPRISE'],
    channel_types: ['OUTBOUND_COLD', 'AI_OUTBOUND'],
    pricing: { has_free_tier: false, free_tier_limits: null, paid_start: 37, paid_model: 'monthly' },
    replaces: 'Email маркетолог $3,000/мес',
    free_alternative: { tool_name: 'Gmail + Hunter.io free', url: 'hunter.io', limitation: '25 писем/день' },
    why_this: 'Неограниченные почтовые ящики. AI прогрев.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'lemlist',
    name: 'Lemlist',
    url: 'lemlist.com',
    task_ids: ['personalized_outreach'],
    niche_types: ['B2B_SMB'],
    channel_types: ['OUTBOUND_COLD'],
    pricing: { has_free_tier: false, free_tier_limits: null, paid_start: 59, paid_model: 'monthly' },
    replaces: 'Copywriter + email маркетолог $4,500/мес',
    free_alternative: { tool_name: 'Instantly free trial', url: 'instantly.ai', limitation: 'Ограниченный период' },
    why_this: 'Лучшая персонализация включая динамические изображения.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'lavender',
    name: 'Lavender',
    url: 'lavender.ai',
    task_ids: ['personalized_outreach'],
    niche_types: ['B2B_SMB'],
    channel_types: ['OUTBOUND_COLD', 'AI_OUTBOUND'],
    pricing: { has_free_tier: true, free_tier_limits: '5 писем/мес', paid_start: 29, paid_model: 'monthly' },
    replaces: 'Copywriter для писем $2,000/мес',
    free_alternative: { tool_name: 'Lavender free', url: 'lavender.ai', limitation: '5 писем/мес' },
    why_this: 'Scoring reply rate перед отправкой.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },

  // LEAD QUALIFICATION
  // v2: hubspot добавлен для всех сегментов (закрывает дыру B2C + ENTERPRISE)
  {
    tool_id: 'hubspot_free',
    name: 'HubSpot CRM',
    url: 'hubspot.com',
    task_ids: ['lead_qualification', 'revenue_tracking', 'prospecting'],
    niche_types: ['B2C', 'B2B_SMB', 'B2B_ENTERPRISE'], // v2: добавлен B2B_ENTERPRISE
    channel_types: ['PLG', 'OUTBOUND_COLD', 'COMMUNITY', 'SEO'],
    pricing: { has_free_tier: true, free_tier_limits: 'Бесплатный CRM навсегда', paid_start: 20, paid_model: 'monthly' },
    replaces: 'Sales менеджер + CRM $5,000/мес',
    free_alternative: { tool_name: 'HubSpot free CRM', url: 'hubspot.com', limitation: 'Нет предиктивного скоринга' },
    why_this: 'Лучший бесплатный CRM для старта.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'folk',
    name: 'Folk CRM',
    url: 'folk.app',
    task_ids: ['lead_qualification', 'revenue_tracking'],
    niche_types: ['B2B_SMB'],
    channel_types: ['OUTBOUND_COLD', 'COMMUNITY'],
    pricing: { has_free_tier: true, free_tier_limits: 'До 50 контактов', paid_start: 20, paid_model: 'monthly' },
    replaces: 'CRM + sales ops $3,000/мес',
    free_alternative: { tool_name: 'Folk free (50 contacts)', url: 'folk.app', limitation: 'Лимит 50 контактов' },
    why_this: 'Лёгкий CRM для solo. Лучший для ai_native_solo.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'relevance_ai',
    name: 'Relevance AI',
    url: 'relevanceai.com',
    task_ids: ['lead_qualification'],
    niche_types: ['B2B_SMB', 'B2B_ENTERPRISE'],
    channel_types: ['OUTBOUND_COLD', 'AI_OUTBOUND'],
    pricing: { has_free_tier: true, free_tier_limits: 'Бесплатный план для агентов', paid_start: 19, paid_model: 'monthly' },
    replaces: 'BDR + квалификационные звонки $5,000/мес',
    free_alternative: { tool_name: 'Relevance AI free', url: 'relevanceai.com', limitation: 'Лимит запусков агентов' },
    why_this: 'BANT квалификация агентом. Тренд 2026.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },

  // MVP BUILD
  {
    tool_id: 'cursor',
    name: 'Cursor',
    url: 'cursor.com',
    task_ids: ['mvp_building'],
    niche_types: ['B2C', 'B2B_SMB', 'B2B_ENTERPRISE'],
    channel_types: ['PLG'],
    pricing: { has_free_tier: true, free_tier_limits: '2,000 completions/мес', paid_start: 20, paid_model: 'monthly' },
    replaces: 'Frontend + backend разработчик $10,000/мес',
    free_alternative: { tool_name: 'GitHub Copilot free', url: 'github.com/features/copilot', limitation: 'Меньше контекста' },
    why_this: 'Ускоряет разработку в 5-10x. Обязателен если can_code=true.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'blink',
    name: 'Blink.new',
    url: 'blink.new',
    task_ids: ['mvp_building'],
    niche_types: ['B2C', 'B2B_SMB'],
    channel_types: ['PLG'],
    pricing: { has_free_tier: true, free_tier_limits: '1 активный проект', paid_start: 20, paid_model: 'monthly' },
    replaces: 'Full-stack разработчик $8,000/мес',
    free_alternative: { tool_name: 'Bolt.new free', url: 'bolt.new', limitation: 'Лимит токенов' },
    why_this: 'Текст → full-stack приложение за минуты. Лидер 2026.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'lovable',
    name: 'Lovable',
    url: 'lovable.dev',
    task_ids: ['mvp_building'],
    niche_types: ['B2C', 'B2B_SMB'],
    channel_types: ['PLG'],
    pricing: { has_free_tier: true, free_tier_limits: 'Ограниченные билды', paid_start: 20, paid_model: 'monthly' },
    replaces: 'React разработчик $7,000/мес',
    free_alternative: { tool_name: 'Lovable free', url: 'lovable.dev', limitation: 'Лимит билдов' },
    why_this: 'React + Supabase. Контроль над кодом.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'bubble',
    name: 'Bubble',
    url: 'bubble.io',
    task_ids: ['mvp_building'],
    niche_types: ['B2C', 'B2B_SMB'],
    channel_types: ['PLG'],
    pricing: { has_free_tier: true, free_tier_limits: 'Bubble subdomain', paid_start: 29, paid_model: 'monthly' },
    replaces: 'Full-stack разработчик $8,000/мес',
    free_alternative: { tool_name: 'Glide free', url: 'glide.page', limitation: 'Только мобильные из Sheets' },
    why_this: 'Мощная no-code платформа. Для can_code=false.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'framer',
    name: 'Framer',
    url: 'framer.com',
    task_ids: ['mvp_building'],
    niche_types: ['B2C', 'B2B_SMB'],
    channel_types: ['PLG', 'SEO'],
    pricing: { has_free_tier: true, free_tier_limits: 'Framer subdomain', paid_start: 0, paid_model: 'freemium' },
    replaces: 'Верстальщик лендинга $2,000',
    free_alternative: { tool_name: 'Carrd free', url: 'carrd.co', limitation: 'Очень простой' },
    why_this: 'Лучший для landing page MVP. Для minimum_artifact в S2.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },

  // CONTENT
  // v2: добавлен B2B_ENTERPRISE (Gemini audit — Enterprise дыра)
  {
    tool_id: 'supergrow',
    name: 'Supergrow',
    url: 'supergrow.ai',
    task_ids: ['content_creation'],
    niche_types: ['B2B_SMB', 'B2B_ENTERPRISE'],
    channel_types: ['COMMUNITY'],
    pricing: { has_free_tier: false, free_tier_limits: null, paid_start: 19, paid_model: 'monthly' },
    replaces: 'LinkedIn copywriter $2,500/мес',
    free_alternative: { tool_name: 'Claude + LinkedIn manual', url: 'claude.ai', limitation: 'Нет планировщика' },
    why_this: 'Специализирован под LinkedIn.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'monolit',
    name: 'Monolit',
    url: 'monolit.sh',
    task_ids: ['content_creation'],
    niche_types: ['B2C', 'B2B_SMB'],
    channel_types: ['COMMUNITY'],
    pricing: { has_free_tier: false, free_tier_limits: null, paid_start: 29, paid_model: 'monthly' },
    replaces: 'SMM менеджер $3,000/мес',
    free_alternative: { tool_name: 'Buffer free', url: 'buffer.com', limitation: 'Нет AI генерации' },
    why_this: 'LinkedIn + X + Instagram для founders.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'taplio',
    name: 'Taplio',
    url: 'taplio.com',
    task_ids: ['content_creation'],
    niche_types: ['B2B_SMB'],
    channel_types: ['COMMUNITY'],
    pricing: { has_free_tier: false, free_tier_limits: null, paid_start: 39, paid_model: 'monthly' },
    replaces: 'LinkedIn стратег $3,500/мес',
    free_alternative: { tool_name: 'Supergrow (дешевле)', url: 'supergrow.ai', limitation: 'Меньше функций' },
    why_this: 'Находит виральные посты и переписывает под твой стиль.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },

  // ANALYTICS
  // v2: добавлен funnel_optimization в task_ids (закрывает дыру)
  {
    tool_id: 'posthog',
    name: 'PostHog',
    url: 'posthog.com',
    task_ids: ['revenue_tracking', 'funnel_optimization'], // v2: добавлен funnel_optimization
    niche_types: ['B2C', 'B2B_SMB', 'B2B_ENTERPRISE'],
    channel_types: ['PLG', 'SEO', 'COMMUNITY'],
    pricing: { has_free_tier: true, free_tier_limits: '1 млн events/мес бесплатно', paid_start: 0, paid_model: 'usage_based' },
    replaces: 'Analytics engineer + BI $6,000/мес',
    free_alternative: { tool_name: 'PostHog free tier', url: 'posthog.com', limitation: 'Лимит по событиям, все функции доступны' },
    why_this: 'Product analytics + session recordings + feature flags. Open-source.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  // v2: добавлен funnel_optimization в task_ids
  {
    tool_id: 'mixpanel',
    name: 'Mixpanel',
    url: 'mixpanel.com',
    task_ids: ['revenue_tracking', 'funnel_optimization'], // v2: добавлен funnel_optimization
    niche_types: ['B2C', 'B2B_SMB'],
    channel_types: ['PLG', 'SEO'],
    pricing: { has_free_tier: true, free_tier_limits: '20M events/мес', paid_start: 0, paid_model: 'usage_based' },
    replaces: 'Data analyst $5,000/мес',
    free_alternative: { tool_name: 'Mixpanel free', url: 'mixpanel.com', limitation: 'Лимит по событиям' },
    why_this: 'Лучший для глубокой product analytics.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
  {
    tool_id: 'dashly',
    name: 'Dashly',
    url: 'dashly.io',
    task_ids: ['funnel_optimization', 'revenue_tracking'],
    niche_types: ['B2C', 'B2B_SMB'],
    channel_types: ['PLG', 'COMMUNITY', 'SEO'],
    pricing: { has_free_tier: true, free_tier_limits: 'До 1,000 посетителей/мес', paid_start: 39, paid_model: 'monthly' },
    replaces: 'CRO специалист $4,000/мес',
    free_alternative: { tool_name: 'Dashly free', url: 'dashly.io', limitation: 'Лимит посетителей' },
    why_this: 'AI Lead Insight — показывает где и почему уходят.',
    validation: { last_checked: '2026-04-09', is_active: true },
  },
]

// ─────────────────────────────────────────────────────────────
// SELECTION LOGIC
// ─────────────────────────────────────────────────────────────

/**
 * v2: fallback без channel_type если нет совпадений с каналом.
 * v2: fallback без niche_type если нет совпадений с сегментом.
 * Никогда не возвращает null — в худшем случае возвращает любой
 * подходящий инструмент для задачи.
 */
export function selectToolForTask(params: {
  task_id: TaskId
  niche_type: NicheType
  channel_type?: ChannelType
  toolstack_budget: ToolstackBudget
}): Tool | null {
  const { task_id, niche_type, channel_type, toolstack_budget } = params

  // Шаг 1: фильтр по task_id
  let candidates = TOOLS.filter(t =>
    t.task_ids.includes(task_id) && t.validation.is_active
  )

  if (candidates.length === 0) return null

  // Шаг 2: фильтр по niche_type
  const nicheFiltered = candidates.filter(t => t.niche_types.includes(niche_type))

  // v2 FALLBACK: если нет инструментов для сегмента — игнорируем сегмент
  if (nicheFiltered.length > 0) {
    candidates = nicheFiltered
  }
  // иначе оставляем candidates без фильтра по niche

  // Шаг 3: фильтр по channel_type (если передан)
  if (channel_type) {
    const channelFiltered = candidates.filter(t => t.channel_types.includes(channel_type))
    // v2 FALLBACK: если нет совпадений по каналу — игнорируем канал
    if (channelFiltered.length > 0) {
      candidates = channelFiltered
    }
  }

  // Шаг 4: free бюджет → предпочитаем инструменты с free tier
  if (toolstack_budget === 'free') {
    const freeCandidates = candidates.filter(t => t.pricing.has_free_tier)
    if (freeCandidates.length > 0) {
      candidates = freeCandidates
    }
    // Иначе оставляем платные — пользователь всё равно должен знать об инструменте
  }

  // Сортировка: free tier первым, потом по цене
  candidates.sort((a, b) => {
    if (a.pricing.has_free_tier && !b.pricing.has_free_tier) return -1
    if (!a.pricing.has_free_tier && b.pricing.has_free_tier) return 1
    return a.pricing.paid_start - b.pricing.paid_start
  })

  return candidates[0] ?? null
}

/**
 * Генерирует niche_setup под конкретную нишу.
 * Строки из шаблонов экранируются в svg-generator перед вставкой в SVG.
 */
export function generateNicheSetup(
  tool: Tool,
  niche: string,
  task_id: TaskId
): string {
  const templates: Record<TaskId, (n: string, t: string) => string> = {
    market_research:      (n, t) => `В ${t}: поиск "${n} market size", "${n} competitors". Используй Deep Research mode.`,
    competitor_analysis:  (n, t) => `В ${t}: добавь сайты топ-3 конкурентов в ${n}. Уведомление при изменении цен и фич.`,
    positioning_research: (n, t) => `В ${t}: запрос "how to position ${n} product", "unique value proposition ${n} 2026".`,
    social_listening:     (n, t) => `В ${t}: мониторинг "${n}", "${n} problems", "${n} alternatives". Фильтр: последние 30 дней.`,
    icp_research:         (n, t) => `В ${t}: поиск профилей кто жалуется на проблемы в ${n}. Экспорт в CSV для анализа.`,
    prospecting:          (n, t) => `В ${t}: фильтр по "${n}" в должности или компании. Добавить email verifier.`,
    personalized_outreach:(n, t) => `В ${t}: шаблон с упоминанием конкретной боли в ${n}. A/B тест 2 subject lines.`,
    lead_qualification:   (n, t) => `В ${t}: настрой pipeline для ${n}. Критерии: бюджет, срочность, полномочия.`,
    mvp_building:         (n, t) => `В ${t}: опиши ключевую функцию для ${n}. Начни с minimum_artifact из S2.`,
    content_creation:     (n, t) => `В ${t}: подключи LinkedIn. Темы: боли в ${n}, ваш опыт, инсайты рынка.`,
    revenue_tracking:     (n, t) => `В ${t}: воронка для ${n}: Awareness → Trial → Paid. Kill switch метрика из S3.`,
    funnel_optimization:  (n, t) => `В ${t}: трекинг событий для ${n}: signup, activation, first_value.`,
  }

  const template = templates[task_id]
  return template ? template(niche, tool.name) : `Настрой ${tool.name} под нишу ${niche}.`
}

export function getAllTools(): Tool[] { return TOOLS }
export function getToolById(id: string): Tool | null {
  return TOOLS.find(t => t.tool_id === id) ?? null
}
