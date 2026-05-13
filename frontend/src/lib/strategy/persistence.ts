/**
 * TrendHunter AI — Persistence Layer
 * src/lib/strategy/persistence.ts
 *
 * Работа с Supabase для хранения состояния стратегии.
 * Rerun создаёт новую запись — никогда не перезаписывает.
 */

import { createClient } from '@supabase/supabase-js'
import type { ResearchOutput } from './data-contract'
import type { StrategyContext, BlockId } from './block0'
import type { BlockDecision } from './block-decision'
import type { InterpretationOutput } from './interpretation'

// ─────────────────────────────────────────────────────────────
// SQL MIGRATIONS (для разработчика)
// ─────────────────────────────────────────────────────────────

/**
 * Выполни эти миграции в Supabase SQL Editor:
 *
 * -- Сессия стратегии
 * CREATE TABLE IF NOT EXISTS strategy_sessions (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   trend_id UUID NOT NULL,
 *   user_id UUID NOT NULL,
 *   context JSONB NOT NULL,
 *   research_snapshot JSONB NOT NULL,
 *   status VARCHAR(20) DEFAULT 'active',
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(trend_id, user_id)
 * );
 *
 * -- BlockDecision для каждого блока
 * CREATE TABLE IF NOT EXISTS block_decisions (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   session_id UUID REFERENCES strategy_sessions(id) ON DELETE CASCADE,
 *   block_id VARCHAR(5) NOT NULL,
 *   decision JSONB NOT NULL,
 *   raw_output JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(session_id, block_id)
 * );
 *
 * -- Interpretation layer выводы
 * CREATE TABLE IF NOT EXISTS block_interpretations (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   session_id UUID REFERENCES strategy_sessions(id) ON DELETE CASCADE,
 *   block_id VARCHAR(5) NOT NULL,
 *   interpretation JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(session_id, block_id)
 * );
 *
 * -- AI_LEVERAGE карточки
 * CREATE TABLE IF NOT EXISTS ai_leverage_cards (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   session_id UUID REFERENCES strategy_sessions(id) ON DELETE CASCADE,
 *   block_id VARCHAR(5) NOT NULL,
 *   tool_id VARCHAR(50) NOT NULL,
 *   card JSONB NOT NULL,
 *   svg_schema TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- История reruns (не перезаписываем)
 * CREATE TABLE IF NOT EXISTS strategy_reruns (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   session_id UUID REFERENCES strategy_sessions(id) ON DELETE CASCADE,
 *   rule_violated VARCHAR(20),
 *   user_choice VARCHAR(100),
 *   new_params JSONB,
 *   rerun_number INTEGER DEFAULT 1,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- RLS Policies
 * ALTER TABLE strategy_sessions ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE block_decisions ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE block_interpretations ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE ai_leverage_cards ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE strategy_reruns ENABLE ROW LEVEL SECURITY;
 *
 * -- Пользователь видит только свои данные
 * CREATE POLICY "Users see own sessions" ON strategy_sessions
 *   FOR ALL USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users see own decisions" ON block_decisions
 *   FOR ALL USING (
 *     session_id IN (
 *       SELECT id FROM strategy_sessions WHERE user_id = auth.uid()
 *     )
 *   );
 */

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
// BlockId импортируется из block0.ts

export interface StrategySession {
  id: string
  trend_id: string
  user_id: string
  context: StrategyContext
  research_snapshot: ResearchOutput
  status: 'active' | 'completed' | 'abandoned'
  created_at: string
  updated_at: string
}

export interface StoredBlockDecision {
  id: string
  session_id: string
  block_id: BlockId
  decision: BlockDecision
  raw_output: Record<string, unknown>
  created_at: string
}

export interface StoredInterpretation {
  id: string
  session_id: string
  block_id: BlockId
  interpretation: InterpretationOutput
  created_at: string
}

export interface RerunRecord {
  id: string
  session_id: string
  rule_violated: 'RULE_001' | 'RULE_004' | 'RULE_009'
  user_choice: string
  new_params: Record<string, unknown>
  rerun_number: number
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
               process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, key)
}

// ─────────────────────────────────────────────────────────────
// SESSION MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Создаёт новую сессию стратегии.
 * Если сессия уже есть — возвращает существующую.
 */
