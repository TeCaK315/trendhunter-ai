/**
 * TrendHunter AI — Route Builder v3
 * src/lib/strategy/route-builder.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { validateResearchData, type ResearchOutput } from './data-contract'
import { type StrategyContext, type BlockId } from './block0'
import { validateBlockOutput } from './validator'
import { generateInterpretation } from './interpretation'
import { getBlockDecisions, saveBlockDecision, saveInterpretation, updateBlockDecisionTranslated } from './persistence'
import { buildTranslatorPrompt, validateTranslatorOutput, type TranslatorInput, type TranslatorOutput } from './prompts/translator'
import type { BlockDecision, AllDecisions } from './block-decision'
import type { Constraint } from './constraints/index'
import { getStrategyAuthUserFromRequest } from './auth'
import { buildAILeverageSection } from './ai-leverage/personalizer'
import { generateCardSVG } from './ai-leverage/svg-generator'

export const maxDuration = 300

export interface RouteConfig {
  block_id: BlockId
  buildData: (params: { research: ResearchOutput; context: StrategyContext; decisions: AllDecisions }) => Record<string, unknown>
  buildPrompt: (params: { dataJson: string; context: StrategyContext; constraints: Constraint[]; decisions: AllDecisions }) => string
  extractDecision: (output: Record<string, unknown>) => BlockDecision
  max_tokens?: number
}

export function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export function sseEvent(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
}

function buildRepairPrompt(failedOutput: Record<string, unknown>, error: { type: string; field?: string; message: string; repair_instruction?: string; dependency_group?: string[] }): string {
  return `Ты сгенерировал JSON с ошибкой валидации. Исправь её.\n\nОШИБКА:\nТип: ${error.type}\nПоле: ${error.field ?? 'unknown'}\nСообщение: ${error.message}\n${error.repair_instruction ? `\nИНСТРУКЦИЯ:\n${error.repair_instruction}\n` : ''}${error.dependency_group ? `Исправь эти поля: ${error.dependency_group.join(', ')}\n` : ''}\nТЕКУЩИЙ JSON:\n${JSON.stringify(failedOutput, null, 2)}\n\nВерни ТОЛЬКО исправленный полный валидный JSON.`
}

/**
 * Partnership Translator — второй Claude вызов после валидации raw output.
 * Переводит технические данные в партнёрский язык для пользователя.
 * Graceful fallback: при ошибке возвращает null, не блокирует флоу.
 */
async function callTranslator(
  blockId: BlockId,
  rawOutput: Record<string, unknown>,
  context: StrategyContext,
  researchData: Record<string, unknown>
): Promise<TranslatorOutput | null> {
  try {
    const ctx = context as any
    const input: TranslatorInput = {
      block_id: blockId,
      block_raw_output: rawOutput,
      research_data: researchData,
      user_profile: {
        niche_title: context.niche ?? 'Unknown niche',
        resource_profile: context.resource_profile ?? 'lean',
        weekly_hours: ctx.weekly_hours ?? 10,
        budget_total: ctx.budget_total ?? context.experiment_budget ?? 2000,
        technical_skill: context.can_code ? 'technical' : 'non_technical',
      },
      synthesis_verdict: ctx.synthesis_verdict ?? 'experiment_if',
      confidence: ctx.confidence ?? 0.5,
    }

    const prompt = buildTranslatorPrompt(input)
    const anthropic = new Anthropic({ timeout: 45_000 })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const parsed = JSON.parse(clean) as TranslatorOutput
    const validation = validateTranslatorOutput(parsed)

    if (validation.warnings.length > 0) {
      console.warn(`[Translator ${blockId}] warnings:`, validation.warnings)
    }

    return parsed
  } catch (error) {
    console.error(`[Translator] Block ${blockId} failed:`, error)
    return null
  }
}

