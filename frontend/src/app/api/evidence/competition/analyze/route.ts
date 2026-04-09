// /api/evidence/competition/analyze — Intelligence Layer для Block 4
// Sonnet интерпретирует данные конкуренции и генерирует аналитику на языке предпринимателя
// GET ?trend_id=xxx&niche=xxx — читает block_results, кэширует результат

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

const claude = new Anthropic()

// ══════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════

interface CompetitionIntelligenceInput {
  niche: string
  diagnosis: string
  score: number
  reason: string

  // Layer 1: Картография
  competitor_count: number
  paid_count: number
  organic_count: number
  competitors: {
    domain: string
    name: string
    size_estimate: string // micro | small | medium | large
    g2_reviews: number | null
    primary_segment: string
  }[]

  // Layer 2: Gap анализ
  gap_type: string // strategic | execution | none
  has_strategic_gap: boolean
  strategic_gaps: {
    competitor: string
    category: string
    reasoning: string
    sample_quotes: string[]
  }[]
  execution_gaps: {
    competitor: string
    category: string
    reasoning: string
    sample_quotes: string[]
  }[]
  total_reviews_analyzed: number
  top_gap_category: string | null

  // Layer 3: Точка входа
  entry_point: string
  entry_point_competitor: string
  entry_point_reasoning: string
  strategic_gap_summary: string | null
  positioning_vectors: string[]

  // Block context
  key_factors: string[]
}

// ══════════════════════════════════════════════════════════════
// SONNET ПРОМПТ
// ══════════════════════════════════════════════════════════════

function buildPrompt(input: CompetitionIntelligenceInput): string {
  const competitorsList = input.competitors
    .slice(0, 5)
    .map(c => `- ${c.domain} (${c.name}): размер ${c.size_estimate}, G2 отзывов: ${c.g2_reviews ?? 'нет данных'}, сегмент: ${c.primary_segment}`)
    .join('\n')

  const strategicGapsStr = input.strategic_gaps.length > 0
    ? input.strategic_gaps.map(g =>
      `- ${g.competitor}: [${g.category}] ${g.reasoning}${g.sample_quotes.length > 0 ? ` | Цитаты: "${g.sample_quotes.slice(0, 2).join('", "')}"` : ''}`
    ).join('\n')
    : 'Стратегических gap не обнаружено'

  const executionGapsStr = input.execution_gaps.length > 0
    ? input.execution_gaps.map(g =>
      `- ${g.competitor}: [${g.category}] ${g.reasoning}${g.sample_quotes.length > 0 ? ` | Цитаты: "${g.sample_quotes.slice(0, 2).join('", "')}"` : ''}`
    ).join('\n')
    : 'Execution gap не обнаружено'

  const vectorsStr = input.positioning_vectors.length > 0
    ? input.positioning_vectors.map((v, i) => `${i + 1}. ${v}`).join('\n')
    : 'Векторы позиционирования не определены'

  return `Ты стратегический аналитик конкурентного рынка. Интерпретируй данные конкурентного анализа для нетехнического предпринимателя.

СТРОГИЕ ПРАВИЛА:
- Только то что следует из переданных данных. Никаких домыслов.
- Все текстовые поля на русском языке
- Соблюдай лимиты длины
- Если данных по секции нет — верни пустую строку для соответствующего поля

ДАННЫЕ:
Ниша: ${input.niche}
Диагноз: ${input.diagnosis} (${input.score}/10)
Причина диагноза: ${input.reason}
Ключевые факторы: ${input.key_factors.join('; ')}

КОНКУРЕНТЫ (${input.competitor_count} найдено, ${input.paid_count} платная реклама, ${input.organic_count} органика):
${competitorsList}

GAP АНАЛИЗ (${input.total_reviews_analyzed} отзывов проанализировано):
Тип gap: ${input.gap_type}
Топ категория жалоб: ${input.top_gap_category || 'не определена'}

Стратегические gap (конкурент НЕ МОЖЕТ исправить без ущерба бизнес-модели):
${strategicGapsStr}

Execution gap (конкурент МОЖЕТ исправить, просто ещё не сделал):
${executionGapsStr}

ТОЧКА ВХОДА:
${input.entry_point}
Через конкурента: ${input.entry_point_competitor}
Обоснование: ${input.entry_point_reasoning}
${input.strategic_gap_summary ? `Стратегическая суммария: ${input.strategic_gap_summary}` : ''}

ВЕКТОРЫ ПОЗИЦИОНИРОВАНИЯ:
${vectorsStr}

Верни СТРОГО валидный JSON без markdown:

{
  "verdict_phrase": "Главный вывод о конкурентной ситуации одной фразой. Макс 12 слов.",
  "verdict_sub": "Подзаголовок с контекстом — насколько реально войти на рынок. Макс 20 слов.",

  "gap_interpretation": "Что значит ${input.gap_type === 'strategic' ? 'стратегический gap' : input.gap_type === 'execution' ? 'execution gap' : 'отсутствие gap'} для нового игрока. Какие возможности это открывает или закрывает. Макс 35 слов.",

  "competitor_size_interpretation": "Что значит размер конкурентов (${input.competitors[0]?.size_estimate || 'unknown'}) для стартапа. Можно ли конкурировать. Макс 30 слов.",

  "entry_interpretation": "Почему точка входа '${input.entry_point.slice(0, 80)}' реалистична или рискованна. Конкретные шаги. Макс 30 слов.",

  "window_urgency": "Насколько срочно нужно входить на рынок. Есть ли окно возможности и как долго оно продержится. Макс 25 слов.",

  "key_factors": [
    "Фактор 1 определивший конкурентный диагноз. Макс 15 слов.",
    "Фактор 2. Макс 15 слов.",
    "Фактор 3. Макс 15 слов."
  ],

  "block5_connection": "Как конкурентная ситуация влияет на юнит-экономику (CAC, pricing power, margins) в Блоке 5. Макс 25 слов.",

  "conclusion_green": "Итог если GREEN. Как использовать слабость конкурентов. Макс 35 слов.",
  "conclusion_yellow": "Итог если YELLOW. Какие риски и как их митигировать. Макс 35 слов.",
  "conclusion_red": "Итог если RED. Почему конкуренция делает вход сложным и что делать. Макс 35 слов."
}`
}