export async function getOrCreateSession(params: {
  trend_id: string
  user_id: string
  context: StrategyContext
  research_snapshot: ResearchOutput
}): Promise<StrategySession> {
  const supabase = getSupabase()

  // Проверяем существующую активную сессию
  const { data: existing } = await supabase
    .from('strategy_sessions')
    .select('*')
    .eq('trend_id', params.trend_id)
    .eq('user_id', params.user_id)
    .eq('status', 'active')
    .single()

  if (existing) {
    return existing as StrategySession
  }

  // Создаём новую
  const { data, error } = await supabase
    .from('strategy_sessions')
    .insert({
      trend_id: params.trend_id,
      user_id: params.user_id,
      context: params.context,
      research_snapshot: params.research_snapshot,
      status: 'active',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create session: ${error.message}`)
  return data as StrategySession
}

/**
 * Обновляет StrategyContext в сессии.
 * Используется при rerun когда параметры изменились.
 */
export async function updateSessionContext(
  session_id: string,
  context: StrategyContext
): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('strategy_sessions')
    .update({
      context,
      updated_at: new Date().toISOString()
    })
    .eq('id', session_id)

  if (error) throw new Error(`Failed to update session: ${error.message}`)
}

/**
 * Помечает сессию как завершённую.
 */
export async function completeSession(session_id: string): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('strategy_sessions')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', session_id)

  if (error) throw new Error(`Failed to complete session: ${error.message}`)
}

// ─────────────────────────────────────────────────────────────
// BLOCK DECISIONS
// ─────────────────────────────────────────────────────────────

/**
 * Сохраняет BlockDecision после генерации блока.
 * Если решение уже есть — обновляет (idempotent).
 */
export async function saveBlockDecision(params: {
  session_id: string
  block_id: BlockId
  decision: BlockDecision
  raw_output: Record<string, unknown>
}): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('block_decisions')
    .upsert({
      session_id: params.session_id,
      block_id: params.block_id,
      decision: params.decision,
      raw_output: params.raw_output,
    }, {
      onConflict: 'session_id,block_id'
    })

  if (error) throw new Error(`Failed to save block decision: ${error.message}`)
}

/**
 * Обновляет translated_output (партнёрский перевод) для уже сохранённого BlockDecision.
 * Вызывается после callTranslator() в route-builder.
 */
export async function updateBlockDecisionTranslated(params: {
  session_id: string
  block_id: BlockId
  translated_output: unknown
}): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('block_decisions')
    .update({ translated_output: params.translated_output })
    .eq('session_id', params.session_id)
    .eq('block_id', params.block_id)

  if (error) throw new Error(`Failed to update translated_output: ${error.message}`)
}

/**
 * Читает все BlockDecision для сессии.
 * Возвращает объект { S0: decision, S1: decision, ... }
 */
export async function getBlockDecisions(
  session_id: string
): Promise<Partial<Record<BlockId, BlockDecision>>> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('block_decisions')
    .select('block_id, decision')
    .eq('session_id', session_id)

  if (error) throw new Error(`Failed to get block decisions: ${error.message}`)

  const result: Partial<Record<BlockId, BlockDecision>> = {}
  for (const row of data ?? []) {
    result[row.block_id as BlockId] = row.decision as BlockDecision
  }

  return result
}

/**
 * Читает BlockDecision конкретного блока.
 */
export async function getBlockDecision(
  session_id: string,
  block_id: BlockId
): Promise<BlockDecision | null> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('block_decisions')
    .select('decision')
    .eq('session_id', session_id)
    .eq('block_id', block_id)
    .single()

  return data?.decision as BlockDecision | null
}

// ─────────────────────────────────────────────────────────────
// INTERPRETATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Сохраняет интерпретацию блока.
 */
export async function saveInterpretation(params: {
  session_id: string
  block_id: BlockId
  interpretation: InterpretationOutput
}): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('strategy_block_interpretations')
    .upsert({
      session_id: params.session_id,
      block_id: params.block_id,
      interpretation: params.interpretation,
    }, {
      onConflict: 'session_id,block_id'
    })

  if (error) throw new Error(`Failed to save interpretation: ${error.message}`)
}

// ─────────────────────────────────────────────────────────────
// RERUNS
// ─────────────────────────────────────────────────────────────

/**
 * Записывает rerun в историю.
 * НИКОГДА не перезаписывает — всегда создаёт новую запись.
 */
export async function recordRerun(params: {
  session_id: string
  rule_violated: 'RULE_001' | 'RULE_004' | 'RULE_009'
  user_choice: string
  new_params: Record<string, unknown>
}): Promise<{ rerun_number: number }> {
  const supabase = getSupabase()

  // Считаем сколько reruns уже было
  const { count } = await supabase
    .from('strategy_reruns')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', params.session_id)

  const rerun_number = (count ?? 0) + 1

  const { error } = await supabase
    .from('strategy_reruns')
    .insert({
      session_id: params.session_id,
      rule_violated: params.rule_violated,
      user_choice: params.user_choice,
      new_params: params.new_params,
      rerun_number,
    })

  if (error) throw new Error(`Failed to record rerun: ${error.message}`)

  return { rerun_number }
}

/**
 * Получает количество reruns для сессии.
 * Используется для определения достиг ли пользователь максимума (2).
 */
export async function getRerunCount(session_id: string): Promise<number> {
  const supabase = getSupabase()

  const { count } = await supabase
    .from('strategy_reruns')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session_id)

  return count ?? 0
}

// ─────────────────────────────────────────────────────────────
// FULL SESSION READ (для восстановления состояния)
// ─────────────────────────────────────────────────────────────

export interface FullSessionState {
  session: StrategySession
  decisions: Partial<Record<BlockId, BlockDecision>>
  interpretations: Partial<Record<BlockId, InterpretationOutput>>
  rerun_count: number
}

/**
 * Читает полное состояние сессии.
 * Используется при возврате пользователя к стратегии.
 */
export async function getFullSessionState(
  session_id: string
): Promise<FullSessionState | null> {
  const supabase = getSupabase()

  const [sessionResult, decisionsData, interpretationsData, rerunCount] =
    await Promise.all([
      supabase
        .from('strategy_sessions')
        .select('*')
        .eq('id', session_id)
        .single(),
      getBlockDecisions(session_id),
      supabase
        .from('strategy_block_interpretations')
        .select('block_id, interpretation')
        .eq('session_id', session_id),
      getRerunCount(session_id),
    ])

  if (!sessionResult.data) return null

  const interpretations: Partial<Record<BlockId, InterpretationOutput>> = {}
  for (const row of interpretationsData.data ?? []) {
    interpretations[row.block_id as BlockId] =
      row.interpretation as InterpretationOutput
  }

  return {
    session: sessionResult.data as StrategySession,
    decisions: decisionsData,
    interpretations,
    rerun_count: rerunCount,
  }
}
