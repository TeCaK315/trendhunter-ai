/**
 * TrendHunter AI — Interpretation Layer
 * src/lib/strategy/interpretation.ts
 *
 * После генерации каждого блока — Claude переводит
 * технический вывод на человеческий язык.
 * Пользователь видит ТОЛЬКО интерпретацию.
 * Никогда: технические термины, "данных недостаточно".
 */

import Anthropic from '@anthropic-ai/sdk'
import type { BlockId, StrategyContext } from './block0'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface InterpretationOutput {
  headline: string          // одно предложение-диагноз
  main_insight: string      // 2-3 предложения главного вывода
  key_facts: string[]       // ровно 3 факта с числами
  decision_impact: string   // что это означает для решения
  ai_leverage_hint: string  // тизер для кнопки ⚡
}

// ─────────────────────────────────────────────────────────────
// PROMPTS BY BLOCK
// ─────────────────────────────────────────────────────────────

const INTERPRETATION_PROMPTS: Record<BlockId, string> = {
  S0: `Ты переводишь технический анализ угла атаки на рынке на язык предпринимателя.
Пользователь только что получил вывод системы о своём позиционировании.
Объясни ему простым языком: какой угол выбран, почему он защищён от копирования, и что это означает для его первого шага.`,

  S1: `Ты переводишь технический профиль первого клиента на язык предпринимателя.
Пользователь только что получил описание кто заплатит первым.
Объясни: кто этот человек, что его заставит действовать прямо сейчас, и как это поможет найти первых клиентов.`,

  S2: `Ты переводишь технические характеристики v1 продукта на язык предпринимателя.
Пользователь только что узнал что строить в первой версии.
Объясни: что конкретно нужно создать, почему именно это, и как это создаёт преимущество.`,

  S3: `Ты переводишь технический план первых продаж на язык предпринимателя.
Пользователь только что получил канал, скрипт и критерии успеха.
Объясни: через какой канал идти, что конкретно делать завтра, и когда менять подход.`,

  S5: `Ты переводишь финансовый таймлайн и путь к деньгам на язык предпринимателя.
Пользователь только что получил план с датами и метриками.
Объясни: когда реалистично ждать первых денег, что делать в первые 30 дней, и когда принимать решение продолжать или остановиться.`,
}

// ─────────────────────────────────────────────────────────────
// GENERATE INTERPRETATION
// ─────────────────────────────────────────────────────────────

const client = new Anthropic()