// ══════════════════════════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const trend_id = searchParams.get('trend_id')
  const nicheFromQuery = searchParams.get('niche') || ''

  if (!trend_id) {
    return NextResponse.json({ error: 'trend_id required' }, { status: 400 })
  }

  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServerSupabase()

  // Читаем block_results для Block 4 + Block 2 (для niche fallback)
  const [block4Result, block2Result] = await Promise.all([
    supabase
      .from('block_results')
      .select('*')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .eq('block_number', 4)
      .maybeSingle(),
    supabase
      .from('block_results')
      .select('block_context')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .eq('block_number', 2)
      .maybeSingle(),
  ])

  if (block4Result.error || !block4Result.data) {
    return NextResponse.json(
      { error: 'Block 4 данные не найдены. Сначала запустите анализ конкуренции.' },
      { status: 404 }
    )
  }

  const blockResult = block4Result.data

  // Проверяем кэш — если intelligence_output уже есть, возвращаем
  if (blockResult.intelligence_output) {
    return NextResponse.json({
      cached: true,
      data: blockResult.intelligence_output,
    })
  }

  // ── Собираем input из block_context + raw_data ──
  const ctx = blockResult.block_context || {}
  const rawData = blockResult.raw_data || {}
  const layers = rawData.layers || {}
  const layer1 = layers.layer1 || {}
  const layer2 = layers.layer2 || {}
  const layer3 = layers.layer3 || {}

  // Niche: query param → Block 2 context → entry_point (last resort)
  const niche = nicheFromQuery
    || block2Result.data?.block_context?.niche
    || ''

  const competitors = (layer1.competitors || []).map((c: any) => ({
    domain: c.domain || '',
    name: c.name || c.domain || '',
    size_estimate: c.size?.estimate || 'unknown',
    g2_reviews: c.size?.raw?.g2_reviews ?? null,
    primary_segment: c.primary_segment || 'unknown',
  }))

  const mapGaps = (gaps: any[]) => (gaps || []).map((g: any) => ({
    competitor: g.competitor || '',
    category: g.category || '',
    reasoning: g.reasoning || '',
    sample_quotes: g.sample_quotes || [],
  }))

  const input: CompetitionIntelligenceInput = {
    niche,
    diagnosis: blockResult.diagnosis || 'yellow',
    score: blockResult.score ?? 5,
    reason: ctx.reason || rawData.premium?.reason || '',

    // Layer 1
    competitor_count: layer1.total_found ?? 0,
    paid_count: layer1.paid_count ?? 0,
    organic_count: layer1.organic_count ?? 0,
    competitors,

    // Layer 2
    gap_type: ctx.gap_type || 'none',
    has_strategic_gap: ctx.has_strategic_gap || layer2.has_strategic_gap || false,
    strategic_gaps: mapGaps(layer2.strategic_gaps),
    execution_gaps: mapGaps(layer2.execution_gaps),
    total_reviews_analyzed: layer2.classification_details?.total_reviews_analyzed ?? 0,
    top_gap_category: ctx.top_gap_category || layer2.top_gap_category || null,

    // Layer 3
    entry_point: ctx.entry_point || layer3.entry_point || '',
    entry_point_competitor: layer3.entry_point_competitor || '',
    entry_point_reasoning: layer3.entry_point_reasoning || '',
    strategic_gap_summary: layer3.strategic_gap_summary || null,
    positioning_vectors: layer3.positioning_vectors || [],

    key_factors: blockResult.key_factors || [],
  }

  // Проверка минимума данных
  if (!input.niche) {
    return NextResponse.json(
      { error: 'Niche не найдена. Перезапустите анализ.' },
      { status: 422 }
    )
  }

  // ── Sonnet анализ ──
  try {
    const prompt = buildPrompt(input)

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'Respond with valid JSON only, no markdown, no code blocks, no explanations.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const cleaned = text.replace(/```json|```/g, '').trim()
    const intelligenceOutput = JSON.parse(cleaned)

    // Сохраняем в кэш
    await supabase
      .from('block_results')
      .update({
        intelligence_output: intelligenceOutput,
        intelligence_updated_at: new Date().toISOString(),
      })
      .eq('id', blockResult.id)

    return NextResponse.json({ cached: false, data: intelligenceOutput })
  } catch (error: any) {
    console.error('[Intelligence Layer Block 4]', error)

    return NextResponse.json({
      error: 'Intelligence Layer unavailable',
      fallback: true,
      message: error.message || 'Sonnet analysis failed',
    })
  }
}
