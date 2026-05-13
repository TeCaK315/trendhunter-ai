/**
 * TrendHunter AI — Summarization Module
 * src/lib/roadmap/summarization.ts
 *
 * Выделено из summarize/route.ts чтобы вызывать напрямую из chat/route.ts
 * без HTTP-запроса (решает auth hole проблему).
 *
 * Использование:
 *   import { runSummarization } from '@/lib/roadmap/summarization'
 *   runSummarization(roadmapId, userId, supabase).catch(console.error)
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// HAIKU SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────

const SUMMARIZATION_SYSTEM_PROMPT = `Ты — система Summarization в продукте TrendHunter AI. Твоя задача — сжимать историю чата и обновлять структурированную память пользователя на основе диалога с AI-ролями (Макс, Marcus, Leo).

==========================================================
1. ТЫ НЕ AI-ПОМОЩНИК
==========================================================

Ты не общаешься с пользователем. Ты обрабатываешь данные и возвращаешь структурированный JSON.
Никаких эмоций, никакой эмпатии, никаких советов. Только извлечение фактов.

==========================================================
2. ГЛАВНОЕ ПРАВИЛО — ПОДТВЕРЖДЁННЫЕ ФАКТЫ
==========================================================

Записывай в память ТОЛЬКО подтверждённые факты:
- Пользователь явно сказал что сделал действие
- Пользователь явно принял решение
- Пользователь явно описал страх или сомнение
- Пользователь явно подтвердил гипотезу

НЕ записывай:
- Размышления вслух без решения
- AI предложил гипотезу, пользователь не отреагировал
- "Наверное стоит попробовать" → НЕ записывай как решение

Если сомневаешься — НЕ записывай. Лучше пропустить чем галлюцинировать.

==========================================================
3. ФОРМАТ ВЫВОДА
==========================================================

Возвращай СТРОГО валидный JSON без markdown и без текста вне JSON:

{
  "summary": "string (2-4 предложения что обсуждали)",
  "memory_updates": {
    "fears_added": [],
    "fears_resolved": [],
    "milestones_added": [],
    "actions_added": [],
    "decisions_added": [],
    "open_questions_added": [],
    "open_questions_resolved": [],
    "hypotheses_added": [],
    "leo_calculations_added": [],
    "emotional_context_updates": {
      "distress_signal_detected": false,
      "resolved_signal": false
    },
    "marcus_state_updates": null
  },
  "active_topic_for_next_session": "string | null",
  "no_new_facts": false
}

==========================================================
4. ФОРМАТ ФАКТОВ
==========================================================

actions_added: { "action": string, "date": string, "result": string }
decisions_added: { "topic": string, "decision": string, "date": string }
hypotheses_added: { "hypothesis": string, "tested_via": string, "result": "confirmed"|"rejected"|"inconclusive", "date": string }
fears_added: string (краткая фраза)
milestones_added: string
open_questions_added: string

leo_calculations_added: [
  {
    "id": "calc_<timestamp>",
    "date": "YYYY-MM-DD",
    "question": "Что считали",
    "assumptions": "Ключевые допущения через запятую",
    "result": "Итог в одной строке",
    "actual_outcome": null
  }
]

ЗАПОЛНЯЙ leo_calculations_added ТОЛЬКО если в диалоге Leo делал явный финансовый расчёт
(не просто упоминал цифры, а строил модель с допущениями).

emotional_context_updates:
- distress_signal_detected: true если пользователь писал "устал", "не вижу смысла", "бесит", "бездарь"
- resolved_signal: true если пользователь явно сказал что в порядке после сигнала

marcus_state_updates (null если не менялось):
{
  "channel": "reddit|linkedin|email|other",
  "attempt_count": 0,
  "hypotheses": ["гипотеза 1", "гипотеза 2"],
  "deviation_count": 0
}

ЗАПОЛНЯЙ marcus_state_updates только если Marcus явно работал над попытками в конкретном канале.

==========================================================
5. ЕСЛИ НЕТ НОВЫХ ФАКТОВ
==========================================================

{
  "summary": "краткое описание",
  "memory_updates": {},
  "active_topic_for_next_session": null,
  "no_new_facts": true
}`

// ─────────────────────────────────────────────────────────────
// ТИПЫ
// ─────────────────────────────────────────────────────────────

export interface LeoCalculationEntry {
  id: string
  date: string
  question: string
  assumptions: string
  result: string
  actual_outcome: string | null
}

export interface MarcusStateUpdate {
  channel: string | null
  attempt_count: number
  hypotheses: string[]
  deviation_count: number
}

interface SummaryResult {
  summary: string
  memory_updates: {
    fears_added?: string[]
    fears_resolved?: string[]
    milestones_added?: string[]
    actions_added?: Array<{ action: string; date: string; result: string }>
    decisions_added?: Array<{ topic: string; decision: string; date: string }>
    open_questions_added?: string[]
    open_questions_resolved?: string[]
    hypotheses_added?: Array<{ hypothesis: string; tested_via: string; result: string; date: string }>
    leo_calculations_added?: LeoCalculationEntry[]
    emotional_context_updates?: {
      distress_signal_detected: boolean
      resolved_signal: boolean
    }
    marcus_state_updates?: MarcusStateUpdate | null
  }
  active_topic_for_next_session: string | null
  no_new_facts: boolean
}

// ─────────────────────────────────────────────────────────────
// ОСНОВНАЯ ФУНКЦИЯ
// ─────────────────────────────────────────────────────────────

export async function runSummarization(
  roadmapId: string,
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<{ success: boolean; reason?: string }> {
  try {
    // ── Загружаем последние 20 сообщений ─────────────────────
    const { data: recentMessages } = await supabase
      .from('roadmap_chat_messages')
      .select('role, ai_role, content, created_at')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!recentMessages || recentMessages.length < 3) {
      return { success: false, reason: 'Not enough messages' }
    }

    const messages = recentMessages.reverse()

    // ── Загружаем текущую память ──────────────────────────────
    const { data: memory } = await supabase
      .from('roadmap_user_memory')
      .select('*')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .single()

    // ── Загружаем сессию для контекста ───────────────────────
    const { data: session } = await supabase
      .from('roadmap_sessions')
      .select('niche, day_number, kill_switch_date, active_role')
      .eq('id', roadmapId)
      .eq('user_id', userId)
      .single()

    const ksDate = new Date(session?.kill_switch_date ?? '')
    const daysRemaining = session?.kill_switch_date
      ? Math.max(0, Math.ceil((ksDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 90

    const inputPayload = {
      user_context: {
        day_of_90: session?.day_number ?? 1,
        kill_switch_date: session?.kill_switch_date ?? '',
        days_remaining: daysRemaining,
        active_role: session?.active_role ?? 'max',
        niche: session?.niche ?? '',
      },
      current_memory: {
        fears: memory?.fears ?? [],
        resolved_fears: memory?.resolved_fears ?? [],
        milestones: memory?.milestones ?? [],
        actions: memory?.actions_taken ?? [],
        decisions: memory?.decisions_made ?? [],
        open_questions: memory?.open_questions ?? [],
        hypotheses: memory?.hypotheses_tested ?? [],
        leo_calculations: memory?.leo_calculations ?? [],
        marcus_state: memory?.marcus_state ?? {},
        emotional_context: memory?.emotional_context ?? {},
      },
      recent_messages: messages.map(m => ({
        role: m.role,
        assistant_role: m.ai_role ?? null,
        content: m.content,
        timestamp: m.created_at,
      })),
    }

    // ── Вызов Haiku ───────────────────────────────────────────
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30_000,
    })

    // Retry логика — до 2 попыток при сбое Haiku
    let summaryResult: SummaryResult | null = null
    let lastError: unknown = null

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          temperature: 0.2,
          system: SUMMARIZATION_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: JSON.stringify(inputPayload),
          }],
        })

        const rawText = response.content
          .filter(b => b.type === 'text')
          .map(b => b.type === 'text' ? b.text : '')
          .join('')

        const cleaned = rawText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()

        // Защита от невалидного JSON
        if (!cleaned.startsWith('{')) {
          throw new Error(`Invalid JSON from Haiku (attempt ${attempt}): ${cleaned.slice(0, 100)}`)
        }

        summaryResult = JSON.parse(cleaned) as SummaryResult

        // Валидация структуры
        if (!summaryResult.summary || typeof summaryResult.no_new_facts !== 'boolean') {
          throw new Error(`Invalid SummaryResult structure (attempt ${attempt})`)
        }

        break // Успех — выходим из loop

      } catch (err) {
        lastError = err
        console.error(`[Summarization] Haiku attempt ${attempt} failed:`, err)
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000)) // Пауза перед retry
        }
      }
    }

    if (!summaryResult) {
      console.error('[Summarization] All attempts failed:', lastError)
      return { success: false, reason: `Haiku failed after 2 attempts: ${String(lastError)}` }
    }

    // ── Применяем обновления памяти ───────────────────────────
    if (!summaryResult.no_new_facts && summaryResult.memory_updates) {
      const updates = summaryResult.memory_updates
      const now = new Date().toISOString()

      const currentFears = (memory?.fears ?? []) as string[]
      const currentResolved = (memory?.resolved_fears ?? []) as string[]
      const currentMilestones = (memory?.milestones ?? []) as string[]
      const currentActions = (memory?.actions_taken ?? []) as unknown[]
      const currentDecisions = (memory?.decisions_made ?? []) as unknown[]
      const currentQuestions = (memory?.open_questions ?? []) as string[]
      const currentHypotheses = (memory?.hypotheses_tested ?? []) as unknown[]
      const currentEmotional = (memory?.emotional_context ?? {
        last_distress_signal_at: null,
        distress_signal_count_7d: 0,
      }) as Record<string, unknown>

      // Страхи
      const newFears = [
        ...currentFears.filter(f => !(updates.fears_resolved ?? []).includes(f)),
        ...(updates.fears_added ?? []),
      ].slice(0, 5)

      const newResolved = [
        ...currentResolved,
        ...(updates.fears_resolved ?? []),
      ]

      // Вопросы
      const newQuestions = [
        ...currentQuestions.filter(q => !(updates.open_questions_resolved ?? []).includes(q)),
        ...(updates.open_questions_added ?? []),
      ].slice(0, 5)

      // Emotional context
      let newEmotional = { ...currentEmotional }
      if (updates.emotional_context_updates?.distress_signal_detected) {
        newEmotional = {
          ...newEmotional,
          last_distress_signal_at: now,
          distress_signal_count_7d: ((currentEmotional.distress_signal_count_7d as number) || 0) + 1,
        }
      }
      if (updates.emotional_context_updates?.resolved_signal) {
        newEmotional = {
          ...newEmotional,
          last_resolved_at: now,
        }
      }

      // Leo calculations через Postgres функцию (атомарный аппенд)
      if (updates.leo_calculations_added?.length) {
        for (const calc of updates.leo_calculations_added) {
          await supabase.rpc('append_leo_calculation', {
            p_roadmap_id: roadmapId,
            p_user_id: userId,
            p_calculation: calc as unknown as Json,
          })
        }
      }

      // Marcus state
      if (updates.marcus_state_updates) {
        await supabase.rpc('update_marcus_state', {
          p_roadmap_id: roadmapId,
          p_user_id: userId,
          p_state: updates.marcus_state_updates as unknown as Json,
        })
      }

      // Основная память
      await supabase
        .from('roadmap_user_memory')
        .upsert({
          roadmap_id: roadmapId,
          user_id: userId,
          fears: newFears as unknown as Json,
          resolved_fears: newResolved as unknown as Json,
          milestones: [...currentMilestones, ...(updates.milestones_added ?? [])] as unknown as Json,
          actions_taken: [...currentActions, ...(updates.actions_added ?? [])] as unknown as Json,
          decisions_made: [...currentDecisions, ...(updates.decisions_added ?? [])] as unknown as Json,
          open_questions: newQuestions as unknown as Json,
          hypotheses_tested: [...currentHypotheses, ...(updates.hypotheses_added ?? [])] as unknown as Json,
          emotional_context: newEmotional as unknown as Json,
          last_updated: now,
        }, { onConflict: 'roadmap_id,user_id' })
    }

    // ── Сохраняем summary (idempotent) ──────────────────────
    // Проверяем не было ли уже summary за последние 2 минуты (защита от double-trigger)
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: recentSummary } = await supabase
      .from('roadmap_chat_summaries')
      .select('id')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .gte('created_at', twoMinsAgo)
      .limit(1)
      .single()

    if (!recentSummary) {
      const { error: summaryError } = await supabase
        .from('roadmap_chat_summaries')
        .insert({
          roadmap_id: roadmapId,
          user_id: userId,
          summary_content: summaryResult.summary,
          covers_messages_count: messages.length,
          active_topic: summaryResult.active_topic_for_next_session ?? null,
          no_new_facts: summaryResult.no_new_facts,
        })

      if (summaryError) {
        console.error('[Summarization] Summary save error:', summaryError)
        // Не фейлим весь процесс — память обновлена, summary вторичен
      }
    } else {
      console.log('[Summarization] Recent summary exists, skipping insert (idempotent)')
    }

    return { success: true }

  } catch (err) {
    console.error('[Summarization] Error:', err)
    return { success: false, reason: String(err) }
  }
}
