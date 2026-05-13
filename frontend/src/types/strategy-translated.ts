// Types for Partnership Translator output (S0-S5 translated blocks)

// Shared (common across all blocks)
export interface TranslatedWhatYouDo {
  action: string
  goal: string
  success_criterion: string
  fallback_if_not: string
}

export interface TranslatedNumberRow {
  metric_name: string
  human_translation: string
  comparison: string
}

export interface TranslatedAgentCard {
  role: string
  replaces_job: string
  what_for_niche: string
  hours_saved: string
}

// S0 — Угол атаки
export interface S0VersusThem {
  name: string
  size: string
  weakness: string
  source: string
}
export interface S0VersusYou {
  description: string
  advantage: string
  window_months: string
}
export interface S0Specific {
  positioning_quote: string
  versus_block: {
    them: S0VersusThem
    you: S0VersusYou
  }
  alternatives_rejected: Array<{ human_name: string; reason: string }>
}

// S1 — Первый клиент
export interface S1ClientPortrait {
  who: string
  when_searching: string
  where_to_find: string
  pain_moment: string
}
export interface S1FilterQuestion {
  question: string
  qualifying_answer: string
  why_matters: string
}
export interface S1PricePoint {
  monthly: string | number
  explanation: string
  comparison: string
}
export interface S1Specific {
  client_portrait: S1ClientPortrait
  primary_trigger: string
  filter_questions: S1FilterQuestion[]
  price_point: S1PricePoint
}

// S2 — V1 Продукт
export interface S2CoreFeature {
  name: string
  description: string
  why_this_one: string
}
export interface S2ReadyAsset {
  name: string
  purpose: string
  cost: string
}
export interface S2EstimatedCost {
  amount: string | number
  time_weeks: string
  context: string
}
export interface S2Specific {
  core_feature: S2CoreFeature
  not_in_v1: Array<{ what: string; why: string }>
  first_build_step: string
  ready_assets: S2ReadyAsset[]
  estimated_cost: S2EstimatedCost
}

// S3 — Первые 10 клиентов
export interface S3Channel {
  human_name: string
  where_exactly: string
  why_this_one: string
}
export interface S3FirstMessage {
  text: string
  when_to_send: string
  how_to_adapt: string
}
export interface S3DayByDay {
  day: string
  action: string
  target: string
  expected: string
  if_below: string
}
export interface S3PriceConversation {
  standard_price: string
  launch_price: string
  what_to_say: string
  when_to_raise: string
}
export interface S3KillSwitch {
  metric_human: string
  threshold: string
  time_window: string
  what_to_do_then: string
}
export interface S3Specific {
  channel: S3Channel
  first_message: S3FirstMessage
  day_by_day: S3DayByDay[]
  price_conversation: S3PriceConversation
  kill_switch: S3KillSwitch
}

// S5 — Путь к деньгам
export interface S5Timeline {
  days_to_first_revenue: string | number
  human_text: string
  what_happens_weekly: string
}
export interface S5Milestones {
  day_30: { what: string; success_metric: string }
  day_90: { what: string; success_metric: string }
}
export interface S5Calculator {
  monthly_price: string | number
  cac_real: string | number
  months_to_revenue: string | number
  human_math: string
}
export interface S5FirstActionToday {
  what: string
  time_needed: string
  result: string
}
export interface S5IfBehind {
  signs: string
  what_to_do: string
}
export interface S5Specific {
  timeline: S5Timeline
  milestones: S5Milestones
  calculator: S5Calculator
  first_action_today: S5FirstActionToday
  if_behind: S5IfBehind
  kill_switch_date: string
  kill_switch_explanation: string
}

// Main output
export interface TranslatedBlockOutput {
  block_id: 'S0' | 'S1' | 'S2' | 'S3' | 'S5'
  headline: string
  opening_story: string
  main_insight?: string
  why_it_works: string
  why_it_works_intro?: string
  what_you_do: TranslatedWhatYouDo
  your_numbers: TranslatedNumberRow[]
  ai_agent_card: TranslatedAgentCard
  honest_limitation: string
  bridge_to_next: string
  specific: S0Specific | S1Specific | S2Specific | S3Specific | S5Specific
}