export function createStrategyRoute(config: RouteConfig) {
  return async function POST(req: NextRequest): Promise<Response> {
    let session_id: string
    try {
      const body = await req.json() as { session_id: string }
      session_id = body.session_id
      if (!session_id || typeof session_id !== 'string') {
        return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    let isClosed = false
    const safeClose = async () => { if (isClosed) return; isClosed = true; try { await writer.close() } catch { /* already closed */ } }
    const send = async (type: string, data: Record<string, unknown>) => { if (isClosed) return; try { await writer.write(encoder.encode(sseEvent(type, data))) } catch { isClosed = true } }

    ;(async () => {
      try {
        await send('status', { step: 'init', message: 'Загружаем данные...' })
        const user = await getStrategyAuthUserFromRequest(req)
        if (!user) { await send('error', { code: 'UNAUTHORIZED' }); await safeClose(); return }

        const supabase = getSupabase()
        const { data: sessionData } = await supabase.from('strategy_sessions').select('context, research_snapshot').eq('id', session_id).eq('user_id', user.id).single()
        if (!sessionData) { await send('error', { code: 'SESSION_NOT_FOUND' }); await safeClose(); return }

        const context = sessionData.context as StrategyContext
        const researchValidation = validateResearchData(sessionData.research_snapshot)
        if (!researchValidation.success) { await send('error', { code: 'RESEARCH_INVALID', reason: researchValidation.reason }); await safeClose(); return }
        const research = researchValidation.data

        const decisionsRaw = await getBlockDecisions(session_id)
        const decisions = decisionsRaw as AllDecisions
        const requiredPrevious: Partial<Record<BlockId, BlockId>> = { S1: 'S0', S2: 'S1', S3: 'S2', S5: 'S3' }
        const required = requiredPrevious[config.block_id]
        if (required && !decisions[required]) { await send('error', { code: `${required}_MISSING` }); await safeClose(); return }

        await send('status', { step: 'generating', message: `Генерируем блок ${config.block_id}...` })

        const data = config.buildData({ research, context, decisions })
        const prompt = config.buildPrompt({ dataJson: JSON.stringify(data, null, 2), context, constraints: context.constraints, decisions })

        const anthropic = new Anthropic({ timeout: 45_000 })
        let message: Awaited<ReturnType<typeof anthropic.messages.create>>
        try {
          message = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: config.max_tokens ?? 4000, messages: [{ role: 'user', content: prompt }] })
        } catch (apiError: unknown) {
          const code = (apiError as any)?.status === 529 ? 'API_OVERLOADED' : (apiError as any)?.name === 'APITimeoutError' ? 'API_TIMEOUT' : 'API_ERROR'
          await send('error', { code, message: 'Ошибка API. Попробуйте ещё раз.' }); await safeClose(); return
        }

        const rawText = message.content.filter(c => c.type === 'text').map(c => c.text).join('')
        await send('status', { step: 'validating', message: 'Проверяем качество...' })

        let output: Record<string, unknown>
        try { output = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) }
        catch { await send('error', { code: 'JSON_PARSE_ERROR', raw: rawText.slice(0, 300) }); await safeClose(); return }

        const validationResult = validateBlockOutput({ block_id: config.block_id, output, constraints: context.constraints, context, research_data: research as unknown as Record<string, unknown> })
        if (!validationResult.valid) {
          await send('status', { step: 'repairing', message: 'Уточняем результат...' })
          try {
            const repairMessage = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: Math.min(config.max_tokens ?? 4000, 3000), messages: [{ role: 'user', content: buildRepairPrompt(output, validationResult.error!) }] })
            const repairText = repairMessage.content.filter(c => c.type === 'text').map(c => c.text).join('')
            try { output = JSON.parse(repairText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) } catch { output = { ...output, _degraded: true, _degraded_reason: 'Repair JSON parse failed' } }
          } catch { output = { ...output, _degraded: true, _degraded_reason: 'Repair API failed' } }
          if (!(output as any)._degraded) {
            const repairValidation = validateBlockOutput({ block_id: config.block_id, output, constraints: context.constraints, context, research_data: research as unknown as Record<string, unknown> })
            if (!repairValidation.valid) output = { ...output, _degraded: true, _degraded_reason: repairValidation.error?.message }
          }
        }

        await send('status', { step: 'saving', message: 'Сохраняем...' })
        let decision: BlockDecision
        try { decision = config.extractDecision(output); if (!decision || typeof decision !== 'object') throw new Error('Invalid') }
        catch { output = { ...output, _degraded: true, _degraded_reason: 'Decision extraction failed' }; decision = { block_id: config.block_id, fields: {}, constraints_added: [] } }

        await saveBlockDecision({ session_id, block_id: config.block_id, decision, raw_output: output })
        console.log(`[${config.block_id}] Saved block decision, session:`, session_id)

        await send('status', { step: 'translating', message: 'Переводим на партнёрский язык...' })
        const translatedOutput = await callTranslator(
          config.block_id,
          output,
          context,
          research as unknown as Record<string, unknown>
        )
        if (translatedOutput) {
          try {
            await updateBlockDecisionTranslated({ session_id, block_id: config.block_id, translated_output: translatedOutput })
            console.log(`[${config.block_id}] Saved translated output`)
          } catch (e) {
            console.error(`[${config.block_id}] Failed to persist translated:`, e)
          }
        }

        await send('status', { step: 'interpreting', message: 'Формулируем вывод...' })
        let interpretation
        try { interpretation = await generateInterpretation({ block_id: config.block_id, block_output: output, context, niche: context.niche }) }
        catch { interpretation = { headline: `Блок ${config.block_id} сформирован`, main_insight: '', key_facts: [], decision_impact: '', ai_leverage_hint: '' } }

        await saveInterpretation({ session_id, block_id: config.block_id, interpretation })

        await send('status', { step: 'ai_leverage', message: 'Подбираем AI инструменты...' })
        let leverageSection = null
        try {
          leverageSection = buildAILeverageSection({ block_id: config.block_id, context, acquisition_type: research.b4.acquisition_type })
          const cardsWithSvg = leverageSection.cards.map(card => ({ ...card, svg: generateCardSVG({ tool_name: card.primary_tool.name, task_id: card.task_id, niche: context.niche }) }))
          if (cardsWithSvg.length > 0) {
            const leverageRows = cardsWithSvg.map(card => ({ session_id, block_id: config.block_id, tool_id: card.primary_tool.tool_id, card, svg_schema: card.svg }))
            try { await supabase.from('ai_leverage_cards').upsert(leverageRows, { onConflict: 'session_id,block_id,tool_id' }) } catch {}
          }
          leverageSection = { ...leverageSection, cards: cardsWithSvg }
        } catch (e) { console.error(`[${config.block_id}] AI Leverage failed:`, e) }

        await send('result', { block_id: config.block_id, output, translated: translatedOutput, interpretation, ai_leverage: leverageSection, is_degraded: !!(output as any)._degraded })
        await safeClose()
      } catch (error) {
        console.error(`[${config.block_id} Route] Unhandled error:`, error)
        try { await send('error', { code: 'INTERNAL_ERROR', message: 'Произошла ошибка.' }) } catch {}
        await safeClose()
      }
    })()

    return new Response(stream.readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' } })
  }
}

export const SSE_HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' } as const