export async function generateInterpretation(params: {
  block_id: BlockId
  block_output: Record<string, unknown>
  context: StrategyContext
  niche: string
}): Promise<InterpretationOutput> {
  const { block_id, block_output, context, niche } = params

  const systemPrompt = INTERPRETATION_PROMPTS[block_id]

  const userPrompt = buildInterpretationPrompt({
    block_id,
    block_output,
    context,
    niche,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('')

  return parseInterpretationResponse(text, block_id, niche)
}

// ─────────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────────

function buildInterpretationPrompt(params: {
  block_id: BlockId
  block_output: Record<string, unknown>
  context: StrategyContext
  niche: string
}): string {
  const { block_id, block_output, context, niche } = params

  const modeNote = context.strategy_mode === 'experiment_mode'
    ? 'Режим: ЭКСПЕРИМЕНТ. Это гипотеза которую нужно проверить.'
    : 'Режим: УВЕРЕННЫЙ ВХОД. Данные подтверждают путь.'

  return `Ниша: ${niche}
Сегмент: ${context.segment}
${modeNote}

ТЕХНИЧЕСКИЙ ВЫВОД БЛОКА ${block_id}:
${JSON.stringify(block_output, null, 2)}

Напиши интерпретацию в формате JSON:
{
  "headline": "одно предложение — главный вывод блока",
  "main_insight": "2-3 предложения объясняющие что это означает для предпринимателя",
  "key_facts": [
    "первый конкретный факт с числом",
    "второй конкретный факт с числом",
    "третий конкретный факт с числом"
  ],
  "decision_impact": "одно предложение — что именно нужно сделать с этим знанием",
  "ai_leverage_hint": "короткая фраза — как AI инструменты ускорят этот шаг (для кнопки ⚡)"
}

ЗАПРЕЩЕНО:
- Технические термины без объяснения (CAC, LTV, SAAS, B2B — объясни если используешь)
- Слова: "данных недостаточно", "сложно сказать", "требует исследования"
- Оговорки о качестве данных
- Более 3 ключевых фактов
- Текст вне JSON

Тон: уверенный аналитик который знает эту нишу и говорит с предпринимателем напрямую.
Язык: русский.`
}

// ─────────────────────────────────────────────────────────────
// RESPONSE PARSER
// ─────────────────────────────────────────────────────────────

function parseInterpretationResponse(
  text: string,
  block_id: BlockId,
  niche: string
): InterpretationOutput {
  try {
    // Убираем markdown блоки если есть
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    return {
      headline: parsed.headline || `Анализ блока ${block_id} завершён`,
      main_insight: parsed.main_insight || '',
      key_facts: Array.isArray(parsed.key_facts) ? parsed.key_facts.slice(0, 3) : [],
      decision_impact: parsed.decision_impact || '',
      ai_leverage_hint: parsed.ai_leverage_hint || 'AI ускорит этот шаг в 5-10x',
    }
  } catch {
    // Fallback если JSON невалидный
    return buildFallbackInterpretation(block_id, niche)
  }
}

function buildFallbackInterpretation(block_id: BlockId, niche: string): InterpretationOutput {
  const fallbacks: Record<BlockId, InterpretationOutput> = {
    S0: {
      headline: `Угол входа в нишу ${niche} определён`,
      main_insight: 'Система выявила незанятую позицию на рынке. Это место где конкурент слаб и где ты можешь зайти первым.',
      key_facts: ['Позиционирование выбрано', 'Барьер определён', 'Путь ясен'],
      decision_impact: 'Следующий шаг — определить кто заплатит первым за это решение.',
      ai_leverage_hint: 'Perplexity AI исследует конкурентов за минуты',
    },
    S1: {
      headline: 'Профиль первого клиента определён',
      main_insight: 'Система нашла конкретного человека с конкретной болью который готов платить прямо сейчас.',
      key_facts: ['Профиль конкретизирован', 'Триггер определён', 'Место для контакта найдено'],
      decision_impact: 'Следующий шаг — создать продукт который закрывает именно эту боль.',
      ai_leverage_hint: 'Clay находит 500 таких контактов автоматически',
    },
    S2: {
      headline: 'v1 продукт определён',
      main_insight: 'Одна функция которая решает главную боль и создаёт барьер для конкурентов.',
      key_facts: ['Фича определена', 'Барьер встроен', 'Минимальный артефакт готов к показу'],
      decision_impact: 'Следующий шаг — найти первых 10 клиентов через правильный канал.',
      ai_leverage_hint: 'Cursor/Blink создаёт v1 за 1-2 недели вместо месяцев',
    },
    S3: {
      headline: 'Канал первых продаж определён',
      main_insight: 'Конкретный канал, конкретный скрипт, конкретный критерий успеха.',
      key_facts: ['Канал выбран', 'Скрипт готов', 'Kill switch определён'],
      decision_impact: 'Следующий шаг — действовать по плану и отслеживать сигналы.',
      ai_leverage_hint: 'AI Outbound автоматизирует весь процесс за $150/мес',
    },
    S5: {
      headline: 'Путь к первым деньгам построен',
      main_insight: 'Реалистичный таймлайн с конкретными датами и метриками.',
      key_facts: ['Таймлайн построен', 'Kill switch дата установлена', 'Первое действие определено'],
      decision_impact: 'Сделай первое действие сегодня — это создаёт commitment.',
      ai_leverage_hint: 'PostHog отслеживает все метрики автоматически бесплатно',
    },
  }

  return fallbacks[block_id]
}
